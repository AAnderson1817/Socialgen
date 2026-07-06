/* Socialgen core — greedy voxel mesher with baked ambient occlusion.
   Sweeps all 6 face directions per region, merges coplanar faces that share
   (material, AO pattern, jitter shade) into rectangles, and bakes lighting
   into vertex colors: face shading + corner AO + deterministic per-cube
   jitter. Out-of-bounds counts as air, so the world renders as a cut
   diorama at its borders. Pure JS — outputs typed arrays, no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, PALETTE, isOpaque } = SG;

const AO_MUL = [0.52, 0.70, 0.85, 1.0];
// axis 0=x, 1=y, 2=z; index [axis*2 + (sign>0?0:1)]
const FACE_SHADE = [0.82, 0.78, 1.0, 0.50, 0.72, 0.66];

function hash3(x, y, z) {
  let h = (x * 374761393) ^ (y * 668265263) ^ (z * 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return (h ^ (h >>> 16)) >>> 0;
}

// Mesh a region of columns [x0,x0+w) × [z0,z0+d), full height.
// Returns { opaque, fluid }, each { positions, normals, colors, indices }.
function meshRegion(world, x0, z0, w, d) {
  const { sx, sy, sz, data } = world;
  const cell = (x, y, z) =>
    (x < 0 || x >= sx || y < 0 || y >= sy || z < 0 || z >= sz) ? 0 : data[(z * sx + x) * sy + y];
  const solidAt = (x, y, z) => isOpaque(cell(x, y, z)) ? 1 : 0;

  const out = {
    opaque: { positions: [], normals: [], colors: [], indices: [] },
    fluid: { positions: [], normals: [], colors: [], indices: [] },
  };
  const rmin = [x0, 0, z0], rmax = [x0 + w, sy, z0 + d];
  const p = [0, 0, 0], q = [0, 0, 0];

  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const nu = rmax[u] - rmin[u], nv = rmax[v] - rmin[v];
    const keys = new Int32Array(nu * nv);   // merge key per mask cell, 0 = no face
    const fluidMask = new Uint8Array(nu * nv);

    for (let sign = 1; sign >= -1; sign -= 2) {
      const shade = FACE_SHADE[axis * 2 + (sign > 0 ? 0 : 1)];
      for (let a = rmin[axis]; a < rmax[axis]; a++) {
        // -- build mask --
        keys.fill(0); fluidMask.fill(0);
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
          p[axis] = a; p[u] = rmin[u] + i; p[v] = rmin[v] + j;
          const id = cell(p[0], p[1], p[2]);
          if (id === MAT.AIR) continue;
          q[0] = p[0]; q[1] = p[1]; q[2] = p[2]; q[axis] += sign;
          const nid = cell(q[0], q[1], q[2]);
          const e = PALETTE[id];
          const m = j * nu + i;
          if (e.fluid) {
            if (nid !== MAT.AIR) continue;             // fluid faces only against air
            keys[m] = (1 << 24) | id;                  // AO-less, jitter-less
            fluidMask[m] = 1;
          } else {
            if (isOpaque(nid)) continue;               // hidden face
            // corner AO from the 8 neighbours in the layer the face looks into
            let ao = 0;
            for (let c = 0; c < 4; c++) {
              const du = (c === 1 || c === 2) ? 1 : -1;  // c: 00,10,11,01
              const dv = (c >= 2) ? 1 : -1;
              q[axis] = p[axis] + sign; q[u] = p[u] + du; q[v] = p[v];
              const s1 = solidAt(q[0], q[1], q[2]);
              q[u] = p[u]; q[v] = p[v] + dv;
              const s2 = solidAt(q[0], q[1], q[2]);
              q[u] = p[u] + du;
              const s3 = solidAt(q[0], q[1], q[2]);
              const av = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3);
              ao |= av << (c * 2);
            }
            const jl = e.jitter > 0 ? hash3(p[0], p[1], p[2]) % 3 : 1;
            keys[m] = (1 << 24) | id | (ao << 8) | (jl << 16);
          }
        }
        // -- greedy merge --
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu;) {
          const m = j * nu + i, key = keys[m];
          if (key === 0) { i++; continue; }
          let wdt = 1;
          while (i + wdt < nu && keys[m + wdt] === key) wdt++;
          let hgt = 1;
          outer: while (j + hgt < nv) {
            for (let k = 0; k < wdt; k++) if (keys[(j + hgt) * nu + i + k] !== key) break outer;
            hgt++;
          }
          emitQuad(out, key, fluidMask[m], axis, u, v, sign, a,
                   rmin[u] + i, rmin[v] + j, wdt, hgt, shade);
          for (let jj = 0; jj < hgt; jj++)
            keys.fill(0, (j + jj) * nu + i, (j + jj) * nu + i + wdt);
          i += wdt;
        }
      }
    }
  }
  for (const k of ['opaque', 'fluid']) {
    const o = out[k];
    out[k] = {
      positions: new Float32Array(o.positions),
      normals: new Float32Array(o.normals),
      colors: new Float32Array(o.colors),
      indices: new Uint32Array(o.indices),
    };
  }
  return out;
}

function emitQuad(out, key, isFluid, axis, u, v, sign, a, i0, j0, wdt, hgt, shade) {
  const id = key & 0xff, ao = (key >> 8) & 0xff, jl = (key >> 16) & 0x3;
  const e = PALETTE[id];
  const o = isFluid ? out.fluid : out.opaque;
  const topFace = axis === 1 && sign > 0;
  const hex = topFace ? e.colorTop : e.color;
  const jm = 1 + (jl - 1) * e.jitter;
  const br = ((hex >> 16) & 255) / 255, bg = ((hex >> 8) & 255) / 255, bb = (hex & 255) / 255;

  const plane = a + (sign > 0 ? 1 : 0);
  const base = o.positions.length / 3;
  const corners = [[0, 0], [wdt, 0], [wdt, hgt], [0, hgt]]; // c00,c10,c11,c01
  const n = [0, 0, 0]; n[axis] = sign;
  for (let c = 0; c < 4; c++) {
    const pos = [0, 0, 0];
    pos[axis] = plane; pos[u] = i0 + corners[c][0]; pos[v] = j0 + corners[c][1];
    o.positions.push(pos[0], pos[1], pos[2]);
    o.normals.push(n[0], n[1], n[2]);
    const aoc = isFluid ? 3 : (ao >> (c * 2)) & 3;
    const l = shade * AO_MUL[aoc] * jm;
    o.colors.push(br * l, bg * l, bb * l);
  }
  const a00 = (ao >> 0) & 3, a10 = (ao >> 2) & 3, a11 = (ao >> 4) & 3, a01 = (ao >> 6) & 3;
  const flip = a00 + a11 > a10 + a01;      // pick the diagonal that smooths AO
  let tris = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
  if (sign < 0) tris = flip ? [1, 0, 3, 1, 3, 2] : [0, 3, 2, 0, 2, 1];
  for (const t of tris) o.indices.push(base + t);
}

SG.meshRegion = meshRegion;
})();
