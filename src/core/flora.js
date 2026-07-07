/* Socialgen core — flora v3: forests as places (design/SEASONS_BRIEF.md §6).
   THE ONE LAW: tree density outside an authored mask is exactly zero. Every
   stem belongs to a named wood, a riparian ribbon, an orchard, a hedgerow,
   or the hermit list. A tree with no address is a bug.
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, WOODS, REGION } = SG;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---- tree builders: small trees at landscape scale ---- */
function plant(world, x, z, leaf, opts = {}) {
  const trunkMat = opts.trunk || MAT.WOOD;
  const y0 = world.surfaceAt(x, z) + 1;
  if (y0 <= 1) return false;
  world.set(x, y0 - 1, z, MAT.FOREST_FLOOR); // stems always stand on leafmould
  const th = opts.th || 2 + ((opts.h1 || 0.5) * 2 | 0);
  for (let y = y0; y < y0 + th; y++) world.set(x, y, z, trunkMat);
  const shape = opts.shape || 'round';
  if (shape === 'none') return true;
  if (shape === 'cone') {
    const layers = opts.big ? [[2.4, 0], [1.8, 1], [1.2, 2], [0, 3]] : [[1.6, 0], [1.1, 1], [0, 2]];
    for (const [r, dy] of layers)
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
        if (Math.hypot(dx, dz) <= r + 0.3 && world.get(x + dx, y0 + th - 1 + dy, z + dz) === MAT.AIR)
          world.set(x + dx, y0 + th - 1 + dy, z + dz, leaf);
  } else if (shape === 'sparse') { // frost birch: airy, barely-there crown
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, -1, 0], [0, 0, 1], [0, -1, -1], [0, 1, 0]])
      if (world.get(x + dx, y0 + th + dy, z + dz) === MAT.AIR)
        world.set(x + dx, y0 + th + dy, z + dz, leaf);
  } else if (shape === 'flat') { // willow: wide, low, weeping
    for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 0; dy++) for (let dx = -2; dx <= 2; dx++)
      if (Math.hypot(dx, dy * 2, dz) <= 2.2 && world.get(x + dx, y0 + th + dy, z + dz) === MAT.AIR)
        world.set(x + dx, y0 + th + dy, z + dz, leaf);
  } else {
    const R = opts.big ? 3.0 : 2.05;
    const cy = y0 + th;
    for (let dz = -3; dz <= 3; dz++) for (let dy = -1; dy <= (opts.big ? 2 : 1); dy++) for (let dx = -3; dx <= 3; dx++)
      if (Math.hypot(dx, dy * 1.3, dz) <= R - (opts.h2 || 0.3) * 0.45 &&
          world.get(x + dx, cy + dy, z + dz) === MAT.AIR)
        world.set(x + dx, cy + dy, z + dz, leaf);
  }
  return true;
}
const SHAPE = {
  [MAT.LEAF_PINE]: 'cone', [MAT.LEAF_SPRUCE]: 'cone', [MAT.LEAF_FROST]: 'sparse',
  [MAT.LEAF_WILLOW]: 'flat',
};
const BIRCH_LEAVES = new Set([MAT.LEAF_FROST, MAT.LEAF_GOLD]);

