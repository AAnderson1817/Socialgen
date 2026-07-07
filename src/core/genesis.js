/* Socialgen core — genesis v3 of District 01: "The Lantern, Four Watches".
   Implements design/SEASONS_BRIEF.md. One island holds the whole year:
   the Morningside (spring, east), the Noonlands (summer, south), the
   Evenlands (autumn, west), the Hush (winter, north) — placed by the
   renderer's own sun geometry. Exactly five authored edits touch rock and
   water (§3): the raised NE shelf, the re-plumbed river, the terraced
   falls, the carved Saddle and col, the sunk Saucer and paved Ford.
   Everything else is paint, planting, and survey.
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, World, REGION, GAZETTEER, SKELETONS, REGION_TARGET } = SG;

const SIZE_X = 384, SIZE_Y = 128, SIZE_Z = 384;
const SEA = 26;
const DISTRICT_SEED = 1866;     // fixed forever — District 01 is 1 of 1

/* ---- deterministic noise kit ---- */
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

/* the Sleeper (146,121): a recumbent snow figure on the Prow's SE face —
   stored mask, exact by test A4. Offsets from its gazetteer point. */
const SLEEPER_MASK = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [5, 1], [6, 1], [7, 2], [8, 2],   // body, head to hip
  [9, 3], [10, 3], [11, 4], [12, 4],                                        // legs, bent
  [3, -1], [4, -1],                                                         // the freed arm
  [0, 1], [1, 1],                                                           // the pillow-side shoulder
];
SG.SLEEPER_MASK = SLEEPER_MASK;

