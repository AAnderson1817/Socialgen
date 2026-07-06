/* Socialgen core — genesis of District 01: "The Lantern".
   This is NOT a generator. It is one authored island, composed landmark by
   landmark at deliberate coordinates — the noise functions are texture
   brushes, not decision makers. Change a number here and you have changed
   the district for everyone, forever. That's the point.

   The composition:
     The Prow        — snow-capped hero massif, NW
     The Ewer        — crater lake on the Prow's SE shoulder
     Lantern Falls   — the lake's outflow leaping the shoulder cliff
     The Meander     — river valley winding to the south harbor
     Glimmer Hollow  — a real cave (a tunnel, not a painted circle) into a
                       crystal geode chamber
     The Kettles     — hot-spring terrace
     The Needle's Eye— a real stone sea arch over the east cove
     The Organ Pipes — sheer basalt columns, west face
     The Wardens     — basalt sea stacks, SW water
     Lantern Harbor  — sheltered south bay, the settlement plain around it
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, World } = SG;

const SIZE_X = 256, SIZE_Y = 80, SIZE_Z = 256;
const SEA = 20;                 // cubes with y < SEA flood with ocean
const DISTRICT_SEED = 1866;     // fixed forever — District 01 is 1 of 1

/* ---- deterministic noise kit (ported from the heightmap prototype) ---- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeNoise(rand) {
  const p = new Uint8Array(512), t = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const x = t[i]; t[i] = t[j]; t[j] = x; }
  for (let i = 0; i < 512; i++) p[i] = t[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const a = rand() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  const fade = v => v * v * v * (v * (v * 6 - 15) + 10), lp = (a, b, u) => a + (b - a) * u;
  const g = (h, x, y) => gx[h] * x + gy[h] * y;
  return function (x, y) {
    const Xf = Math.floor(x), Yf = Math.floor(y);
    const xf = x - Xf, yf = y - Yf, X = Xf & 255, Y = Yf & 255;
    const aa = p[(p[X] + Y) & 255], ba = p[(p[X + 1] + Y) & 255],
          ab = p[(p[X] + Y + 1) & 255], bb = p[(p[X + 1] + Y + 1) & 255];
    const u = fade(xf), v = fade(yf);
    return lp(lp(g(aa, xf, yf), g(ba, xf - 1, yf), u),
              lp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u), v) * 1.41;
  };
}
function fbm(n, x, y, oct) {
  let a = .5, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; norm += a; a *= .5; f *= 2; }
  return s / norm;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function hash2(x, z) {
  let h = (x * 374761393) ^ (z * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ======================= the authored composition ======================= */
