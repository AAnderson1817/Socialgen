/* Socialgen core — genesis of District 01: "The Lantern".
   This is NOT a generator. It is one authored island, composed landmark by
   landmark at deliberate coordinates — the noise functions are texture
   brushes, not decision makers. Change a number here and you have changed
   the district for everyone, forever. That's the point.

   Scale: a cube is small against the land. Trees stand two or three cubes
   of trunk under a three-wide crown; the Prow rises ~74 cubes over the sea;
   Lantern Falls drops ~26. A 12×12-cube plot holds a small forest, not a
   single tree.

   The composition:
     The Prow        — snow-capped hero massif, NW
     The Ewer        — crater lake on the Prow's SE shoulder
     Lantern Falls   — the lake's outflow leaping the shoulder cliff
     The Meander     — river valley winding to the south harbor
     Glimmer Hollow  — a real cave: a tunnel into a crystal geode chamber
                       with a still black pool at its floor
     The Kettles     — hot-spring terrace
     The Needle's Eye— a real stone sea arch over the east cove
     The Organ Pipes — sheer basalt columns, west face
     The Wardens     — basalt sea stacks, SW water
     Lantern Harbor  — sheltered south bay, the settlement plain around it
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, World } = SG;

const SIZE_X = 384, SIZE_Y = 128, SIZE_Z = 384;
const SEA = 26;                 // cubes with y < SEA flood with ocean
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
    [180, 180, 142, 34, 0.35],
    [225, 255, 120, 33, 0.38],
    [158, 128, 112, 36, 0.40],
    [278, 202, 82, 31, 0.42],
    // the authored features
    [142, 117, 93, 100, 2.6],   // The Prow massif
    [117, 93, 60, 80, 3.0],     //   its NW bulk
    [111, 111, 36, 72, 1.4],    // west ridge, crown of the Organ Pipes
    [108, 150, 33, 64, 1.2],    // west ridge, south reach
    [177, 153, 60, 64, 2.2],    // falls shoulder plateau
    [168, 186, 39, 50, 2.0],    // Kettles terrace
    [198, 210, 69, 42, 1.7],    // midlands
    [222, 261, 84, 38, 1.5],    // south settlement plain
    [297, 177, 51, 46, 2.4],    // east headland
    [258, 192, 39, 36, 1.6],    // low neck to the headland
    [105, 195, 45, 37, 2.0],    // west foot
  ];
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
    const seabed = 14 + fbm(nDetail, x * 0.014, z * 0.014, 2) * 4;
    let h = seabed;
    for (const [ax, az, r, ah, pow] of ANCHORS) {
      const t = clamp(1 - Math.hypot(x - ax, z - az) / r, 0, 1);
      h = Math.max(h, seabed + (ah - seabed) * Math.pow(t, pow));
    }
    // organic detail on land only — calmed on the settlement plain, which is
    // settled precisely because it is gentle
    const plainCalm = 1 - 0.55 * smooth(69, 18, Math.hypot(x - 222, z - 261));
    h += fbm(nDetail, x * 0.03, z * 0.03, 4) * 3.4 * plainCalm * smooth(SEA - 6, SEA + 3, h);
    // fade everything to seabed away from the island
    h = lerp(h, seabed, smooth(156, 189, Math.hypot(x - 195, z - 188)));
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

  pullDown(233, 312, 39, 17);            // Lantern Harbor bay
  pullDown(312, 222, 20, 19);            // the Needle's Eye cove
  pullUp(142, 117, 15, 100, 0.7);        // the Prow's snow dome
  pullUp(181, 141, 17, 62, 1.2);         // guarantee the falls plateau…
  pullDown(208, 152, 15, 34.5);          // …and the valley floor it leaps into
  pullUp(111, 126, 18, 66, 0.5);         // flat crown of the Organ Pipes (clifftop plots)
  pullUp(297, 177, 15, 44, 0.5);         // flat cap on the east headland

  // beach aprons: gentle authored shores where the settlement meets the sea —
  // waterfront is the district's best commodity, so the coast is composed, not
  // left to the shelf's natural cliff edge
  const apron = (cx, cz, r) => {
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) continue;
      const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
      const i = z * SIZE_X + x;
      const w2 = t * smooth(10, 5, Math.abs(hf[i] - SEA - 1));
      hf[i] = lerp(hf[i], SEA + 1.3 + (hf[i] - SEA - 1.3) * 0.3, w2);
    }
  };
  apron(225, 339, 33);                   // the long south strand
  apron(203, 336, 27);                   //   …continuing west
  apron(183, 330, 27);                   // south-west sands
  apron(294, 294, 26);                   // south-east shore
  apron(320, 243, 20);                   // the cove beach by the Needle's Eye
  apron(252, 321, 24);                   // harbor mouth, east side
  apron(102, 210, 21);                   // west foot shore, under the Pipes

  // The Organ Pipes: remove any gentle shelf on the west face so the massif
  // meets the sea as a sheer wall, then crenellate the rim like columns.
  for (let z = 84; z <= 183; z++) {
    const edge = 93 + fbm(nWiggle, 3.3, z * 0.033, 2) * 10;
    for (let x = 51; x < edge + 12; x++) {
      const i = z * SIZE_X + x;
      const inside = smooth(edge + 9, edge - 3, x); // 1 seaward of the rim
      if (inside > 0 && hf[i] > 20 && hf[i] < 60) hf[i] = lerp(hf[i], 15, inside);
    }
  }
  const pipeMask = (x, z) => z >= 84 && z <= 183 && x <= 93 + fbm(nWiggle, 3.3, z * 0.033, 2) * 10 + 9 && H(x, z) >= 56;
  for (let z = 84; z <= 183; z++) for (let x = 51; x <= 117; x++)
    if (pipeMask(x, z)) hf[z * SIZE_X + x] += (hash2(x, z) - 0.35) * 3.4; // columnar rim

  /* -- The Ewer: crater lake bowl on the Prow's SE shoulder -- */
  const LAKE = { x: 158, z: 132, r: 13, level: 76, bed: 69 };
  for (let z = LAKE.z - LAKE.r - 3; z <= LAKE.z + LAKE.r + 3; z++)
    for (let x = LAKE.x - LAKE.r - 3; x <= LAKE.x + LAKE.r + 3; x++) {
      const dRel = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
      if (dRel > 1.25) continue;
      const i = z * SIZE_X + x;
      const bowl = LAKE.bed + dRel * dRel * 13;            // bed → rim ≈ 82
      hf[i] = dRel <= 1 ? Math.min(hf[i], bowl) : Math.max(hf[i], LAKE.level + 2); // sealed rim
    }

  /* -- the river: outlet → falls → meander → harbor -- */
  const RIVER_WP = [
    [172, 138, 63.5], [180, 144, 62.5], [188, 148, 61.5], [192, 150, 61],   // plateau reach
    [207, 155, 35],                                                          // below Lantern Falls
    [209, 168, 33.5], [206, 190, 32], [212, 215, 31], [220, 237, 30],
    [225, 258, 28.5], [228, 279, 27.5], [233, 300, 25.5],                    // to the harbor
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
        const w = fbm(nWiggle, x * 0.033 + 7, z * 0.033, 2) * 3.2;
        x += w * 0.7; z += w * 0.4;
      }
      const r = isDrop ? 2.2 : 3.2;
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
        const cx = Math.round(x + dx), cz = Math.round(z + dz);
        if (cx < 0 || cx >= SIZE_X || cz < 0 || cz >= SIZE_Z) continue;
        const dd = Math.hypot(cx - x, cz - z);
        const i = cz * SIZE_X + cx;
        if (dd < r) {
          hf[i] = Math.min(hf[i], bed + (dd / r) * (dd / r) * 1.8);
          riverCells.add(cz * SIZE_X + cx);
          if (bed + 1 > SEA - 1) riverWater.push({ x: cx, z: cz, level: Math.round(bed) + 1 });
        } else if (dd < r + 2.2) gravelRim.add(cz * SIZE_X + cx);
      }
    }
  }
  // plunge pool under the falls
  pullDown(207, 155, 8, 33, 1.2);
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
    if (dx * dx + dz * dz <= 20) riverWater.push({ x: 207 + dx, z: 155 + dz, level: 35 });

  /* -- The Kettles: hot spring terrace -- */
  const springCells = [];
  pullUp(168, 186, 12, 50.5, 1.4);
  for (const [px, pz, pr] of [[165, 183, 3.6], [172, 189, 3.0], [163, 190, 2.6]]) {
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      const dd = Math.hypot(dx, dz);
      const cx = px + dx, cz = pz + dz, i = cz * SIZE_X + cx;
      if (dd < pr) { hf[i] = Math.min(hf[i], 48.2); springCells.push({ x: cx, z: cz, level: 50 }); }
      else if (dd < pr + 2) { hf[i] = Math.max(hf[i], 50.6); gravelRim.add(i); }
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
    for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2)
      if (hAt(x + dx, z + dz) < SEA - 1) nearWaterDepth = 1;

    const inPipes = pipeMask(x, z);
    let top = MAT.GRASS, under = MAT.SOIL, deep = MAT.STONE, topDepth = 1, underDepth = 2;
    if (inPipes) { top = MAT.BASALT; under = MAT.BASALT; deep = MAT.BASALT; }
    else if (h < SEA - 5) { top = MAT.GRAVEL; underDepth = 1; }
    else if (h < SEA + 2 && nearWaterDepth) { top = MAT.SAND; under = MAT.SAND; }
    else if (h >= 92) { top = MAT.SNOW; topDepth = 2; under = MAT.STONE; }
    else if (h >= 86 && fbm(nPatch, x * 0.07, z * 0.07, 2) > 0.05) { top = MAT.SNOW; under = MAT.STONE; }
    else if (h >= 78 || slope >= 3) { top = MAT.STONE; under = MAT.STONE; }
    else if (gravelRim.has(i)) { top = MAT.GRAVEL; }
    if (riverCells.has(i) && h > SEA - 5) { top = MAT.GRAVEL; under = MAT.GRAVEL; }

    // steep exposed rock reads as banded strata — thin terracotta seams
    const banded = !inPipes && slope >= 4 && h > SEA + 6;
    world.set(x, 0, z, MAT.BEDROCK);
    const stoneTop = h - topDepth - underDepth;
    for (let y = 1; y <= stoneTop; y++)
      world.set(x, y, z, banded && y > SEA && (y % 9) < 2 ? MAT.CLAY : deep);
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
  const CAVE = { mouth: [153, 160], chamber: [142, 142] };
  const mouthY = world.surfaceAt(153, 160);
  const chamberY = mouthY - 8;
  const carveSphere = (cx, cy, cz, r, mat = MAT.AIR) => {
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if (Math.hypot(x - cx, y - cy, z - cz) <= r && world.get(x, y, z) !== MAT.BEDROCK)
            world.set(x, y, z, mat);
  };
  const tunnelSteps = 12;
  for (let k = 0; k <= tunnelSteps; k++) {
    const t = k / tunnelSteps;
    carveSphere(lerp(CAVE.mouth[0], CAVE.chamber[0], t),
                lerp(mouthY + 1.8, chamberY + 3, t),
                lerp(CAVE.mouth[1], CAVE.chamber[1], t), 3.2);
  }
  carveSphere(CAVE.chamber[0], chamberY + 3, CAVE.chamber[1], 8.5); // the geode
  // crystals stud the chamber walls; gravel floor; moss at the mouth
  for (let z = CAVE.chamber[1] - 11; z <= CAVE.chamber[1] + 11; z++)
    for (let y = chamberY - 7; y <= chamberY + 13; y++)
      for (let x = CAVE.chamber[0] - 11; x <= CAVE.chamber[0] + 11; x++) {
        if (world.get(x, y, z) !== MAT.AIR) continue;
        for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          const nid = world.get(nx, ny, nz);
          if ((nid === MAT.STONE || nid === MAT.SOIL) && hash2(nx * 3 + ny, nz * 3 + ny) < 0.34)
            world.set(nx, ny, nz, MAT.CRYSTAL);
        }
        if (world.get(x, y - 1, z) === MAT.STONE && hash2(x, z) < 0.5) world.set(x, y - 1, z, MAT.GRAVEL);
      }
  // the still pool on the geode floor
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    if (Math.hypot(dx, dz) > 4.6) continue;
    const x = CAVE.chamber[0] + dx, z = CAVE.chamber[1] + dz;
    for (let y = chamberY - 5; y <= chamberY - 4; y++)
      if (world.get(x, y, z) === MAT.AIR && world.get(x, y - 1, z) !== MAT.AIR)
        world.set(x, y, z, MAT.WATER);
  }
  for (let dz = -3; dz <= 3; dz++) for (let dy = -1; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = CAVE.mouth[0] + dx, y = mouthY + dy, z = CAVE.mouth[1] + 3 + dz;
    if (world.get(x, y, z) === MAT.STONE || world.get(x, y, z) === MAT.GRASS)
      if (hash2(x + y, z - y) < 0.6) world.set(x, y, z, MAT.MOSS);
  }

  /* ---- The Needle's Eye: a real arch — stone over open air over water ---- */
  const ARCH = { x: 312, z: 222, span: 8, apex: SEA + 13, dirX: 0.89, dirZ: -0.45 };
  for (let t = 0; t <= 48; t++) {
    const a = (t / 48) * Math.PI;
    const along = Math.cos(a) * ARCH.span;
    const cx = ARCH.x + along * ARCH.dirX, cz = ARCH.z + along * ARCH.dirZ;
    const cy = (SEA - 3) + Math.sin(a) * (ARCH.apex - (SEA - 3));
    for (let dz = -2; dz <= 2; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++)
      if (Math.hypot(dx, dy * 1.3, dz) <= 2.1)
        world.set(Math.round(cx + dx), Math.round(cy + dy), Math.round(cz + dz), MAT.STONE);
  }
  for (const side of [-1, 1]) { // plant the legs down to the seabed
    const lx = Math.round(ARCH.x + side * ARCH.span * ARCH.dirX);
    const lz = Math.round(ARCH.z + side * ARCH.span * ARCH.dirZ);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
      for (let y = 1; y <= SEA - 2; y++) {
        const id = world.get(lx + dx, y, lz + dz);
        if (id === MAT.AIR || id === MAT.WATER) world.set(lx + dx, y, lz + dz, MAT.STONE);
      }
  }

  /* ---- The Wardens: sea stacks ---- */
  for (const [sx2, sz2, r, top] of [[93, 273, 3.4, SEA + 10], [110, 294, 2.7, SEA + 6], [81, 243, 3.0, SEA + 13], [129, 309, 2.3, SEA + 4]]) {
    for (let y = 1; y <= top; y++) {
      const rr = r * (1 - 0.25 * (y / top));
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
        if (Math.hypot(dx, dz) <= rr)
          world.set(sx2 + dx, y, sz2 + dz, y === top ? MAT.GRASS : MAT.BASALT);
    }
  }

  /* ---- ore veins: buried value, discovered by whoever holds the deed ---- */
  const vein = (mat, count, yMin, yMax, len, xMax = SIZE_X) => {
    for (let vi = 0; vi < count; vi++) {
      let x = 0, y = 0, z = 0, tries = 0;
      do {
        x = 30 + Math.floor(rand() * (Math.min(xMax, SIZE_X) - 60));
        z = 30 + Math.floor(rand() * (SIZE_Z - 60));
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
  vein(MAT.COPPER_ORE, 60, 22, 52, 14);
  vein(MAT.IRON_ORE, 40, 10, 32, 12);
  vein(MAT.GOLD_ORE, 18, 4, 18, 9, 165); // gold hides under the massif

  /* ---- forests: small trees at landscape scale — a plot holds a grove ---- */
  const treeOcc = new Set();
  const clearOf = (x, z, r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
      if (treeOcc.has((z + dz) * SIZE_X + x + dx)) return false;
    return true;
  };
  const distToRiver = (x, z) => {
    let best = 999;
    for (const [wx, wz] of RIVER_WP) best = Math.min(best, Math.hypot(x - wx, z - wz));
    return best;
  };
  const plantPine = (x, z) => {
    const y0 = world.surfaceAt(x, z) + 1;
    const th = 2 + (hash2(x, z) * 2 | 0);
    for (let y = y0; y < y0 + th; y++) world.set(x, y, z, MAT.WOOD);
    const layers = [[1.6, 0], [1.1, 1], [0, 2]];
    for (const [r, dy] of layers)
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
        if (Math.hypot(dx, dz) <= r + 0.3 && world.get(x + dx, y0 + th - 1 + dy, z + dz) === MAT.AIR)
          world.set(x + dx, y0 + th - 1 + dy, z + dz, MAT.LEAF_PINE);
  };
  const plantBroad = (x, z) => {
    const y0 = world.surfaceAt(x, z) + 1;
    const th = 2 + (hash2(z, x) * 2 | 0);
    for (let y = y0; y < y0 + th; y++) world.set(x, y, z, MAT.WOOD);
    const cy = y0 + th;
    for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++)
      if (Math.hypot(dx, dy * 1.3, dz) <= 1.75 - hash2(x * 7 + dx + dy, z * 7 + dz - dy) * 0.55 &&
          world.get(x + dx, cy + dy, z + dz) === MAT.AIR)
        world.set(x + dx, cy + dy, z + dz, MAT.LEAF_BROAD);
  };
  for (let z = 5; z < SIZE_Z - 5; z++) for (let x = 5; x < SIZE_X - 5; x++) {
    if (Math.hypot(x - ARCH.x, z - ARCH.z) < 24) continue; // keep the arch's viewshed open
    const s = world.surfaceAt(x, z);
    if (s < 0 || world.get(x, s, z) !== MAT.GRASS) continue;
    const slope = Math.max(Math.abs(s - world.surfaceAt(x + 1, z)), Math.abs(s - world.surfaceAt(x, z + 1)));
    if (slope > 2) continue;
    const rv = hash2(x * 5 + 11, z * 5 + 7);
    const pineDens = (s >= 44 && s <= 86 && z < 198) ? 0.05 + 0.03 * smooth(0.1, 0.6, fbm(nPatch, x * 0.02, z * 0.02, 2)) : 0;
    const broadDens = (s >= SEA + 2 && s <= 46 && z > 168) ? 0.04 + 0.06 * smooth(27, 9, distToRiver(x, z)) : 0;
    if (rv < pineDens && clearOf(x, z, 2)) { plantPine(x, z); treeOcc.add(z * SIZE_X + x); }
    else if (rv > 1 - broadDens && clearOf(x, z, 2)) { plantBroad(x, z); treeOcc.add(z * SIZE_X + x); }
  }

  // moss where the falls' spray hits the rock
  if (FALLS) for (let dz = -6; dz <= 6; dz++) for (let dy = -8; dy <= 12; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = FALLS.x + dx, y = Math.round(FALLS.bottom) + dy, z = FALLS.z + dz;
    if (world.get(x, y, z) === MAT.STONE && hash2(x - y, z + y) < 0.5) world.set(x, y, z, MAT.MOSS);
  }

  /* ---- the named places ---- */
  const lmY = (x, z, lift = 5) => world.heightAt(x, z) + lift;
  const landmarks = [
    { key: 'summit', name: 'The Prow', x: 142, z: 117, y: lmY(142, 117, 8) },
    { key: 'lake', name: 'The Ewer', x: LAKE.x, z: LAKE.z, y: LAKE.level + 5 },
    { key: 'falls', name: 'Lantern Falls', x: FALLS ? FALLS.x : 199, z: FALLS ? FALLS.z : 152, y: FALLS ? FALLS.top + 5 : 66 },
    { key: 'cave', name: 'Glimmer Hollow', x: CAVE.mouth[0], z: CAVE.mouth[1], y: mouthY + 6 },
    { key: 'springs', name: 'The Kettles', x: 168, z: 186, y: 56 },
    { key: 'arch', name: "The Needle's Eye", x: ARCH.x, z: ARCH.z, y: ARCH.apex + 6 },
    { key: 'pipes', name: 'The Organ Pipes', x: 98, z: 132, y: lmY(98, 132, 7) },
    { key: 'harbor', name: 'Lantern Harbor', x: 233, z: 312, y: SEA + 7 },
    { key: 'stacks', name: 'The Wardens', x: 93, z: 273, y: SEA + 16 },
  ];

  return {
    world, landmarks,
    meta: { name: 'The Lantern', district: 1, seed: DISTRICT_SEED, sea: SEA, version: 2 },
  };
}

SG.SEA = SEA;
SG.buildDistrict01 = buildDistrict01;
})();