/* ======================= the authored composition ======================= */
function buildDistrict01() {
  const rand = mulberry32(DISTRICT_SEED);
  const nDetail = makeNoise(rand), nPatch = makeNoise(rand), nWiggle = makeNoise(rand), nRegion = makeNoise(rand);
  const world = new World(SIZE_X, SIZE_Y, SIZE_Z);
  const hf = new Float32Array(SIZE_X * SIZE_Z);

  /* -- landform anchors (v2 base + EDIT 1, the raised NE shelf) -- */
  const ANCHORS = [
    // island shelf
    [180, 180, 142, 34, 0.35], [225, 255, 120, 33, 0.38],
    [158, 128, 112, 36, 0.40], [278, 202, 82, 31, 0.42],
    // features
    [142, 117, 93, 100, 2.6],  // The Prow
    [117, 93, 60, 80, 3.0],
    [111, 111, 36, 72, 1.4],   // Organ Pipes crown
    [108, 150, 33, 64, 1.2],
    [168, 186, 39, 50, 2.0],   // Kettles terrace
    [198, 210, 62, 42, 1.7],   // midlands
    [222, 261, 84, 38, 1.5],   // south settlement plain
    [297, 177, 39, 46, 2.4],   // east headland
    [258, 192, 39, 36, 1.6],
    [105, 195, 45, 37, 2.0],   // west foot
    // EDIT 1 — the raised shelf: cold upper lip under the Prow's east
    // shoulder, a mid terrace carrying the river's upper reach at ~y62-66,
    // and low willow meads meeting the existing spring coast
    [238, 96, 40, 82, 1.1],    // upper lip (Hush side of the Thawline)
    [246, 140, 38, 67, 0.9],   // mid terrace
    [233, 170, 26, 65, 0.8],   // the falls lobe — the river leaves the shelf here
    [284, 122, 37, 34, 0.5],   // east meads
    [262, 66, 17, 38, 0.7],    // NE spur
  ];
  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
    const seabed = 14 + fbm(nDetail, x * 0.014, z * 0.014, 2) * 4;
    let h = seabed;
    for (const [ax, az, r, ah, pow] of ANCHORS) {
      const t = clamp(1 - Math.hypot(x - ax, z - az) / r, 0, 1);
      h = Math.max(h, seabed + (ah - seabed) * Math.pow(t, pow));
    }
    const plainCalm = 1 - 0.55 * smooth(69, 18, Math.hypot(x - 222, z - 261));
    // spur-and-gully ridging on the shelf so the Thawline has aspects to argue over
    const shelfW = smooth(58, 20, Math.hypot(x - 252, z - 112));
    h += fbm(nDetail, x * 0.03, z * 0.03, 4) * 3.4 * plainCalm * smooth(SEA - 6, SEA + 3, h);
    // ridge crests run east–west so their flanks face north and south — the
    // aspect the Thawline argues over (A6)
    h += Math.abs(fbm(nWiggle, x * 0.022, z * 0.055, 3)) * 9 * shelfW * smooth(SEA, SEA + 8, h);
    // two-lobe ocean fade: the main island, plus the shelf's own footing
    const fade = Math.max(1 - smooth(156, 189, Math.hypot(x - 195, z - 188)),
                          1 - smooth(118, 150, Math.hypot(x - 252, z - 108)));
    h = lerp(seabed, h, fade);
    hf[z * SIZE_X + x] = h;
  }

  const pullDown = (cx, cz, r, floor, pow = 1.6) => {
    for (let z = Math.max(0, cz - r) | 0; z <= Math.min(SIZE_Z - 1, cz + r); z++)
      for (let x = Math.max(0, cx - r) | 0; x <= Math.min(SIZE_X - 1, cx + r); x++) {
        const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
        const i = z * SIZE_X + x;
        hf[i] = lerp(hf[i], Math.min(hf[i], floor), Math.pow(t, pow));
      }
  };
  const pullUp = (cx, cz, r, target, pow = 1.6) => {
    for (let z = Math.max(0, cz - r) | 0; z <= Math.min(SIZE_Z - 1, cz + r); z++)
      for (let x = Math.max(0, cx - r) | 0; x <= Math.min(SIZE_X - 1, cx + r); x++) {
        const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
        const i = z * SIZE_X + x;
        hf[i] = Math.max(hf[i], lerp(hf[i], target, Math.pow(t, pow)));
      }
  };

  pullDown(216, 315, 38, 17);            // Lantern Harbor bay (at the brief's mouth)
  pullDown(312, 222, 20, 19);            // the Needle's Eye cove
  pullUp(142, 117, 15, 100, 0.7);        // the Prow's snow dome
  pullUp(111, 126, 18, 66, 0.5);         // flat crown of the Organ Pipes
  pullUp(297, 177, 15, 44, 0.5);         // flat cap on the east headland
  // EDIT 4 — the Saddle: bare-rock ridge (136,160)→(136,200), crest ≥77,
  // the Wick's knoll at its south end, the Snuffer's cold col at its north
  for (let z = 158; z <= 202; z += 4) {
    const wob = fbm(nWiggle, 9.1, z * 0.05, 2) * 4;
    pullUp(136 + wob, z, 8, 78 + fbm(nWiggle, 4.2, z * 0.09, 2) * 2, 0.8);
  }
  pullUp(136, 204, 7, 79, 0.8);          // the Wick
  pullDown(136, 156, 5, 72, 1.1);        // the Snuffer's col (still above treeline)
  // the Hush finger: a shadow-holding gully carved from the Prow's cold
  // shoulder south to the Kettles, so winter reaches them in fact
  for (let z = 138; z <= 184; z += 4)
    pullDown(164 + (z - 138) * 0.09, z, 7, 52 + (z - 138) * 0.05, 1.2);
  // EDIT 5 — the sunk Saucer (closed ice basin) …
  pullDown(150, 88, 9, 36, 1.2);
  for (let a = 0; a < 24; a++) { // …with a sealed rim
    const rx = 150 + Math.cos(a / 24 * Math.PI * 2) * 9.5;
    const rz = 88 + Math.sin(a / 24 * Math.PI * 2) * 9.5;
    pullUp(rx, rz, 3, 43, 1.0);
  }
  pullUp(218, 246, 5, 33, 0.9);          // the Almanac's knoll above the Ford
  // lowland woods stand on gentle rises (and clear the tree floor);
  // Rustfall rides its ridge so ember shows over the Greenvault (§12.1)
  for (const w of SG.WOODS) if (w.rise) for (const [bx, bz, br] of w.blobs) pullUp(bx, bz, br + 6, w.riseTarget || 34, 0.5);
  // buildable mesas and snowfield terraces in the Hush — winter must hold
  // real deeds, so its ground is composed, not left to the mountain
  pullUp(242, 90, 28, 80, 0.5);
  pullUp(214, 76, 26, 62, 0.5);
  pullUp(182, 112, 18, 52, 0.5);
  pullUp(160, 60, 18, 44, 0.5);
  pullUp(228, 60, 16, 52, 0.5);
  pullUp(130, 58, 20, 38, 0.5);
  pullUp(158, 44, 16, 36, 0.5);
  pullUp(108, 74, 15, 42, 0.5);
  pullUp(146, 64, 18, 40, 0.5);
  pullUp(120, 66, 16, 40, 0.5);
  pullUp(172, 52, 15, 38, 0.5);
  // EDIT 2/3 prep — the falls cliff: the shelf's south lip drops to the valley
  pullDown(224, 196, 14, 32, 1.3);       // valley floor below the tiers

  // beach aprons (composed shores, v2) — harbor apron follows the moved bay
  const apron = (cx, cz, r) => {
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) continue;
      const t = clamp(1 - Math.hypot(x - cx, z - cz) / r, 0, 1);
      const i = z * SIZE_X + x;
      const w2 = t * smooth(10, 5, Math.abs(hf[i] - SEA - 1));
      hf[i] = lerp(hf[i], SEA + 1.3 + (hf[i] - SEA - 1.3) * 0.3, w2);
    }
  };
  apron(225, 339, 33); apron(203, 336, 27); apron(183, 330, 27);
  apron(294, 294, 26); apron(320, 243, 20); apron(240, 328, 22);
  apron(102, 210, 21); apron(300, 148, 20); // NE meads shore below the shelf

  // The Organ Pipes (carve shortened: the south reach keeps its shore)
  for (let z = 84; z <= 160; z++) {
    const edge = 93 + fbm(nWiggle, 3.3, z * 0.033, 2) * 10;
    for (let x = 51; x < edge + 12; x++) {
      const i = z * SIZE_X + x;
      const inside = smooth(edge + 9, edge - 3, x);
      if (inside > 0 && hf[i] > 20 && hf[i] < 60) hf[i] = lerp(hf[i], 15, inside);
    }
  }
  const pipeMask = (x, z) => z >= 84 && z <= 183 && x <= 93 + fbm(nWiggle, 3.3, z * 0.033, 2) * 10 + 9 && hf[z * SIZE_X + x] >= 56;
  for (let z = 84; z <= 183; z++) for (let x = 51; x <= 117; x++)
    if (pipeMask(x, z)) hf[z * SIZE_X + x] += (hash2(x, z) - 0.35) * 3.4;

  /* -- The Ewer (unchanged bowl; the lid and dam come later) -- */
  const LAKE = { x: 158, z: 132, r: 13, level: 76, bed: 69 };
  for (let z = LAKE.z - LAKE.r - 3; z <= LAKE.z + LAKE.r + 3; z++)
    for (let x = LAKE.x - LAKE.r - 3; x <= LAKE.x + LAKE.r + 3; x++) {
      const dRel = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
      if (dRel > 1.25) continue;
      const i = z * SIZE_X + x;
      const bowl = LAKE.bed + dRel * dRel * 13;
      hf[i] = dRel <= 1 ? Math.min(hf[i], bowl) : Math.max(hf[i], LAKE.level + 2);
    }

  /* -- EDIT 2 + 3: the re-plumbed river with terraced falls --
     Source at the Milkwater below the Stilled Force; upper reach along the
     shelf terrace; three short drops with catch-pools at (230,178); then
     the Ford, the old lower meander, and the harbor mouth. */
  const RIVER_WP = [
    [243, 114, 63], [250, 126, 62.6], [254, 140, 62.2], [248, 156, 61.8],
    [238, 168, 61.4], [231, 176, 61],                    // crest of Lantern Falls
    [227, 183, 51.5],                                     // tier 1 → catch pool
    [223, 189, 42],                                       // tier 2 → catch pool
    [220, 196, 33],                                       // tier 3 → plunge
    [217, 212, 32], [214, 232, 31], [220, 237, 30.5],     // the old meander, rejoined
    [214, 250, 30], [211, 264, 29], [208, 282, 28],
    [210, 300, 26.5], [212, 312, 25],                     // the harbor mouth
  ];
  const riverWater = [];
  const gravelRim = new Set();
  const riverCells = new Set();
  const riverPts = [];
  for (let s = 0; s < RIVER_WP.length - 1; s++) {
    const [x1, z1, b1] = RIVER_WP[s], [x2, z2, b2] = RIVER_WP[s + 1];
    const seg = Math.hypot(x2 - x1, z2 - z1), steps = Math.ceil(seg * 3);
    const isDrop = b1 - b2 > 6;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      let x = lerp(x1, x2, t), z = lerp(z1, z2, t);
      const bed = lerp(b1, b2, isDrop ? smooth(0.25, 0.55, t) : t);
      if (!isDrop) {
        const w = fbm(nWiggle, x * 0.033 + 7, z * 0.033, 2) * 3.2;
        x += w * 0.7; z += w * 0.4;
      }
      if (k % 2 === 0) riverPts.push([Math.round(x), Math.round(z)]);
      const r = isDrop ? 2.2 : 3.2;
      const R2 = isDrop ? 5 : 10;
      for (let dz = -R2; dz <= R2; dz++) for (let dx = -R2; dx <= R2; dx++) {
        const cx = Math.round(x + dx), cz = Math.round(z + dz);
        if (cx < 0 || cx >= SIZE_X || cz < 0 || cz >= SIZE_Z) continue;
        const dd = Math.hypot(cx - x, cz - z);
        const i = cz * SIZE_X + cx;
        if (dd < r) {
          hf[i] = Math.min(hf[i], bed + (dd / r) * (dd / r) * 1.8);
          riverCells.add(i);
          if (bed + 1 > SEA - 1) riverWater.push({ x: cx, z: cz, level: Math.round(bed) + 1 });
        } else if (dd < r + 2.2) {
          gravelRim.add(i);
          // a perched reach holds its water: the rim is a levee, never lower
          // than the waterline (the shelf falls east; the river must not hang)
          if (!isDrop) hf[i] = Math.max(hf[i], bed + 1.6);
        } else if (!isDrop && dd < r + 8) {
          // …and the levee falls away as an embankment, not a curtain wall
          hf[i] = Math.max(hf[i], bed + 1.6 - (dd - r - 2.2) * 2.6);
        }
      }
    }
  }
  const FALLS = { x: 230, z: 178, top: 61, bottom: 33 }; // gazetteer point, tiers around it
  // catch pools under tiers 1-2, plunge pool under tier 3
  for (const [px, pz, lv] of [[227, 184, 52.5], [223, 190, 43], [219, 199, 34]]) {
    pullDown(px, pz, 4, lv - 2, 1.1);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
      if (dx * dx + dz * dz <= 9) riverWater.push({ x: px + dx, z: pz + dz, level: Math.round(lv) });
  }
  // EDIT 5 — Longstride Ford: a hard gravel sill, shin-deep, stepped banks
  for (let dz = -4; dz <= 4; dz++) for (let dx = -6; dx <= 6; dx++) {
    const i = (250 + dz) * SIZE_X + 214 + dx;
    if (riverCells.has(i)) hf[i] = Math.max(hf[i], 29.6);
  }

  /* -- The Kettles (unchanged, now held by winter) -- */
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
  // Milkwater catch-basins at the Force's foot, perched behind gravel sills
  const milkCells = [];
  for (const [px, pz, pr] of [[241, 110, 2.8], [245, 113, 2.2], [237, 113, 2.0]]) {
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const dd = Math.hypot(dx, dz);
      const cx = px + dx, cz = pz + dz, i = cz * SIZE_X + cx;
      if (dd < pr) { hf[i] = Math.min(hf[i], 61.8); milkCells.push({ x: cx, z: cz, level: 63 }); }
      else if (dd < pr + 1.8) { hf[i] = Math.max(hf[i], 63.6); gravelRim.add(i); }
    }
  }
  // the Force's own cliff: upper lip held high behind it
  pullUp(237, 99, 9, 80, 0.7);

  /* ---- quantize ---- */
  const hi = new Int16Array(SIZE_X * SIZE_Z);
  for (let i = 0; i < hf.length; i++) hi[i] = Math.max(1, Math.round(hf[i]));
  const hAt = (x, z) => (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) ? 1 : hi[z * SIZE_X + x];

  /* ================== the region map (§3) ==================
     Fully authored boundary curves — the watches are drawn, not discovered.
     FF: the First Frost / Thawline latitude (winter's south edge, dipping
     to the Snuffer and around the Ewer). TL: winter's east edge on the
     shelf (the Thawline proper, swerving so the Force stays winter and the
     Milkwater spring). WL: the west line (autumn's east edge — the Organ
     Pipes country and the Saddle). NL + RX: summer's north edge, meeting
     the river at Longstride Ford and following it to the harbor mouth,
     which sits deliberately on the spring–summer seam. */
  const regionId = new Uint8Array(SIZE_X * SIZE_Z);
  const isLand = i => hi[i] >= SEA - 1;
  const interp = (pts, v) => {
    if (v <= pts[0][0]) return pts[0][1];
    for (let k = 1; k < pts.length; k++)
      if (v <= pts[k][0]) {
        const t = (v - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]);
        return lerp(pts[k - 1][1], pts[k][1], t);
      }
    return pts[pts.length - 1][1];
  };
  const wigL = (seed, v, amp) => fbm(nRegion, seed, v * 0.03, 2) * amp + fbm(nRegion, seed + 9, v * 0.09, 2) * amp * 0.8;
  const FF_PTS = [[56, 60], [68, 70], [80, 62], [92, 76], [100, 70], [108, 88], [116, 96], [124, 112], [130, 128], [136, 152], [144, 146],
    [154, 138], [166, 130], [180, 123], [198, 117], [216, 116], [232, 120], [250, 126]];
  const TL_PTS = [[36, 244], [60, 242], [84, 246], [100, 242], [108, 236], [116, 240], [126, 248]];
  // WL and NL meander by hand — a seam is a walked line, never a radius
  const WL_PTS = [[84, 130], [92, 140], [100, 136], [110, 148], [120, 144], [128, 150], [136, 146],
    [152, 141], [158, 133], [163, 142], [168, 132], [173, 141], [178, 131], [183, 140], [188, 130], [193, 139], [198, 131], [204, 136], [210, 128], [216, 120],
    [224, 126], [232, 114], [240, 118], [248, 108], [258, 112], [268, 102], [280, 108],
    [290, 98], [304, 102], [316, 94]];
  // summer's north edge: over the Saddle's foot, through Longstride Ford,
  // then diagonally to the SE coast — the whole southern strand is noon
  // country (§5 files Lantern Harbor under the Noonlands)
  const NL_PTS = [[92, 236], [104, 222], [116, 228], [128, 208], [136, 206], [146, 216], [154, 206],
    [164, 222], [172, 214], [182, 230], [190, 226], [198, 240], [206, 238], [214, 250],
    [224, 246], [236, 260], [248, 252], [258, 266], [268, 260], [280, 278], [290, 272],
    [300, 294], [308, 288], [318, 298]];
  // the authored lines keep their shapes; only their offsets self-calibrate
  // toward §3's land shares (deterministic fixed-count loop; the Morningside
  // is the remainder, so three tuned lines pin all four shares)
  // offsets are PINNED at the triple points: the Wick and the Snuffer are
  // fixed geography; calibration may only breathe far from them
  let offFF = 0, offWL = 0, offNL = 0;
  const pinFF = x => clamp(Math.abs(x - 136) / 50, 0, 1);
  const pinWL = z => (z >= 150 && z <= 208) ? 0
    : z > 208 ? clamp((z - 208) / 12, 0, 1) : clamp((150 - z) / 24, 0, 1);
  const pinNL = x => clamp(Math.abs(x - 136) / 60, 0, 1);
  const assign = () => {
    for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
      const i = z * SIZE_X + x;
      let r;
      const inHushNorth = z <= interp(FF_PTS, x) + offFF * pinFF(x) + wigL(3.1, x, 4) &&
        x <= interp(TL_PTS, z) + offFF * 0.6 + wigL(7.7, z, 4);
      if (inHushNorth) r = REGION.HUSH;
      else if (Math.min(x, 384) <= Math.min(interp(WL_PTS, z) + offWL * pinWL(z) + wigL(5.3, z, 3.5), z < 150 ? 158 : z <= 208 ? 144 : 999)) r = REGION.EVEN;
      else if (z >= interp(NL_PTS, x) + offNL * pinNL(x) + wigL(6.1, x, 5)) r = REGION.NOON;
      else r = REGION.MORNING;
      regionId[i] = r;
    }
    // the Hush finger is authored: spine (164,132)→(168,186) down to the
    // Kettles, spring flanking it on both sides
    for (let z = 126; z <= 196; z++) for (let x = 144; x <= 190; x++) {
      const t = clamp((z - 132) / (186 - 132), 0, 1);
      const spineX = 164 + t * 4;
      const d = Math.abs(x - spineX) + fbm(nRegion, x * 0.07, z * 0.07, 2) * 2;
      const i = z * SIZE_X + x;
      if (z >= 130 && z <= 190 && d <= 5.5) regionId[i] = REGION.HUSH;
      else if (z >= 140 && z <= 196 && d > 5.5 && d <= 15 && regionId[i] === REGION.HUSH && x > 140)
        regionId[i] = REGION.MORNING;
    }
  };
  for (let iter = 0; iter < 6; iter++) {
    assign();
    const count = [0, 0, 0, 0, 0];
    let land = 0;
    for (let i = 0; i < regionId.length; i++) if (isLand(i)) { land++; count[regionId[i]]++; }
    offFF = clamp(offFF + (0.18 - count[REGION.HUSH] / land) * 200, -26, 26);
    offWL = clamp(offWL + (0.22 - count[REGION.EVEN] / land) * 200, -20, 38);
    offNL = clamp(offNL - (0.35 - count[REGION.NOON] / land) * 200, -44, 26);
  }
  assign();
  if (globalThis.SG_DEBUG_OFFSETS) console.log('  · offsets', { offFF, offWL, offNL });
  // seam meadows: the walked boundaries cross gentle ground — grooming the
  // terrain along NL and southern WL so straddling deeds are terraceable.
  // Carved water (riverbed, pool rims, sills) is never groomed over.
  const carved = new Set([...riverCells, ...gravelRim]);
  for (const c of springCells) carved.add(c.z * SIZE_X + c.x);
  for (const c of milkCells) carved.add(c.z * SIZE_X + c.x);
  for (const [px, pz] of [[227, 184], [223, 190], [219, 199]])
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
      carved.add((pz + dz) * SIZE_X + px + dx);
  for (let k = 0; k < NL_PTS.length - 1; k++) {
    const [x1, z1] = NL_PTS[k], [x2, z2] = NL_PTS[k + 1];
    const steps = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 6);
    for (let t = 0; t <= steps; t++) {
      const px = lerp(x1, x2, t / steps), pz = lerp(z1, z2, t / steps) + offNL * pinNL(px);
      const i0 = Math.round(pz) * SIZE_X + Math.round(px);
      if (hf[i0] > SEA - 0.5 && hf[i0] < 55) {
        // the Longstride keeps dry feet: banked a cube above the strand —
        // except at the Ford itself, which is authored as a wet crossing
        const target = Math.hypot(px - 214, pz - 250) > 10
          ? Math.max(hf[i0], SEA + 3) : hf[i0];
        for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
          const ii = (Math.round(pz) + dz) * SIZE_X + Math.round(px) + dx;
          const w2 = 0.5 * (1 - Math.hypot(dx, dz) / 10);
          if (w2 > 0 && hf[ii] > SEA - 0.5 && !carved.has(ii)) hf[ii] = lerp(hf[ii], target, w2);
        }
      }
    }
  }
  const groomLine = (pts, useX, lo, hi, off, pin, hCap = 55) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [a1, b1] = pts[k], [a2, b2] = pts[k + 1];
      const steps = Math.ceil(Math.hypot(a2 - a1, b2 - b1) / 6);
      for (let t = 0; t <= steps; t++) {
        const a = lerp(a1, a2, t / steps), b = lerp(b1, b2, t / steps) + off * pin(a);
        const px = useX ? a : b, pz = useX ? b : a;
        if ((useX ? a : a) < lo || a > hi) continue;
        const i0 = Math.round(pz) * SIZE_X + Math.round(px);
        if (i0 < 0 || i0 >= hf.length || hf[i0] <= SEA - 0.5 || hf[i0] >= hCap) continue;
        const target = Math.max(hf[i0], SEA + 3); // seam paths bank above the strand
        for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
          const ii = (Math.round(pz) + dz) * SIZE_X + Math.round(px) + dx;
          const w2 = 0.55 * (1 - Math.hypot(dx, dz) / 11);
          if (w2 > 0 && hf[ii] > SEA - 0.5 && !carved.has(ii)) hf[ii] = lerp(hf[ii], target, w2);
        }
      }
    }
  };
  groomLine(WL_PTS, false, 208, 320, offWL, pinWL); // autumn's south seam
  groomLine(FF_PTS, true, 56, 120, offFF, pinFF);   // the west First Frost
  // the Thawline meadow: where winter trades with spring on the shelf, the
  // seam is a mown strip — straddling deeds there must be terraceable
  groomLine(FF_PTS, true, 190, 250, offFF, pinFF, 84);
  groomLine(TL_PTS, false, 36, 126, offFF * 0.6, () => 1, 84); // the mesa-country east edge
  // grooming touched hf after the quantize pass — re-bake the integer grid
  for (let i = 0; i < hf.length; i++) hi[i] = Math.max(1, Math.round(hf[i]));
  // final rule pass: summer never borders winter, whatever calibration did
  for (let z = 1; z < SIZE_Z - 1; z++) for (let x = 1; x < SIZE_X - 1; x++) {
    const i = z * SIZE_X + x;
    if (regionId[i] !== REGION.NOON) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (regionId[(z + dz) * SIZE_X + x + dx] === REGION.HUSH) { regionId[i] = REGION.MORNING; break; }
  }
  // topology repair: no summer–winter adjacency; ≤2 regions in any 2×2 window
  // except near the two authored triple points (A2)
  const triples = [[136, 204], [136, 156]];
  const nearTriple = (x, z) => triples.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 18);
  for (let sweep = 0; sweep < 25; sweep++) {
    let changed = 0;
    for (let z = 1; z < SIZE_Z - 1; z++) for (let x = 1; x < SIZE_X - 1; x++) {
      const i = z * SIZE_X + x;
      if (!isLand(i)) continue;
      const r = regionId[i];
      // summer never borders winter: the offending summer column turns spring
      if (r === REGION.NOON) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (z + dz) * SIZE_X + x + dx;
          if (isLand(j) && regionId[j] === REGION.HUSH) { regionId[i] = REGION.MORNING; changed++; break; }
        }
      }
    }
    for (let z = 0; z < SIZE_Z - 1; z++) for (let x = 0; x < SIZE_X - 1; x++) {
      const idxs = [z * SIZE_X + x, z * SIZE_X + x + 1, (z + 1) * SIZE_X + x, (z + 1) * SIZE_X + x + 1];
      const land = idxs.map(isLand);
      if (land.filter(Boolean).length < 3) continue;
      const w = idxs.map(i2 => regionId[i2]);
      const uniq = [...new Set(w.filter((_, k) => land[k]))];
      const allowed = nearTriple(x, z) ? 3 : 2;
      if (uniq.length > allowed) {
        const counts = {};
        w.forEach((r, k) => { if (land[k]) counts[r] = (counts[r] || 0) + 1; });
        const lone = uniq.sort((a, b) => counts[a] - counts[b])[0];
        const k = w.findIndex((r, k2) => r === lone && land[k2]);
        const keep = uniq.sort((a, b) => counts[b] - counts[a])[0];
        regionId[idxs[k]] = keep;
        changed++;
      }
    }
    if (changed === 0) break;
  }

  /* seam field: distance to the nearest differently-regioned land column,
     plus which region lies across the nearest boundary (chamfer transform) */
  const seamDist = new Uint8Array(SIZE_X * SIZE_Z).fill(63);
  const seamOther = new Uint8Array(SIZE_X * SIZE_Z);
  for (let z = 1; z < SIZE_Z - 1; z++) for (let x = 1; x < SIZE_X - 1; x++) {
    const i = z * SIZE_X + x;
    if (!isLand(i)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (z + dz) * SIZE_X + x + dx;
      if (isLand(j) && regionId[j] !== regionId[i]) { seamDist[i] = 0; seamOther[i] = regionId[j]; break; }
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const fwd = pass === 0;
    for (let z = fwd ? 1 : SIZE_Z - 2; fwd ? z < SIZE_Z - 1 : z > 0; z += fwd ? 1 : -1)
      for (let x = fwd ? 1 : SIZE_X - 2; fwd ? x < SIZE_X - 1 : x > 0; x += fwd ? 1 : -1) {
        const i = z * SIZE_X + x;
        for (const [dx, dz] of fwd ? [[-1, 0], [0, -1]] : [[1, 0], [0, 1]]) {
          const j = (z + dz) * SIZE_X + x + dx;
          if (seamDist[j] + 1 < seamDist[i]) { seamDist[i] = seamDist[j] + 1; seamOther[i] = seamOther[j]; }
        }
      }
  }

  /* ================== materials (§4/§5) ================== */
  const regionGround = { [REGION.MORNING]: MAT.GRASS_SPRING, [REGION.NOON]: MAT.GRASS, [REGION.EVEN]: MAT.GRASS_DUN };
  const northness = (x, z) => clamp((hAt(x, z + 1) - hAt(x, z - 1)) / 3, -1, 1); // + faces north (shade)
  const snowlineAt = (x, z) => 34 - 10 * northness(x, z) + fbm(nPatch, x * 0.06, z * 0.06, 2) * 3;

  for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++) {
    const h = Math.min(hAt(x, z), SIZE_Y - 6);
    const i = z * SIZE_X + x;
    const r = regionId[i];
    const slope = Math.max(
      Math.abs(h - hAt(x + 1, z)), Math.abs(h - hAt(x - 1, z)),
      Math.abs(h - hAt(x, z + 1)), Math.abs(h - hAt(x, z - 1)));
    let nearWaterDepth = 0;
    for (let dz = -4; dz <= 4; dz += 2) for (let dx = -4; dx <= 4; dx += 2)
      if (hAt(x + dx, z + dz) < SEA - 1) nearWaterDepth = 1;

    const inPipes = pipeMask(x, z);
    let top, under = MAT.SOIL, deep = MAT.STONE, topDepth = 1, underDepth = 2;

    if (r === REGION.HUSH) {
      if (h >= snowlineAt(x, z)) { top = MAT.SNOW; under = MAT.STONE; if (h >= 60) topDepth = 2; }
      else { top = hash2(x, z) < 0.5 ? MAT.GRAVEL : MAT.STONE; under = MAT.STONE; }
    } else {
      top = regionGround[r];
      // seam dithering: within 12 cubes of a boundary the two grounds interleave
      if (seamDist[i] <= 12) {
        const other = seamOther[i];
        if (other === REGION.HUSH || r === REGION.HUSH) {
          // the Thawline (and every winter edge): aspect decides, not dice —
          // snow fingers down shaded gullies, meads climb the lit spurs
          const sd = r === REGION.HUSH ? seamDist[i] : -seamDist[i];
          if (h >= 46 - 20 * northness(x, z) - 1.5 * sd)
            { top = MAT.SNOW; under = MAT.STONE; }
        } else if (other !== REGION.NONE && regionGround[other] !== undefined) {
          const p = 0.5 * (1 - seamDist[i] / 12);
          if (hash2(x * 3 + 1, z * 3 + 2) < p) top = regionGround[other];
        }
      }
      // spring flower carpets in the meads — patchy, rationed
      if (top === MAT.GRASS_SPRING && slope <= 2 && h < 52 &&
          fbm(nPatch, x * 0.045 + 11, z * 0.045, 2) > 0.33 && hash2(x + 7, z + 3) < 0.5)
        top = MAT.FLOWERS_WHITE;
    }
    // the Gilt Meadow: one field the sun paid in full
    if (Math.hypot(x - 168, z - 278) < 12 && r === REGION.NOON && hash2(x + 1, z + 9) < 0.7) top = MAT.FLOWERS_GOLD;

    if (inPipes) { top = MAT.BASALT; under = MAT.BASALT; deep = MAT.BASALT; }
    else if (h < SEA - 5) { top = MAT.GRAVEL; under = MAT.GRAVEL; underDepth = 1; }
    else if (h < SEA + 2 && nearWaterDepth) { top = MAT.SAND; under = MAT.SAND; }
    else if (h >= 78 || slope >= 3) {
      if (!(r === REGION.HUSH && top === MAT.SNOW)) { top = MAT.STONE; under = MAT.STONE; }
      // aerial perspective: high stone dithers into paler gravel before snow
      if (top === MAT.STONE && h > 68 && hash2(x + 5, z + 5) < 0.3 + 0.3 * smooth(68, 96, h)) top = MAT.GRAVEL;
    }
    else if (gravelRim.has(i)) top = MAT.GRAVEL;
    if (riverCells.has(i) && h > SEA - 5) { top = MAT.GRAVEL; under = MAT.GRAVEL; }

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
  for (let z = LAKE.z - LAKE.r; z <= LAKE.z + LAKE.r; z++)      // the Ewer
    for (let x = LAKE.x - LAKE.r; x <= LAKE.x + LAKE.r; x++)
      if (Math.hypot(x - LAKE.x, z - LAKE.z) <= LAKE.r)
        for (let y = hAt(x, z) + 1; y <= LAKE.level; y++)
          if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.WATER);
  for (const { x, z, level } of riverWater)
    for (let y = hAt(x, z) + 1; y <= Math.min(level, SIZE_Y - 1); y++)
      if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.WATER);
  // the falls tiers: three short sheets (a broken fall reads taller)
  for (const [fx, fz, top, bot] of [[229, 180, 61, 52], [225, 186, 52, 43], [221, 192, 43, 33]]) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > 1) continue;
      for (let y = bot; y <= top + 1; y++)
        if (world.get(fx + dx, y, fz + dz) === MAT.AIR) world.set(fx + dx, y, fz + dz, MAT.WATER);
    }
  }
  for (const { x, z, level } of springCells)                    // the Kettles
    for (let y = hAt(x, z) + 1; y <= level; y++)
      if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.SPRING);
  for (const { x, z, level } of milkCells)                      // the Milkwater
    for (let y = hAt(x, z) + 1; y <= level; y++)
      if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.MILKWATER);

  /* ---- ice (§5 Hush, §8 seams) ---- */
  // EDIT 2 — the Ewer's old outflow notch, ice-dammed
  for (let dz = -3; dz <= 3; dz++) for (let dx = -2; dx <= 2; dx++) {
    const x = 172 + dx, z = 138 + dz;
    if (Math.hypot(dx, dz) > 3.2) continue;
    for (let y = 68; y <= 77; y++)
      if (world.get(x, y, z) === MAT.AIR || world.get(x, y, z) === MAT.WATER) world.set(x, y, z, MAT.ICE);
  }
  // the Ewer's lid: solid ice on the shaded north half, open water south,
  // a dithered fringe between, treasure flush in the lid
  for (let z = LAKE.z - LAKE.r; z <= LAKE.z + LAKE.r; z++)
    for (let x = LAKE.x - LAKE.r; x <= LAKE.x + LAKE.r; x++) {
      if (world.get(x, LAKE.level, z) !== MAT.WATER) continue;
      const fringe = (z - LAKE.z) + (hash2(x * 5, z * 5) - 0.5) * 4;
      if (fringe < 0) world.set(x, LAKE.level, z, MAT.ICE);
    }
  let lidOre = 0;
  for (let z = LAKE.z - LAKE.r; z <= LAKE.z + LAKE.r && lidOre < 8; z++)
    for (let x = LAKE.x - LAKE.r; x <= LAKE.x + LAKE.r && lidOre < 8; x++)
      if (world.get(x, LAKE.level, z) === MAT.ICE && hash2(x * 9 + 4, z * 9 + 1) < 0.06) {
        world.set(x, LAKE.level, z, lidOre % 3 === 2 ? MAT.CRYSTAL : MAT.GOLD_ORE);
        lidOre++;
      }
  // the Saucer: what the ice catches, the ice keeps — surface 100% ice
  for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) {
    if (Math.hypot(dx, dz) > 8.6) continue;
    const x = 150 + dx, z = 88 + dz;
    const g = world.surfaceAt(x, z);
    if (g < 41) {
      for (let y = g + 1; y < 41; y++) if (world.get(x, y, z) === MAT.AIR) world.set(x, y, z, MAT.WATER);
      world.set(x, 41, z, hash2(x * 3, z * 7) < 0.06 ? MAT.ICE_BLUE : MAT.ICE);
    }
  }
  for (const [bx, bz] of [[160, 94], [161, 91], [158, 97]]) // sawn blocks: winter's labor
    for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++)
      world.set(bx + dx, world.surfaceAt(bx, bz) + 1 + dy, bz + dz, MAT.ICE);
  // the Stilled Force: a flame of ice above a pool of jade
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const x = 240 + dx, z = 104 + dz;
    if (Math.abs(dx) + Math.abs(dz) > 3) continue;
    const heart = Math.abs(dx) <= 0 && Math.abs(dz) <= 1;
    for (let y = 64; y <= 79; y++) {
      const id = world.get(x, y, z);
      if (id === MAT.AIR || id === MAT.WATER)
        world.set(x, y, z, heart && y >= 68 && y <= 75 ? MAT.ICE_BLUE : MAT.ICE);
    }
  }
  // mesa tarns: small lidded pools so winter's deeds can front ice
  for (const [tx, tz, tr] of [[243, 88, 6], [215, 74, 5], [182, 110, 4], [130, 56, 4], [146, 62, 4]]) {
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      if (Math.hypot(dx, dz) > tr) continue;
      const x = tx + dx, z = tz + dz;
      const g = world.surfaceAt(x, z);
      if (g > SEA + 4) { world.set(x, g, z, MAT.ICE); world.set(x, g - 1, z, MAT.WATER); }
    }
  }
  // authored Hush treasure: ore pockets sealed under walkable ice (§9),
  // outside every commons hold — winter's iceLocked ledger is stocked
  for (const [px, pz] of [[160, 62], [242, 94], [214, 80], [182, 114], [130, 60], [146, 66], [120, 64]]) {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.hypot(dx, dz) > 2.4) continue;
      const x = px + dx, z = pz + dz;
      const g = world.surfaceAt(x, z);
      if (g > SEA) {
        world.set(x, g + 1, z, MAT.ICE);
        if (hash2(x + 2, z + 8) < 0.7) world.set(x, g - 1, z, hash2(x, z) < 0.4 ? MAT.CRYSTAL : MAT.GOLD_ORE);
      }
    }
  }

  /* ---- legacy features, kept at their surveyed points ---- */
  // Glimmer Hollow (153,160) — unchanged from v2
  const CAVE = { mouth: [153, 160], chamber: [142, 142] };
  const mouthY = world.surfaceAt(153, 160);
  const chamberY = mouthY - 8;
  const carveSphere = (cx, cy, cz, r2, mat = MAT.AIR) => {
    for (let z = Math.floor(cz - r2); z <= cz + r2; z++)
      for (let y = Math.floor(cy - r2); y <= cy + r2; y++)
        for (let x = Math.floor(cx - r2); x <= cx + r2; x++)
          if (Math.hypot(x - cx, y - cy, z - cz) <= r2 && world.get(x, y, z) !== MAT.BEDROCK)
            world.set(x, y, z, mat);
  };
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    carveSphere(lerp(CAVE.mouth[0], CAVE.chamber[0], t),
                lerp(mouthY + 1.8, chamberY + 3, t),
                lerp(CAVE.mouth[1], CAVE.chamber[1], t), 3.2);
  }
  carveSphere(CAVE.chamber[0], chamberY + 3, CAVE.chamber[1], 8.5);
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
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    if (Math.hypot(dx, dz) > 4.6) continue;
    const x = CAVE.chamber[0] + dx, z = CAVE.chamber[1] + dz;
    for (let y = chamberY - 5; y <= chamberY - 4; y++)
      if (world.get(x, y, z) === MAT.AIR && world.get(x, y - 1, z) !== MAT.AIR)
        world.set(x, y, z, MAT.WATER);
  }
  for (let dz = -3; dz <= 3; dz++) for (let dy = -1; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = CAVE.mouth[0] + dx, y = mouthY + dy, z = CAVE.mouth[1] + 3 + dz;
    const id = world.get(x, y, z);
    if ((id === MAT.STONE || id === MAT.GRASS_SPRING || id === MAT.GRASS) && hash2(x + y, z - y) < 0.6)
      world.set(x, y, z, MAT.MOSS);
  }

  // The Needle's Eye (312,222) — unchanged
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
  for (const side of [-1, 1]) {
    const lx = Math.round(ARCH.x + side * ARCH.span * ARCH.dirX);
    const lz = Math.round(ARCH.z + side * ARCH.span * ARCH.dirZ);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
      for (let y = 1; y <= SEA - 2; y++) {
        const id = world.get(lx + dx, y, lz + dz);
        if (id === MAT.AIR || id === MAT.WATER) world.set(lx + dx, y, lz + dz, MAT.STONE);
      }
  }

  // The Wardens, at their §9 water (40,324): four basalt watchers offshore
  for (const [sx2, sz2, r2, top] of [[40, 324, 3.4, SEA + 10], [52, 332, 2.7, SEA + 6], [46, 310, 3.0, SEA + 13], [60, 320, 2.3, SEA + 4]]) {
    for (let y = 1; y <= top; y++) {
      const rr = r2 * (1 - 0.25 * (y / top));
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
        if (Math.hypot(dx, dz) <= rr)
          world.set(sx2 + dx, y, sz2 + dz, y === top ? MAT.MOSS : MAT.BASALT); // moss caps: neutral in any watch
    }
  }

  /* ---- new places ---- */
  // the mole and the Lantern itself: the light the island is named for
  for (let k = 0; k <= 12; k++) {
    const x = 206 + Math.round(k * 0.5), z = 312 + k;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 0; dz++) {
      for (let y = 20; y <= SEA + 1; y++) world.set(x + dx, y, z + dz, MAT.BASALT);
    }
  }
  {
    const bx = 212, bz = 322;
    for (let y = 20; y <= SEA + 8; y++)
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
        world.set(bx + dx, y, bz + dz, MAT.BASALT);
    const ly = SEA + 9; // the lamp room: flame seated in its own shadow
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      if (Math.abs(dx) + Math.abs(dz) === 2) world.set(bx + dx, ly, bz + dz, MAT.BASALT);
    world.set(bx, ly, bz, MAT.CRYSTAL);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      world.set(bx + dx, ly + 1, bz + dz, MAT.BASALT);
    world.set(bx, ly + 2, bz, MAT.BRASS);
  }
  // the Almanac: a flat glacial boulder, four brass plates on its faces
  {
    const ax = 218, az = 246, ay = world.surfaceAt(218, 246);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      for (let dy = 1; dy <= 2; dy++) world.set(ax + dx, ay + dy, az + dz, MAT.STONE);
    world.set(ax + 2, ay + 2, az, MAT.BRASS); world.set(ax - 2, ay + 2, az, MAT.BRASS);
    world.set(ax, ay + 2, az + 2, MAT.BRASS); world.set(ax, ay + 2, az - 2, MAT.BRASS);
  }
  // the Tithe: a stone jetty below the Pipes; the sea has not said why
  for (let x = 80; x <= 96; x++) for (let dz = 0; dz <= 1; dz++)
    for (let y = 20; y <= SEA + 1; y++) world.set(x, y, 158 + dz, MAT.STONE);
  // the Burnt Garth: something was celebrated here once, or ended
  {
    const gy = world.surfaceAt(70, 224);
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
      if (world.surfaceAt(70 + dx, 224 + dz) > SEA) {
        const y = world.surfaceAt(70 + dx, 224 + dz);
        world.set(70 + dx, y, 224 + dz, MAT.SOIL);
        if ((Math.abs(dx) === 4 || Math.abs(dz) === 4) && hash2(dx + 9, dz + 9) < 0.5)
          world.set(70 + dx, y + 1, 224 + dz, MAT.BASALT);
      }
    void gy;
  }
  // the Sleeper: the stored stencil, laid on stepped shelves on the SE face
  for (const [dx, dz] of SLEEPER_MASK) {
    const x = 146 + dx, z = 121 + dz;
    const g = world.surfaceAt(x, z);
    world.set(x, g, z, MAT.SNOW);
    world.set(x, g + 1, z, MAT.SNOW);
  }
  // Seep Garden: one green hollow where a hot seep keeps a garden (exempted)
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    const dd = Math.hypot(dx, dz);
    if (dd > 4.6) continue;
    const x = 156 + dx, z = 98 + dz;
    const g = world.surfaceAt(x, z);
    if (dd < 1.4) { world.set(x, g, z, MAT.GRAVEL); world.set(x, g + 1, z, MAT.SPRING); }
    else world.set(x, g, z, MAT.GRASS_SPRING);
  }
  // Snow Pocket: one stubborn drift in a shaded spring gully (exempted)
  for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
    if (Math.hypot(dx, dz) > 5.2) continue;
    const x = 248 + dx, z = 60 + dz;
    const g = world.surfaceAt(x, z);
    if (g > SEA && hash2(x + 3, z + 6) < 0.85) world.set(x, g, z, MAT.SNOW);
  }

  /* ---- ore veins (v2, plus the shelf gets its share) ---- */
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
  vein(MAT.GOLD_ORE, 18, 4, 18, 9, 165); // evening guards the gold
  // …and keeps a private seam under the Organ Pipes' crown
  for (let k = 0; k < 16; k++) {
    const gx2 = 109 + (k % 4) * 3, gz2 = 121 + Math.floor(k / 4) * 3;
    for (let y = 44; y <= 46; y++) if (world.get(gx2, y, gz2) === MAT.STONE) { world.set(gx2, y, gz2, MAT.GOLD_ORE); break; }
  }

  /* ---- flora: forests as places (§6) — see flora.js ---- */
  const flora = SG.buildFlora(world, {
    hash2, fbm, nPatch, nWiggle, regionId, seamDist, riverPts, hAt,
    SIZE_X, SIZE_Z, SEA, REGION,
  });

  // seam & Procession lantern posts: basalt shafts, brass caps
  const post = (x, z, tall = 3) => {
    const g = world.surfaceAt(x, z);
    if (g <= SEA) return;
    for (let y = 1; y <= tall; y++) world.set(x, g + y, z, MAT.BASALT);
    world.set(x, g + tall + 1, z, MAT.BRASS);
  };
  for (let k = 0; k < flora.procession.length; k += 5) post(flora.procession[k][0] + 2, flora.procession[k][1]);
  post(246, 124, 4);                         // First Lamp, exactly on the boundary
  { const g = world.surfaceAt(136, 204); world.set(136, g + 1, 204, MAT.BRASS); world.set(136, g + 2, 204, MAT.BRASS); } // the Prime Mark

  /* ---- seam polylines, traced from the region map itself ----
     (seams are surveyed lines, not commons strips — only the Procession
     walks as a commons track, so equinox plots stay buyable per §9) */
  const seams = traceSeams(regionId, isLand, SIZE_X, SIZE_Z);

  /* ---- the named places ---- */
  const landmarks = GAZETTEER.map(g => ({
    key: g.key, name: g.name, x: g.x, z: g.z, hold: g.hold, label: g.label,
    y: Math.max(world.heightAt(g.x, g.z), SEA) + (g.hold >= 10 ? 7 : 5),
  }));

  return {
    world, landmarks,
    geo: {
      regionId, seamDist, seams, riverPts,
      stems: flora.stems, stemSet: flora.stemSet, woodMaskId: flora.woodMaskId,
      edgeD: flora.edgeD, orchardPoints: flora.orchardPoints, glades: flora.glades,
      procession: flora.procession, waytrees: flora.waytrees, hermits: flora.hermits,
    },
    meta: { name: 'The Lantern, Four Watches', district: 1, seed: DISTRICT_SEED, sea: SEA, version: 3 },
  };
}