function buildDistrict01() {
  const rand = mulberry32(DISTRICT_SEED);
  const nDetail = makeNoise(rand), nPatch = makeNoise(rand), nWiggle = makeNoise(rand);
  const world = new World(SIZE_X, SIZE_Y, SIZE_Z);
  const hf = new Float32Array(SIZE_X * SIZE_Z);      // working height field (float)
  const H = (x, z) => hf[z * SIZE_X + x];

  /* -- landform anchors: (x, z, radius, peak height, steepness) --
     steepness < 1 makes a broad convex shelf (island base);
     steepness > 2 makes a spire. Features rise from the shelves. -- */
  const ANCHORS = [
    // the island shelf — the broad base everything else rises from
    [120, 120, 95, 26, 0.35],
    [150, 170, 80, 25, 0.38],
    [105, 85, 75, 27, 0.40],
    [185, 135, 55, 24, 0.42],
    // the authored features
    [95, 78, 62, 63, 2.6],    // The Prow massif
    [78, 62, 40, 52, 3.0],    //   its NW bulk
    [74, 74, 24, 48, 1.4],    // west ridge, crown of the Organ Pipes
    [72, 100, 22, 42, 1.2],   // west ridge, south reach
    [118, 102, 40, 44, 2.2],  // falls shoulder plateau
    [112, 124, 26, 36, 2.0],  // Kettles terrace
    [132, 140, 46, 30, 1.7],  // midlands
    [148, 174, 56, 27, 1.5],  // south settlement plain
    [198, 118, 34, 33, 2.4],  // east headland
    [172, 128, 26, 25, 1.6],  // low neck to the headland
    [70, 130, 30, 26, 2.0],   // west foot
  ];
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
    const seabed = 11 + fbm(nDetail, x * 0.02, z * 0.02, 2) * 3;
    let h = seabed;
    for (const [ax, az, r, ah, pow] of ANCHORS) {
      const t = clamp(1 - Math.hypot(x - ax, z - az) / r, 0, 1);
      h = Math.max(h, seabed + (ah - seabed) * Math.pow(t, pow));
    }
    // organic detail on land only — calmed on the settlement plain, which is
    // settled precisely because it is gentle
    const plainCalm = 1 - 0.55 * smooth(46, 12, Math.hypot(x - 148, z - 174));
    h += fbm(nDetail, x * 0.045, z * 0.045, 4) * 2.6 * plainCalm * smooth(SEA - 5, SEA + 2, h);
    // fade everything to seabed away from the island
    h = lerp(h, seabed, smooth(104, 126, Math.hypot(x - 130, z - 125)));
    hf[z * SIZE_X + x] = h;
  }

  const pullDown = (cx, cz, r, floor, pow = 1.6) => {
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) continue;
      const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
      const i = z * SIZE_X + x;
      hf[i] = lerp(hf[i], Math.min(hf[i], floor), Math.pow(t, pow));
    }
  };
  const pullUp = (cx, cz, r, target, pow = 1.6) => {
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) continue;
      const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
      const i = z * SIZE_X + x;
      hf[i] = Math.max(hf[i], lerp(hf[i], target, Math.pow(t, pow)));
    }
  };

  pullDown(155, 208, 26, 13);            // Lantern Harbor bay
  pullDown(208, 148, 13, 15);            // the Needle's Eye cove
  pullUp(95, 78, 10, 63, 0.7);           // the Prow's snow dome
  pullUp(121, 94, 11, 43, 1.2);          // guarantee the falls plateau…
  pullDown(139, 101, 10, 26.5);          // …and the valley floor it leaps into
  pullUp(74, 84, 12, 44, 0.5);           // flat crown of the Organ Pipes (clifftop plots)
  pullUp(198, 118, 10, 31, 0.5);         // flat cap on the east headland

  // beach aprons: gentle authored shores where the settlement meets the sea —
  // waterfront is the district's best commodity, so the coast is composed, not
  // left to the shelf's natural cliff edge
  const apron = (cx, cz, r) => {
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) continue;
      const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
      const i = z * SIZE_X + x;
      const w2 = t * smooth(8, 4, Math.abs(hf[i] - SEA - 1));
      hf[i] = lerp(hf[i], SEA + 1.2 + (hf[i] - SEA - 1.2) * 0.3, w2);
    }
  };
  apron(150, 226, 22);                   // the long south strand
  apron(135, 224, 18);                   //   …continuing west
  apron(122, 220, 18);                   // south-west sands
  apron(196, 196, 17);                   // south-east shore
  apron(213, 162, 13);                   // the cove beach by the Needle's Eye
  apron(168, 214, 16);                   // harbor mouth, east side
  apron(68, 140, 14);                    // west foot shore, under the Pipes

  // The Organ Pipes: remove any gentle shelf on the west face so the massif
  // meets the sea as a sheer wall, then crenellate the rim like columns.
  for (let z = 56; z <= 122; z++) {
    const edge = 62 + fbm(nWiggle, 3.3, z * 0.05, 2) * 7;
    for (let x = 34; x < edge + 8; x++) {
      const i = z * SIZE_X + x;
      const inside = smooth(edge + 6, edge - 2, x); // 1 seaward of the rim
      if (inside > 0 && hf[i] > 15 && hf[i] < 41) hf[i] = lerp(hf[i], 12, inside);
    }
  }
  const pipeMask = (x, z) => z >= 56 && z <= 122 && x <= 62 + fbm(nWiggle, 3.3, z * 0.05, 2) * 7 + 6 && H(x, z) >= 38;
  for (let z = 56; z <= 122; z++) for (let x = 34; x <= 78; x++)
    if (pipeMask(x, z)) hf[z * SIZE_X + x] += (hash2(x, z) - 0.35) * 2.4; // columnar rim

  /* -- The Ewer: crater lake bowl on the Prow's SE shoulder -- */
  const LAKE = { x: 105, z: 88, r: 9, level: 50, bed: 45 };
  for (let z = LAKE.z - LAKE.r - 2; z <= LAKE.z + LAKE.r + 2; z++)
    for (let x = LAKE.x - LAKE.r - 2; x <= LAKE.x + LAKE.r + 2; x++) {
      const dRel = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
      if (dRel > 1.25) continue;
      const i = z * SIZE_X + x;
      const bowl = LAKE.bed + dRel * dRel * 9;             // bed → rim ≈ 54
      hf[i] = dRel <= 1 ? Math.min(hf[i], bowl) : Math.max(hf[i], LAKE.level + 2); // sealed rim
    }

  /* -- the river: outlet → falls → meander → harbor -- */
  const RIVER_WP = [
    [113, 90, 49], [118, 92, 45.5], [124, 95, 43.2], [128, 97, 42.8],  // plateau reach
    [137, 101, 25.8],                                                   // below Lantern Falls
    [139, 112, 24.6], [137, 127, 23.6], [141, 143, 22.8], [147, 158, 22.2],
    [150, 172, 21.4], [152, 186, 20.4], [155, 200, 18.5],               // to the harbor
  ];
  const riverWater = [];       // {x, z, level} above-sea water cells to place
  const gravelRim = new Set(); // column keys that get gravel banks
  const riverCells = new Set();
  let FALLS = null;
  for (let s = 0; s < RIVER_WP.length - 1; s++) {
    const [x1, z1, b1] = RIVER_WP[s], [x2, z2, b2] = RIVER_WP[s + 1];
    const seg = Math.hypot(x2 - x1, z2 - z1), steps = Math.ceil(seg * 3);
    const isDrop = b1 - b2 > 8;
    if (isDrop) { FALLS = { x: (x1 + x2) / 2 | 0, z: (z1 + z2) / 2 | 0, top: b1, bottom: b2 }; }
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      let x = lerp(x1, x2, t), z = lerp(z1, z2, t);
      const bed = lerp(b1, b2, isDrop ? smooth(0.25, 0.55, t) : t);
      if (!isDrop) { // gentle authored meander wiggle
        const w = fbm(nWiggle, x * 0.05 + 7, z * 0.05, 2) * 2.2;
        x += w * 0.7; z += w * 0.4;
      }
      const r = isDrop ? 1.8 : 2.3;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const cx = Math.round(x + dx), cz = Math.round(z + dz);
        if (cx < 0 || cx >= SIZE_X || cz < 0 || cz >= SIZE_Z) continue;
        const dd = Math.hypot(cx - x, cz - z);
        const i = cz * SIZE_X + cx;
        if (dd < r) {
          hf[i] = Math.min(hf[i], bed + (dd / r) * (dd / r) * 1.6);
          riverCells.add(cz * SIZE_X + cx);
          if (bed + 1 > SEA - 1) riverWater.push({ x: cx, z: cz, level: Math.round(bed) + 1 });
        } else if (dd < r + 1.6) gravelRim.add(cz * SIZE_X + cx);
      }
    }
  }
  // plunge pool under the falls
  pullDown(137, 101, 5, 24.2, 1.2);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
    if (dx * dx + dz * dz <= 9) riverWater.push({ x: 137 + dx, z: 101 + dz, level: 26 });

  /* -- The Kettles: hot spring terrace -- */
  const springCells = [];
  pullUp(112, 124, 8, 33.5, 1.4);
  for (const [px, pz, pr] of [[110, 122, 2.6], [115, 126, 2.1], [109, 127, 1.8]]) {
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const dd = Math.hypot(dx, dz);
      const cx = px + dx, cz = pz + dz, i = cz * SIZE_X + cx;
      if (dd < pr) { hf[i] = Math.min(hf[i], 31.6); springCells.push({ x: cx, z: cz, level: 33 }); }
      else if (dd < pr + 1.6) { hf[i] = Math.max(hf[i], 33.4); gravelRim.add(i); }
    }
  }

  /* ---- quantize the height field into cubes, pick materials ---- */
  const hi = new Int16Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < hf.length; i++) hi[i] = Math.max(1, Math.round(hf[i]));
  const hAt = (x, z) => (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) ? 1 : hi[z * SIZE_X + x];

  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
    const h = Math.min(hAt(x, z), SIZE_Y - 6);
    const i = z * SIZE_X + x;
    const slope = Math.max(
      Math.abs(h - hAt(x + 1, z)), Math.abs(h - hAt(x - 1, z)),
      Math.abs(h - hAt(x, z + 1)), Math.abs(h - hAt(x, z - 1)));
    let nearWaterDepth = 0; // how close below sea the neighbourhood dips
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
      if (hAt(x + dx, z + dz) < SEA - 1) nearWaterDepth = 1;

    const inPipes = pipeMask(x, z);
    let top = MAT.GRASS, under = MAT.SOIL, deep = MAT.STONE, topDepth = 1, underDepth = 2;
    if (inPipes) { top = MAT.BASALT; under = MAT.BASALT; deep = MAT.BASALT; }
    else if (h < SEA - 4) { top = MAT.GRAVEL; underDepth = 1; }
    else if (h < SEA + 2 && nearWaterDepth) { top = MAT.SAND; under = MAT.SAND; }
    else if (h >= 58) { top = MAT.SNOW; topDepth = 2; under = MAT.STONE; }
    else if (h >= 54 && fbm(nPatch, x * 0.1, z * 0.1, 2) > 0.05) { top = MAT.SNOW; under = MAT.STONE; }
    else if (h >= 50 || slope >= 3) { top = MAT.STONE; under = MAT.STONE; }
    else if (gravelRim.has(i)) { top = MAT.GRAVEL; }
    if (riverCells.has(i) && h > SEA - 4) { top = MAT.GRAVEL; under = MAT.GRAVEL; }

    world.set(x, 0, z, MAT.BEDROCK);
    const stoneTop = h - topDepth - underDepth;
    for (let y = 1; y <= stoneTop; y++) world.set(x, y, z, deep);
    for (let y = Math.max(1, stoneTop + 1); y <= h - topDepth; y++) world.set(x, y, z, under);
    for (let y = Math.max(1, h - topDepth + 1); y <= h; y++) world.set(x, y, z, top);
  }

  /* ---- water ---- */
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++)
    for (let y = hAt(x, z) + 1; y < SEA; y++)
      if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.WATER);
  // the Ewer
  for (let z = LAKE.z - LAKE.r; z <= LAKE.z + LAKE.r; z++)
    for (let x = LAKE.x - LAKE.r; x <= LAKE.x + LAKE.r; x++)
      if (Math.hypot(x - LAKE.x, z - LAKE.z) <= LAKE.r)
        for (let y = hAt(x, z) + 1; y <= LAKE.level; y++)
          if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.WATER);
  // river reaches above sea level
  for (const { x, z, level } of riverWater)
    for (let y = hAt(x, z) + 1; y <= Math.min(level, SIZE_Y - 1); y++)
      if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.WATER);
  // Lantern Falls: the vertical sheet down the cliff face
  if (FALLS) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const cx = FALLS.x + dx, cz = FALLS.z + dz;
      if (Math.abs(dx) + Math.abs(dz) > 1) continue;
      for (let y = Math.round(FALLS.bottom); y <= Math.round(FALLS.top) + 1; y++)
        if (world.get(cx, y, cz) === MAT.AIR) world.set(cx, y, cz, MAT.WATER);
    }
  }
  // the Kettles
  for (const { x, z, level } of springCells)
    for (let y = hAt(x, z) + 1; y <= level; y++)
      if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.SPRING);

  /* ---- Glimmer Hollow: a real cave — tunnel into a geode chamber ---- */
  const CAVE = { mouth: [102, 107], chamber: [95, 95] };
  const mouthY = world.surfaceAt(102, 107);
  const chamberY = mouthY - 6;
  const carveSphere = (cx, cy, cz, r, mat = MAT.AIR) => {
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if (Math.hypot(x - cx, y - cy, z - cz) <= r && world.get(x, y, z) !== MAT.BEDROCK)
            world.set(x, y, z, mat);
  };
  const tunnelSteps = 9;
  for (let k = 0; k <= tunnelSteps; k++) {
    const t = k / tunnelSteps;
    carveSphere(lerp(CAVE.mouth[0], CAVE.chamber[0], t),
                lerp(mouthY + 1.4, chamberY + 2, t),
                lerp(CAVE.mouth[1], CAVE.chamber[1], t), 2.4);
  }
  carveSphere(CAVE.chamber[0], chamberY + 2.5, CAVE.chamber[1], 5.2); // the geode
  // crystals stud the chamber walls; gravel floor; moss at the mouth
  for (let z = CAVE.chamber[1] - 7; z <= CAVE.chamber[1] + 7; z++)
    for (let y = chamberY - 4; y <= chamberY + 9; y++)
      for (let x = CAVE.chamber[0] - 7; x <= CAVE.chamber[0] + 7; x++) {
        if (world.get(x, y, z) !== MAT.AIR) continue;
        for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          const nid = world.get(nx, ny, nz);
          if ((nid === MAT.STONE || nid === MAT.SOIL) && hash2(nx * 3 + ny, nz * 3 + ny) < 0.34)
            world.set(nx, ny, nz, MAT.CRYSTAL);
        }
        if (world.get(x, y - 1, z) === MAT.STONE && hash2(x, z) < 0.5) world.set(x, y - 1, z, MAT.GRAVEL);
      }
  for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = CAVE.mouth[0] + dx, y = mouthY + dy, z = CAVE.mouth[1] + 2 + dz;
    if (world.get(x, y, z) === MAT.STONE || world.get(x, y, z) === MAT.GRASS)
      if (hash2(x + y, z - y) < 0.6) world.set(x, y, z, MAT.MOSS);
  }

  /* ---- The Needle's Eye: a real arch — stone over open air over water ---- */
  const ARCH = { x: 208, z: 148, span: 5.5, apex: SEA + 9, dirX: 0.89, dirZ: -0.45 };
  for (let t = 0; t <= 40; t++) {
    const a = (t / 40) * Math.PI;
    const along = Math.cos(a) * ARCH.span;
    const cx = ARCH.x + along * ARCH.dirX, cz = ARCH.z + along * ARCH.dirZ;
    const cy = (SEA - 3) + Math.sin(a) * (ARCH.apex - (SEA - 3));
    for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      if (Math.hypot(dx, dy * 1.3, dz) <= 1.7)
        world.set(Math.round(cx + dx), Math.round(cy + dy), Math.round(cz + dz), MAT.STONE);
  }
  for (const side of [-1, 1]) { // plant the legs down to the seabed
    const lx = Math.round(ARCH.x + side * ARCH.span * ARCH.dirX);
    const lz = Math.round(ARCH.z + side * ARCH.span * ARCH.dirZ);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      for (let y = 1; y <= SEA - 2; y++) {
        const id = world.get(lx + dx, y, lz + dz);
        if (id === MAT.AIR || id === MAT.WATER) world.set(lx + dx, y, lz + dz, MAT.STONE);
      }
  }

  /* ---- The Wardens: sea stacks ---- */
  for (const [sx2, sz2, r, top] of [[62, 182, 2.4, SEA + 7], [73, 196, 1.9, SEA + 4], [54, 162, 2.1, SEA + 9], [86, 206, 1.6, SEA + 3]]) {
    for (let y = 1; y <= top; y++) {
      const rr = r * (1 - 0.25 * (y / top));
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
        if (Math.hypot(dx, dz) <= rr)
          world.set(sx2 + dx, y, sz2 + dz, y === top ? MAT.GRASS : MAT.BASALT);
    }
  }

  /* ---- ore veins: buried value, discovered by whoever holds the deed ---- */
  const vein = (mat, count, yMin, yMax, len, xMax = SIZE_X) => {
    for (let vi = 0; vi < count; vi++) {
      let x = 0, y = 0, z = 0, tries = 0;
      do {
        x = 20 + Math.floor(rand() * (Math.min(xMax, SIZE_X) - 40));
        z = 20 + Math.floor(rand() * (SIZE_Z - 40));
        y = yMin + Math.floor(rand() * (yMax - yMin));
      } while (world.get(x, y, z) !== MAT.STONE && ++tries < 60);
      if (tries >= 60) continue;
      for (let k = 0; k < len; k++) {
        if (world.get(x, y, z) === MAT.STONE) world.set(x, y, z, mat);
        const nx = x + Math.round(rand() * 2 - 1), ny = y + Math.round(rand() * 2 - 1), nz = z + Math.round(rand() * 2 - 1);
        if (world.get(nx, ny, nz) === MAT.STONE && rand() < 0.6) world.set(nx, ny, nz, mat);
        x = clamp(nx, 1, SIZE_X - 2); y = clamp(ny, 2, SIZE_Y - 2); z = clamp(nz, 1, SIZE_Z - 2);
      }
    }
  };
  vein(MAT.COPPER_ORE, 30, 18, 38, 10);
  vein(MAT.IRON_ORE, 20, 8, 24, 9);
  vein(MAT.GOLD_ORE, 9, 3, 14, 7, 110); // gold hides under the massif

  /* ---- forests: pine on the heights, broadleaf along the Meander ---- */
  const treeOcc = new Set();
  const clearOf = (x, z, r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
      if (treeOcc.has((z + dz) * SIZE_X + x + dx)) return false;
    return true;
  };
  const distToRiver = (x, z) => {
    let best = 99;
    for (const [wx, wz] of RIVER_WP) best = Math.min(best, Math.hypot(x - wx, z - wz));
    return best;
  };
  const plantPine = (x, z) => {
    const y0 = world.surfaceAt(x, z) + 1;
    const th = 3 + (hash2(x, z) * 2 | 0);
    for (let y = y0; y < y0 + th; y++) world.set(x, y, z, MAT.WOOD);
    const layers = [[2, 0], [2, 1], [1, 2], [1, 3], [0, 4]];
    for (const [r, dy] of layers)
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
        if (Math.hypot(dx, dz) <= r + 0.3 && world.get(x + dx, y0 + th - 1 + dy, z + dz) === MAT.AIR)
          world.set(x + dx, y0 + th - 1 + dy, z + dz, MAT.LEAF_PINE);
  };
  const plantBroad = (x, z) => {
    const y0 = world.surfaceAt(x, z) + 1;
    const th = 3 + (hash2(z, x) * 3 | 0);
    for (let y = y0; y < y0 + th; y++) world.set(x, y, z, MAT.WOOD);
    const cy = y0 + th;
    for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      if (Math.hypot(dx, dy * 1.25, dz) <= 2.3 - hash2(x * 7 + dx + dy, z * 7 + dz - dy) * 0.7 &&
          world.get(x + dx, cy + dy, z + dz) === MAT.AIR)
        world.set(x + dx, cy + dy, z + dz, MAT.LEAF_BROAD);
  };
  for (let z = 4; z < SIZE_Z - 4; z++) for (let x = 4; x < SIZE_X - 4; x++) {
    if (Math.hypot(x - ARCH.x, z - ARCH.z) < 16) continue; // keep the arch's viewshed open
    const s = world.surfaceAt(x, z);
    if (s < 0 || world.get(x, s, z) !== MAT.GRASS) continue;
    const slope = Math.max(Math.abs(s - world.surfaceAt(x + 1, z)), Math.abs(s - world.surfaceAt(x, z + 1)));
    if (slope > 2) continue;
    const rv = hash2(x * 5 + 11, z * 5 + 7);
    const pineDens = (s >= 30 && s <= 52 && z < 132) ? 0.07 + 0.04 * smooth(0.1, 0.6, fbm(nPatch, x * 0.03, z * 0.03, 2)) : 0;
    const broadDens = (s >= SEA + 2 && s <= 33 && z > 112) ? 0.055 + 0.08 * smooth(18, 6, distToRiver(x, z)) : 0;
    if (rv < pineDens && clearOf(x, z, 2)) { plantPine(x, z); treeOcc.add(z * SIZE_X + x); }
    else if (rv > 1 - broadDens && clearOf(x, z, 2)) { plantBroad(x, z); treeOcc.add(z * SIZE_X + x); }
  }

  // moss where the falls' spray hits the rock
  if (FALLS) for (let dz = -4; dz <= 4; dz++) for (let dy = -6; dy <= 8; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = FALLS.x + dx, y = Math.round(FALLS.bottom) + dy, z = FALLS.z + dz;
    if (world.get(x, y, z) === MAT.STONE && hash2(x - y, z + y) < 0.5) world.set(x, y, z, MAT.MOSS);
  }

  /* ---- the named places ---- */
  const lmY = (x, z, lift = 4) => world.heightAt(x, z) + lift;
  const landmarks = [
    { key: 'summit', name: 'The Prow', x: 95, z: 78, y: lmY(95, 78, 6) },
    { key: 'lake', name: 'The Ewer', x: LAKE.x, z: LAKE.z, y: LAKE.level + 4 },
    { key: 'falls', name: 'Lantern Falls', x: FALLS ? FALLS.x : 132, z: FALLS ? FALLS.z : 99, y: FALLS ? FALLS.top + 4 : 46 },
    { key: 'cave', name: 'Glimmer Hollow', x: CAVE.mouth[0], z: CAVE.mouth[1], y: mouthY + 5 },
    { key: 'springs', name: 'The Kettles', x: 112, z: 124, y: 38 },
    { key: 'arch', name: "The Needle's Eye", x: ARCH.x, z: ARCH.z, y: ARCH.apex + 5 },
    { key: 'pipes', name: 'The Organ Pipes', x: 58, z: 90, y: lmY(58, 90, 6) },
    { key: 'harbor', name: 'Lantern Harbor', x: 155, z: 205, y: SEA + 6 },
    { key: 'stacks', name: 'The Wardens', x: 62, z: 182, y: SEA + 12 },
  ];

  return {
    world, landmarks,
    meta: { name: 'The Lantern', district: 1, seed: DISTRICT_SEED, sea: SEA, version: 1 },
  };
}

SG.SEA = SEA;
SG.buildDistrict01 = buildDistrict01;
})();