function buildFlora(world, ctx) {
  const { hash2, fbm, nPatch, regionId, seamDist, riverPts, hAt, SIZE_X, SIZE_Z, SEA } = ctx;
  const stems = [];
  const stemSet = new Set();
  const occ = new Set(); // Chebyshev-3 spacing grid
  const key = (x, z) => z * SIZE_X + x;
  const clearOf = (x, z, r) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
      if (occ.has(key(x + dx, z + dz))) return false;
    return true;
  };
  const holdBlocked = (x, z) => SG.GAZETTEER.some(g => Math.hypot(x - g.x, z - g.z) <= g.hold + 1);
  const addStem = (x, z, leaf, kind, wood, opts = {}) => {
    if (!plant(world, x, z, leaf, { shape: SHAPE[leaf], h1: hash2(x, z), h2: hash2(z, x), ...opts })) return false;
    stems.push({ x, z, leaf, kind, wood });
    stemSet.add(key(x, z));
    occ.add(key(x, z));
    return true;
  };

  /* ---- wood masks + interior edge distance ----
     masks are clipped hard to the wood's own region (∪ seam grace ≤10):
     a wood may lap its seam, never cross into the next season */
  const woodMaskId = new Uint8Array(SIZE_X * SIZE_Z); // 0 = none, else wood index+1
  const edgeD = new Float32Array(SIZE_X * SIZE_Z);
  const HEART_KEYS = new Set(['copse', 'vaultglade']); // heart glades live inside their woods
  WOODS.forEach((w, wi) => {
    for (const [bx, bz, br] of w.blobs) {
      const R = Math.ceil(br + 4);
      for (let z = bz - R; z <= bz + R; z++) for (let x = bx - R; x <= bx + R; x++) {
        if (x < 0 || x >= SIZE_X || z < 0 || z >= SIZE_Z) continue;
        const i = key(x, z);
        if (regionId[i] !== w.region && seamDist[i] > 9) continue; // crowns spread 3: stays under A3's 12-cube seam grace
        // masks never lap a commons hold (the heart-glade holds excepted)
        if (SG.GAZETTEER.some(g => !HEART_KEYS.has(g.key) && Math.hypot(x - g.x, z - g.z) <= g.hold + 2)) continue;
        const wob = fbm(nPatch, x * 0.06 + wi * 5.1, z * 0.06, 2) * 3;
        const inside = br + wob - Math.hypot(x - bx, z - bz);
        if (inside > 0) {
          woodMaskId[i] = wi + 1;
          if (inside > edgeD[i]) edgeD[i] = inside;
        }
      }
    }
  });

  /* ---- glades: one per ~1200 mask columns, in the wood's south half ---- */
  const glades = [];
  WOODS.forEach((w, wi) => {
    let area = 0, cx = 0, cz = 0;
    for (let z = 0; z < SIZE_Z; z++) for (let x = 0; x < SIZE_X; x++)
      if (woodMaskId[key(x, z)] === wi + 1) { area++; cx += x; cz += z; }
    if (!area) return;
    cx /= area; cz /= area;
    const n = Math.max(1, Math.round(area / 1200));
    for (let g = 0; g < n; g++) {
      // deterministic pick in the south half, biased big for the first glade
      const [bx, bz, br] = w.blobs[g % w.blobs.length];
      const gx = Math.round(bx + (hash2(wi * 7 + g, 3) - 0.5) * br);
      const gz = Math.round(Math.max(cz, bz) + hash2(wi * 7 + g, 9) * br * 0.5);
      const gr = g === 0 ? 6 + hash2(wi, g) * 3 : 4 + hash2(g, wi) * 3;
      if (woodMaskId[key(gx, gz)] === wi + 1) glades.push({ wood: wi, x: gx, z: gz, r: gr });
    }
  });
  const gladeAt = (x, z) => glades.find(g => Math.hypot(x - g.x, z - g.z) <= g.r);

  /* ---- stems: stratified blue-noise, the forest law as one line ---- */
  const GROUNDS = new Set([MAT.GRASS, MAT.GRASS_SPRING, MAT.GRASS_DUN, MAT.SOIL, MAT.FOREST_FLOOR,
    MAT.SNOW, MAT.FLOWERS_WHITE]); // snow/flowers convert to leafmould under the trunk
  WOODS.forEach((w, wi) => {
    const treeline = w.treelineOverride || (w.region === REGION.HUSH ? 64 : 76);
    const mixEntries = Object.entries(w.mix);
    const tryPlant = (x, z, dense, seed) => {
      const i = key(x, z);
      const h = world.surfaceAt(x, z);
      if (h > treeline || h <= SEA + 2) return;
      const slope = Math.max(Math.abs(h - world.surfaceAt(x + 1, z)), Math.abs(h - world.surfaceAt(x, z + 1)));
      if (slope > (w.region === REGION.HUSH ? 3 : 2)) return; // spruce climbs
      if (!GROUNDS.has(world.get(x, h, z))) return;
      if (gladeAt(x, z) || holdBlocked(x, z)) return;
      if (Math.hypot(x - 312, z - 222) < 24) return; // the arch keeps its viewshed
      const p = dense
        * Math.pow(clamp(edgeD[i] / w.edgeFall, 0, 1), 2)
        * (0.7 + 0.6 * Math.abs(fbm(nPatch, x * 0.05 + wi, z * 0.05, 2)));
      if (hash2(x * 7 + wi + seed * 31, z * 7 + seed * 17) >= p) return;
      if (!clearOf(x, z, 2)) return;
      let pick = hash2(x + wi * 13, z - wi * 7), leaf = mixEntries[0][0];
      for (const [m, f] of mixEntries) { if (pick < f) { leaf = m; break; } pick -= f; }
      addStem(x, z, MAT[leaf], 'wood', w.key, {
        trunk: w.birch ? MAT.BARK_BIRCH : MAT.WOOD,
        big: w.coreClosure >= 0.7, // dense-canopy woods grow wide crowns
      });
    };
    // closure-calibrated planting: seed on a stratified grid, measure the
    // core canopy, then infill on shifted grids until the target closure
    // holds (deterministic — a fixed number of measured passes)
    const coreClosure = () => {
      let core = 0, covered = 0;
      for (let z = 2; z < SIZE_Z - 2; z++) for (let x = 2; x < SIZE_X - 2; x++) {
        const i = key(x, z);
        if (woodMaskId[i] !== wi + 1 || edgeD[i] < w.edgeFall) continue;
        if (gladeAt(x, z)) continue;
        core++;
        if (world.heightAt(x, z) > world.surfaceAt(x, z)) covered++;
      }
      return core > 0 ? covered / core : 1;
    };
    const footprint = w.mix.LEAF_FROST === 1 ? 5
      : (w.mix.LEAF_PINE === 1 || w.mix.LEAF_SPRUCE === 1) ? 11
      : w.coreClosure >= 0.7 ? 24 : 10.4;
    const tiling = footprint === 10.4 ? 0.45 : 1.0; // grid crowns tile tighter than random
    // each pass plants toward the MEASURED residual (same Poisson coverage
    // form, taken from the current closure), damped ×0.9 so the loop always
    // converges from below — planting can add canopy but never remove it
    const density = c => -Math.log(1 - Math.min(c, 0.9)) * 9 * tiling / (footprint * 0.85);
    for (let pass = 0; pass < 6; pass++) {
      const now = pass === 0 ? 0 : coreClosure();
      if (pass > 0 && now >= w.coreClosure - 0.03) break;
      const need = (density(w.coreClosure) - density(now)) * 0.9;
      for (let z = 4; z < SIZE_Z - 4; z++) for (let x = 4; x < SIZE_X - 4; x++) {
        if (woodMaskId[key(x, z)] !== wi + 1) continue;
        if ((x % 3) !== (wi % 3) || (z % 3) !== ((wi * 2) % 3)) continue;
        tryPlant(x, z, need, pass);
      }
    }
  });

  // the Beacon Row: three trees on Rustfall's south-east brow, planted where
  // the knoll faces the harbor mole — they carry autumn into the Overture
  // (§12) whatever the stratified passes decide upslope
  {
    const rw = WOODS.findIndex(w => w.key === 'rustfall') + 1;
    for (const [bx, bz, leaf] of [[118, 248, MAT.LEAF_EMBER], [120, 242, MAT.LEAF_GOLD], [112, 251, MAT.LEAF_EMBER]])
      if (woodMaskId[key(bx, bz)] === rw && world.surfaceAt(bx, bz) > SEA + 2)
        addStem(bx, bz, leaf, 'wood', 'rustfall', { trunk: MAT.WOOD });
  }

  /* ---- glade floors: 50–70% dressed (the Hushfirs' glade gets nothing) ---- */
  for (const g of glades) {
    const w = WOODS[g.wood];
    if (w.bareGlade) continue;
    const dress = w.region === REGION.MORNING ? MAT.FLOWERS_WHITE
      : w.region === REGION.NOON ? MAT.FLOWERS_GOLD : null; // autumn glades keep bare loam
    const R = Math.ceil(g.r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (Math.hypot(dx, dz) > g.r) continue;
      const x = g.x + dx, z = g.z + dz, h = world.surfaceAt(x, z);
      if (h <= SEA) continue;
      if (dress && hash2(x + 4, z + 4) < 0.6) world.set(x, h, z, dress);
      else if (!dress && hash2(x + 4, z + 4) < 0.35) world.set(x, h, z, MAT.SOIL);
    }
  }

  /* ---- riparian ribbon: willows flash between curtains ----
     the bed and its gravel rim are ~4 cubes wide, so the bank line the
     willows stand on runs 4–7 cubes from the river's centre points */
  for (const [rx, rz] of riverPts) {
    if (hash2(Math.floor(rx / 24), Math.floor(rz / 24)) < 0.35) continue; // whole windows skipped
    for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) {
      const d = Math.hypot(dx, dz);
      if (d < 4 || d > 7.5) continue;
      const x = rx + dx, z = rz + dz;
      const r = regionId[key(x, z)];
      if (r !== REGION.MORNING && seamDist[key(x, z)] > 9) continue; // willow is spring's tree (crowns spread 2)
      if (hash2(x * 3 + 5, z * 3 + 1) > 0.1) continue;
      const h = world.surfaceAt(x, z);
      if (h <= SEA || h > 66) continue;
      const g = world.get(x, h, z);
      if ((!GROUNDS.has(g) && g !== MAT.GRAVEL) || !clearOf(x, z, 2) || holdBlocked(x, z)) continue;
      addStem(x, z, MAT.LEAF_WILLOW, 'riparian', null, { th: 2 });
    }
  }

  /* ---- orchards: the shock of the lattice against wild woods ---- */
  const orchardPoints = new Set();
  for (const [ox0, oz0, ox1, oz1] of [[240, 214, 258, 228], [246, 232, 260, 244]]) {
    for (let z = oz0; z <= oz1; z++) for (let x = ox0; x <= ox1; x++) {
      if (x % 4 !== 2 || z % 4 !== 2) continue; // pitch exactly 4, zero jitter
      let regionSafe = true;
      for (const [ddx, ddz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]])
        if (regionId[key(x + ddx, z + ddz)] !== REGION.MORNING && seamDist[key(x + ddx, z + ddz)] > 9) regionSafe = false;
      if (!regionSafe) continue;
      const h = world.surfaceAt(x, z);
      if (h <= SEA + 1 || h > 40) continue;
      if (!GROUNDS.has(world.get(x, h, z)) || holdBlocked(x, z)) continue;
      if (addStem(x, z, MAT.LEAF_BLOSSOM, 'orchard', null, { th: 2 })) orchardPoints.add(key(x, z));
    }
  }
  // hedgerows snapped to the plot grid, a standard tree every 18±6
  const hedges = [];
  for (const [hx0, hz, hx1] of [[228, 220, 264], [232, 228, 260]]) {
    hedges.push({ x0: hx0, z: hz, x1: hx1 });
    let nextTree = hx0 + 6;
    for (let x = hx0; x <= hx1; x++) {
      const h = world.surfaceAt(x, hz);
      if (h <= SEA || h > 40) continue;
      const hedgeSafe = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].every(([ddx, ddz]) =>
        regionId[key(x + ddx, hz + ddz)] === REGION.MORNING || seamDist[key(x + ddx, hz + ddz)] <= 9);
      if (x >= nextTree && hedgeSafe && clearOf(x, hz, 2) && !holdBlocked(x, hz)) {
        addStem(x, hz, MAT.LEAF_BLOSSOM, 'hedge', null, { th: 2 });
        nextTree = x + 18 + Math.round((hash2(x, hz) - 0.5) * 12);
      } else if (world.get(x, h, hz) !== MAT.GRAVEL && !stemSet.has(key(x, hz)))
        world.set(x, h + 1, hz, MAT.BUSH_GREEN);
    }
  }

  /* ---- hermits: ≤10, hand-placed, half again as tall, visible ---- */
  const HERMITS = [
    { name: 'The Salt Oak', x: 312, z: 198, leaf: MAT.LEAF_SPRING },
    { name: 'The Mole Pine', x: 207, z: 314, leaf: MAT.LEAF_PINE },
    // (the Last Pine fell to winter's spreading woods — see footnotes)
    { name: 'The Kettle Birch', x: 177, z: 179, leaf: MAT.LEAF_FROST, trunk: MAT.BARK_BIRCH },
    // (the Nightcap is the Procession's bare final waytree, not a hermit)
  ];
  const hermits = [];
  for (const hm of HERMITS) {
    const h = world.surfaceAt(hm.x, hm.z);
    if (h <= SEA) continue;
    plant(world, hm.x, hm.z, hm.leaf || MAT.AIR, {
      trunk: hm.trunk || MAT.WOOD, th: 4 + (hash2(hm.x, hm.z) * 2 | 0),
      shape: hm.leaf === null ? 'none' : (SHAPE[hm.leaf] || 'round'), big: true,
    });
    stems.push({ x: hm.x, z: hm.z, leaf: hm.leaf || 0, kind: 'hermit', wood: hm.name });
    stemSet.add(key(hm.x, hm.z));
    occ.add(key(hm.x, hm.z));
    hermits.push({ name: hm.name, x: hm.x, z: hm.z });
  }

  /* ---- witness trees: the Sleeper's Red, rationed, at autumn wood edges ---- */
  let witnesses = 0;
  for (let z = 4; z < SIZE_Z - 4 && witnesses < 12; z++) for (let x = 4; x < SIZE_X - 4 && witnesses < 12; x++) {
    const i = key(x, z);
    const wi = woodMaskId[i] - 1;
    if (wi < 0 || WOODS[wi].region !== REGION.EVEN) continue;
    if (edgeD[i] < 2 || edgeD[i] > 4.5 || hash2(x * 11, z * 11) > 0.012) continue; // witnesses stand just inside the eaves
    const h = world.surfaceAt(x, z);
    if (h <= SEA + 2 || h > 76 || !GROUNDS.has(world.get(x, h, z))) continue;
    if (!clearOf(x, z, 3) || holdBlocked(x, z)) continue;
    if (addStem(x, z, MAT.LEAF_SCARLET, 'wood', WOODS[wi].key, { th: 3, big: true })) witnesses++;
  }

  /* ---- the Procession: the year readable in one avenue (§3) ---- */
  const PROC_WP = [
    [212, 318], [221, 306], [213, 296], [221, 286], [212, 276], [220, 266],
    [212, 258], [218, 252], [214, 250],
    [206, 244], [196, 236], [184, 228], [172, 222], [158, 214], [146, 210],
    [136, 204], [133, 196], [139, 190], [133, 184], [139, 178], [133, 172],
    [138, 166], [133, 160], [136, 156], [137, 148], [140, 140],
  ];
  const procession = [];
  for (let s = 0; s < PROC_WP.length - 1; s++) {
    const [x1, z1] = PROC_WP[s], [x2, z2] = PROC_WP[s + 1];
    const seg = Math.hypot(x2 - x1, z2 - z1), steps = Math.ceil(seg);
    for (let k = 0; k < steps; k++)
      procession.push([Math.round(x1 + (x2 - x1) * k / steps), Math.round(z1 + (z2 - z1) * k / steps)]);
  }
  procession.push(PROC_WP[PROC_WP.length - 1]);
  // total arclength → waytrees at spacing 8±2, states monotone along it
  const waytrees = [];
  let next = 4;
  for (let k = 0; k < procession.length; k++) {
    if (k < next) continue;
    const [px, pz] = procession[k];
    const t = k / procession.length;
    const state = t < 0.25 ? MAT.LEAF_BLOSSOM : t < 0.5 ? MAT.LEAF_BROAD : t < 0.75 ? MAT.LEAF_EMBER : null;
    const side = (waytrees.length % 2) * 4 - 2;
    const wx = px + (Math.abs(pz - (procession[Math.min(k + 2, procession.length - 1)][1])) > 0 ? side : 0);
    const wz = pz + (wx === px ? side : 0);
    const x = clamp(Math.round(wx), 2, SIZE_X - 3), z = clamp(Math.round(wz), 2, SIZE_Z - 3);
    const h = world.surfaceAt(x, z);
    if (h > SEA && h < 82) {
      plant(world, x, z, state || MAT.AIR, {
        trunk: MAT.BARK_BIRCH, th: 3, shape: state === null ? 'none' : 'round',
      });
      stems.push({ x, z, leaf: state || 0, kind: 'waytree', wood: 'procession' });
      stemSet.add(key(x, z)); occ.add(key(x, z));
      waytrees.push({ x, z, t, state });
    }
    next = k + 6;
  }
  { // the Nightcap: the last waytree, bare, at the Pillow
    const [nx, nz] = PROC_WP[PROC_WP.length - 1];
    if (!stemSet.has(key(nx, nz))) {
      plant(world, nx, nz, MAT.AIR, { trunk: MAT.BARK_BIRCH, th: 4, shape: 'none' });
      stems.push({ x: nx, z: nz, leaf: 0, kind: 'waytree', wood: 'procession' });
      stemSet.add(key(nx, nz)); occ.add(key(nx, nz));
      waytrees.push({ x: nx, z: nz, t: 1, state: null });
    }
  }

  /* ---- understory skirts at the wood edges ---- */
  const skirt = { [REGION.MORNING]: MAT.BUSH_GREEN, [REGION.NOON]: MAT.BUSH_GREEN,
    [REGION.EVEN]: MAT.BUSH_BRAMBLE, [REGION.HUSH]: MAT.LEAF_FROST };
  for (let z = 3; z < SIZE_Z - 3; z++) for (let x = 3; x < SIZE_X - 3; x++) {
    const i = key(x, z);
    if (woodMaskId[i]) continue;
    let nearWood = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]])
      if (woodMaskId[key(x + dx, z + dz)]) { nearWood = woodMaskId[key(x + dx, z + dz)]; break; }
    if (!nearWood || hash2(x * 13 + 2, z * 13 + 6) > 0.18) continue;
    const h = world.surfaceAt(x, z);
    if (h <= SEA || h > 76 || stemSet.has(i) || holdBlocked(x, z)) continue;
    const g = world.get(x, h, z);
    if (g !== MAT.GRASS && g !== MAT.GRASS_SPRING && g !== MAT.GRASS_DUN && g !== MAT.SNOW && g !== MAT.FLOWERS_WHITE) continue;
    world.set(x, h + 1, z, skirt[WOODS[nearWood - 1].region] || MAT.BUSH_GREEN);
  }

  /* ---- leafmould: closed canopy over lawn is the #1 fake-forest tell ----
     darkFloor woods (the Hushfirs) go to leafmould at the first shade —
     their interior is the island's darkest mass, snow only in the glade */
  for (let z = 3; z < SIZE_Z - 3; z++) for (let x = 3; x < SIZE_X - 3; x++) {
    const i = key(x, z);
    if (!woodMaskId[i]) continue;
    const w = WOODS[woodMaskId[i] - 1];
    if (w.bareGlade && gladeAt(x, z)) continue;
    let covered = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const h2 = world.heightAt(x + dx, z + dz);
      const g2 = world.surfaceAt(x + dx, z + dz);
      if (h2 > g2) covered++; // something (canopy) above the ground here
    }
    if (covered >= (w.darkFloor ? 4 : 15)) {
      const h = world.surfaceAt(x, z);
      const g = world.get(x, h, z);
      if (g === MAT.GRASS || g === MAT.GRASS_SPRING || g === MAT.GRASS_DUN ||
          g === MAT.FLOWERS_WHITE || (w.darkFloor && g === MAT.SNOW))
        world.set(x, h, z, MAT.FOREST_FLOOR);
    }
  }

  return { stems, stemSet, woodMaskId, edgeD, orchardPoints, glades, procession, waytrees, hermits, hedges };
}

SG.buildFlora = buildFlora;
})();