/* trace each region-pair boundary into an ordered polyline (for commons
   tracks, brass posts, and A2's sinuosity test) */
function traceSeams(regionId, isLand, sx, sz) {
  const pairs = new Map(); // "a|b" -> points
  for (let z = 1; z < sz - 1; z++) for (let x = 1; x < sx - 1; x++) {
    const i = z * sx + x;
    if (!isLand(i)) continue;
    const r = regionId[i];
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const j = (z + dz) * sx + x + dx;
      if (!isLand(j)) continue;
      const r2 = regionId[j];
      if (r2 !== r) {
        const key = Math.min(r, r2) + '|' + Math.max(r, r2);
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push([x, z]);
      }
    }
  }
  const seams = [];
  for (const [key, pts] of pairs) {
    // a region pair's boundary may be several disjoint reaches (the M|H
    // boundary alone is the Thawline AND both flanks of the Kettles finger):
    // chain each reach separately
    const unused = pts.slice();
    while (unused.length >= 12) {
      let cur = unused.reduce((a, b) => (b[0] + b[1] * 1.01 < a[0] + a[1] * 1.01 ? b : a));
      const chain = [cur];
      unused.splice(unused.indexOf(cur), 1);
      for (;;) {
        let bi = -1, bd = 1e9;
        for (let k = 0; k < unused.length; k++) {
          const d = Math.hypot(unused[k][0] - cur[0], unused[k][1] - cur[1]);
          if (d < bd) { bd = d; bi = k; }
        }
        if (bi < 0 || bd > 9) break;
        cur = unused.splice(bi, 1)[0];
        chain.push(cur);
      }
      const pl = chain.filter((_, k) => k % 4 === 0);
      if (pl.length >= 4) {
        const [a, b] = key.split('|').map(Number);
        seams.push({ a, b, pts: pl });
      }
      // crumb chains are skipped; keep chaining the rest
    }
  }
  return seams;
}

SG.SEA = SEA;
SG.buildDistrict01 = buildDistrict01;
})();
