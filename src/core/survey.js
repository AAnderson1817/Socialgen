/* Socialgen core — the district survey, v3 (design/SEASONS_BRIEF.md §9).
   A plot is a 12×12 bundle of voxel columns, owned bedrock to sky. Every
   trait is DERIVED from the cubes: water adjacency, drop-offs, ore in the
   column (1.5× when sealed under walkable ice), the watch the plot keeps,
   seam frontage, blossom and ember frontage, clearings in named woods.
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, PALETTE, SEA, REGION } = SG;

const PLOT = 12; // cubes per plot side — a plot holds a grove, not a tree

const TIERS = [
  { min: 64, tier: 'LANDMARK', price: 2000 },
  { min: 48, tier: 'PRIME', price: 1200 },
  { min: 36, tier: 'VISTA', price: 750 },
  { min: 25, tier: 'STANDARD', price: 420 },
  { min: 0, tier: 'OUTLAND', price: 240 },
];

const GROUND_KIND = () => ({
  [MAT.GRASS]: 'Meadow', [MAT.SAND]: 'Strand', [MAT.STONE]: 'Stone fell',
  [MAT.SNOW]: 'Snowfield', [MAT.GRAVEL]: 'Shingle', [MAT.BASALT]: 'Basalt',
  [MAT.MOSS]: 'Mossgarth', [MAT.SOIL]: 'Loam', [MAT.CLAY]: 'Clay pan',
  [MAT.GRASS_SPRING]: 'Freshmead', [MAT.GRASS_DUN]: 'Dun moor',
  [MAT.FOREST_FLOOR]: 'Leafmould', [MAT.FLOWERS_WHITE]: 'Flowering mead',
  [MAT.FLOWERS_GOLD]: 'Goldfield', [MAT.ICE]: 'Lake ice', [MAT.ICE_BLUE]: 'Blue ice',
});

function surveyDistrict(world, landmarks, geo) {
  const { sx, sz } = world;
  const grid = Math.floor(sx / PLOT);
  const plots = new Array(grid * grid);
  const counts = new Uint32Array(PALETTE.length);

  /* one pass over every column: ground, fluid top, and the per-column
     tallies every trait reads from */
  const N = sx * sz;
  const ground = new Int16Array(N);
  const waterTop = new Int16Array(N);          // topmost OPEN fluid (ice caps hide it)
  const blossomCt = new Uint8Array(N);
  const emberCt = new Uint8Array(N);
  const trunkCt = new Uint8Array(N);
  const iceTopFl = new Uint8Array(N);
  const resVal = new Float32Array(N);          // mineral value, ice-locked ×1.5
  const iceLockFl = new Uint8Array(N);
  for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
    const i = z * sx + x;
    let g = -1, wt = -1, seenIce = false, top = true;
    for (let y = world.sy - 1; y >= 0; y--) {
      const id = world.get(x, y, z);
      if (id === MAT.AIR) continue;
      const e = PALETTE[id];
      if (e.fluid) { if (wt < 0 && top) wt = y; continue; }
      if (top && e.ground) { g = y; top = false; }
      else if (top && !e.ground) {
        if (id === MAT.LEAF_BLOSSOM && blossomCt[i] < 255) blossomCt[i]++;
        if ((id === MAT.LEAF_EMBER || id === MAT.LEAF_GOLD || id === MAT.LEAF_SCARLET) && emberCt[i] < 255) emberCt[i]++;
      }
      if (id === MAT.WOOD || id === MAT.BARK_BIRCH) trunkCt[i]++;
      if (id === MAT.ICE || id === MAT.ICE_BLUE) { seenIce = true; if (g < 0) { /* ice IS ground */ } }
      if (e.resource) {
        const v = e.resource.value * (seenIce ? 1.5 : 1);
        resVal[i] += v;
        if (seenIce) iceLockFl[i] = 1;
      }
    }
    ground[i] = g;
    waterTop[i] = wt;
    if (g >= 0) {
      const gid = world.get(x, g, z);
      if (gid === MAT.ICE || gid === MAT.ICE_BLUE) iceTopFl[i] = 1;
    }
  }
  const G = (x, z) => (x < 0 || x >= sx || z < 0 || z >= sz) ? 0 : ground[z * sx + x];
  const W = (x, z) => (x < 0 || x >= sx || z < 0 || z >= sz) ? SEA - 1 : waterTop[z * sx + x];

  /* landmark influence from the gazetteer's hold radii */
  const influence = landmarks.map(lm => ({
    lm, hold: lm.hold ?? 6, near: Math.max((lm.hold ?? 6) + 12, 18),
  }));
  // named woods join the influence table: {hold 0, near blob r + 12}
  const woodInfl = [];
  if (geo && SG.WOODS) SG.WOODS.forEach(w => {
    for (const [bx, bz, br] of w.blobs) woodInfl.push({ name: w.name, x: bx, z: bz, near: br + 12 });
  });
  // commons strip: the Procession is a walked commons track (⊕2). Seams are
  // surveyed lines, not strips — their straddling plots stay buyable as
  // equinox stock (§9).
  const polyCommons = new Set();
  if (geo) {
    for (const [px, pz] of geo.procession)
      for (let dz = -2; dz <= 2; dz += 2) for (let dx = -2; dx <= 2; dx += 2) {
        const cx = Math.floor((px + dx) / PLOT), cz = Math.floor((pz + dz) / PLOT);
        if (cx >= 0 && cx < grid && cz >= 0 && cz < grid) polyCommons.add(cz * grid + cx);
      }
  }

  let buildableCount = 0;
  for (let cz = 0; cz < grid; cz++) for (let cx = 0; cx < grid; cx++) {
    const x0 = cx * PLOT, z0 = cz * PLOT, x1 = x0 + PLOT - 1, z1 = z0 + PLOT - 1;
    const midX = x0 + PLOT / 2, midZ = z0 + PLOT / 2;

    let sum = 0, min = 999, max = -999, wet = 0, drySum = 0;
    let waterfront = false, riverside = false, lakefront = false;
    let blossom = 0, ember = 0, trunks = 0, iceEdge = 0, mineralValue = 0, iceLocked = false;
    const regionCt = [0, 0, 0, 0, 0];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = z * sx + x;
      const h = ground[i];
      sum += h; if (h < min) min = h; if (h > max) max = h;
      const wt = waterTop[i];
      if (wt > h) { wet++; if (wt <= SEA) waterfront = true; else riverside = true; }
      else drySum += h;
      trunks += trunkCt[i];
      mineralValue += resVal[i];
      if (iceLockFl[i]) iceLocked = true;

    }
    const mean = sum / (PLOT * PLOT);
    const dry = PLOT * PLOT - wet;
    const dryMean = dry > 0 ? drySum / dry : 0;
    const slope = max - min;

    // frontage band: 6 cubes past the parcel line
    const BAND = 6;
    for (let z = z0 - BAND; z <= z1 + BAND; z++) for (let x = x0 - BAND; x <= x1 + BAND; x++) {
      const inside = x >= x0 && x <= x1 && z >= z0 && z <= z1;
      if (!inside) {
        const wt = W(x, z);
        if (wt > G(x, z)) { if (wt <= SEA) waterfront = true; else riverside = true; }
      }
      if (x >= x0 - 2 && x <= x1 + 2 && z >= z0 - 2 && z <= z1 + 2) {
        const i2 = z * sx + x;
        if (x >= 0 && x < sx && z >= 0 && z < sz) {
          if (geo && (x % 2 === 1) && (z % 2 === 1)) regionCt[geo.regionId[i2]]++;
          if (waterTop[i2] > Math.max(ground[i2], SEA)) lakefront = true; // open above-sea fluid, truly adjacent
          if (iceTopFl[i2]) iceEdge++;
          blossom += blossomCt[i2];
          ember += emberCt[i2];
        }
      }
    }
    const iceShore = iceEdge >= 4 && !lakefront;

    // clifftop: level ground with a hard drop just beyond the parcel line
    let cliffDrop = 0;
    for (const ring of [PLOT * 1.4, PLOT * 2.2]) // near ring, and past a wide mesa's lip
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rx = Math.round(midX + Math.cos(a) * ring);
        const rz = Math.round(midZ + Math.sin(a) * ring);
        cliffDrop = Math.max(cliffDrop, mean - G(rx, rz));
      }
    const clifftop = mean > SEA + 12 && slope <= 5 && cliffDrop >= 12;

    // dominant ground character
    const surf = {};
    for (let z = z0; z <= z1; z += 3) for (let x = x0; x <= x1; x += 3) {
      const y = G(x, z);
      if (y >= 0) { const id = world.get(x, y, z); surf[id] = (surf[id] || 0) + 1; }
    }
    const domId = +Object.entries(surf).sort((a, b) => b[1] - a[1])[0]?.[0];
    const groundKind = GROUND_KIND()[domId] || 'Seabed';

    // mineral kinds (for the deed's chips)
    counts.fill(0);
    world.countInBox(x0, z0, x1, z1, counts);
    const minerals = {};
    for (const e of PALETTE) if (e.resource && counts[e.id] > 0) minerals[e.resource.kind] = counts[e.id];
    const trees = Math.round(trunks / 4);
    const springsOnPlot = counts[MAT.SPRING] > 0; // hot-shore also counts the Kettles' neighbours (below)

    // the watch this plot keeps
    let region = 0, equinox = false;
    if (geo) {
      const landSamples = regionCt.reduce((a, b) => a + b, 0);
      if (landSamples > 0) {
        region = regionCt.indexOf(Math.max(...regionCt));
        const sorted = regionCt.filter(c => c > 0).sort((a, b) => b - a);
        equinox = sorted.length >= 2 && sorted[1] / landSamples >= 0.08; // the plot itself samples two watches (the 40-70 count governs)
      }
    }
    const seamFrontage = geo ? geo.seamDist[Math.round(midZ) * sx + Math.round(midX)] <= 6 : false;

    // clearings in named woods; orchard lattice
    let gladePlot = false, gladeWood = null, orchardRow = false;
    if (geo) {
      let inWood = 0, woodId = 0, leafy = 0, stemsIn = 0, orchardStems = 0;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const i = z * sx + x;
        if (geo.woodMaskId[i]) { inWood++; woodId = geo.woodMaskId[i]; }
        if (world.heightAt(x, z) > ground[i] && waterTop[i] < 0) leafy++;
        if (geo.stemSet.has(i)) { stemsIn++; if (geo.orchardPoints.has(i)) orchardStems++; }
      }
      gladePlot = inWood >= PLOT * PLOT * 0.55 && stemsIn === 0 && leafy < PLOT * PLOT * 0.1;
      if (gladePlot && woodId) gladeWood = SG.WOODS[woodId - 1].name;
      orchardRow = orchardStems >= 6;
    }

    // named places near
    let commons = polyCommons.has(cz * grid + cx), nearest = null, nearestD = 1e9;
    const namedNear = [];
    for (const { lm, hold, near } of influence) {
      const d = Math.hypot(lm.x - midX, lm.z - midZ);
      if (d < hold + PLOT * 0.5) commons = true;
      if (d < near) namedNear.push(lm.name);
      if (d < nearestD) { nearestD = d; nearest = lm; }
    }
    for (const w of woodInfl)
      if (Math.hypot(w.x - midX, w.z - midZ) < w.near && !namedNear.includes(w.name)) namedNear.push(w.name);

    const buildable = !commons && dry >= PLOT * PLOT * 2 / 3 && dryMean >= SEA + 0.5 && min >= SEA - 3 && slope <= 9;
    if (buildable) buildableCount++;

    const plot = {
      cx, cz, x0, z0, mean, min, max, slope,
      waterfront, riverside, lakefront, clifftop, commons,
      region, season: SG.REGION_SEASON ? SG.REGION_SEASON[region] : null,
      regionName: SG.REGION_NAME ? SG.REGION_NAME[region] : null,
      epithet: (geo && region && SG.EPITHETS) ? SG.EPITHETS[region][(cx * 7 + cz * 13) % SG.EPITHETS[region].length] : null,
      equinox, seamFrontage: seamFrontage && !equinox,
      blossomFront: blossom >= 40, emberFront: ember >= 40,
      gladePlot, gladeWood, orchardRow, iceShore, iceLocked,
      springs: springsOnPlot || namedNear.includes('The Kettles'), minerals, mineralValue: Math.round(mineralValue), trees, groundKind,
      named: namedNear, nearestName: nearest ? nearest.name : null,
      elevPct: 0, score: 0, tier: null, price: 0, buildable,
    };
    plots[cz * grid + cx] = plot;
  }

  // elevation percentile over buildable plots
  const bld = plots.filter(p => p.buildable).sort((a, b) => a.mean - b.mean);
  bld.forEach((p, i) => { p.elevPct = bld.length > 1 ? i / (bld.length - 1) : 0.5; });

  for (const p of plots) {
    if (!p.buildable) continue;
    let s = 8
      + (p.waterfront ? 22 : 0) + (p.riverside ? 15 : 0) + (p.lakefront ? 18 : 0)
      + (p.iceShore ? 10 : 0)
      + (p.equinox ? 14 : (p.seamFrontage ? 8 : 0))
      + (p.blossomFront ? 12 : 0) + (p.emberFront ? 10 : 0)
      + (p.gladePlot ? 12 : 0) + (p.orchardRow ? 8 : 0)
      + (p.springs ? 14 : 0) + (p.clifftop ? 13 : 0)
      + p.elevPct * 18
      + Math.min(p.trees / 8, 1) * 10
      + Math.min(p.mineralValue / 90, 1) * 12
      + (p.slope <= 1 ? 6 : 0)
      + Math.min(p.named.length, 4) * 3;
    p.score = Math.round(Math.min(s, 100));
    const t = TIERS.find(t => p.score >= t.min);
    p.tier = t.tier; p.price = t.price;
  }

  return { plots, grid, plotSize: PLOT, buildableCount };
}

SG.PLOT = PLOT;
SG.surveyDistrict = surveyDistrict;
})();
