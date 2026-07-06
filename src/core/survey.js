/* Socialgen core — the district survey.
   A plot is an 8×8 bundle of voxel columns, owned from bedrock to sky.
   Every trait on the deed is DERIVED from the cubes themselves — adjacency
   to water, drop-offs at the parcel edge, ore actually buried in the column —
   plus proximity to the district's named places. Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, PALETTE, SEA } = SG;

const PLOT = 8; // cubes per plot side

const TIERS = [
  { min: 64, tier: 'LANDMARK', price: 2000 },
  { min: 48, tier: 'PRIME', price: 1200 },
  { min: 36, tier: 'VISTA', price: 750 },
  { min: 25, tier: 'STANDARD', price: 420 },
  { min: 0, tier: 'OUTLAND', price: 240 },
];

// landmark influence radii (cubes): inside `hold` the land is common trust —
// never sold; inside `near` plots earn the named-place chip and score.
const INFLUENCE = {
  lake: { hold: 11, near: 22 }, falls: { hold: 5, near: 20 },
  cave: { hold: 4, near: 14 }, springs: { hold: 5, near: 14 },
  arch: { hold: 7, near: 18 }, summit: { hold: 0, near: 16 },
  pipes: { hold: 0, near: 14 }, harbor: { hold: 0, near: 20 },
  stacks: { hold: 0, near: 14 },
};

function surveyDistrict(world, landmarks) {
  const { sx, sz } = world;
  const grid = Math.floor(sx / PLOT);
  const plots = new Array(grid * grid);
  const counts = new Uint32Array(PALETTE.length);

  // ground + water maps once, plot passes read from them
  const ground = new Int16Array(sx * sz);
  const waterTop = new Int16Array(sx * sz); // y of topmost fluid, -1 if none
  for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
    ground[z * sx + x] = world.surfaceAt(x, z);
    let wt = -1;
    for (let y = world.sy - 1; y >= 0; y--) {
      const e = PALETTE[world.get(x, y, z)];
      if (e.fluid) { wt = y; break; }
      if (e.ground) break;
    }
    waterTop[z * sx + x] = wt;
  }
  const g = (x, z) => (x < 0 || x >= sx || z < 0 || z >= sz) ? 0 : ground[z * sx + x];
  const w = (x, z) => (x < 0 || x >= sx || z < 0 || z >= sz) ? SEA - 1 : waterTop[z * sx + x];

  let buildableCount = 0;
  for (let cz = 0; cz < grid; cz++) for (let cx = 0; cx < grid; cx++) {
    const x0 = cx * PLOT, z0 = cz * PLOT, x1 = x0 + PLOT - 1, z1 = z0 + PLOT - 1;
    const midX = x0 + PLOT / 2, midZ = z0 + PLOT / 2;

    // sea-level fluid on or near the plot → waterfront; fluid sitting above
    // sea level → riverside (rivers and the lake run high)
    let sum = 0, min = 999, max = -999, wet = 0, drySum = 0;
    let waterfront = false, riverside = false;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const h = g(x, z);
      sum += h; if (h < min) min = h; if (h > max) max = h;
      const wt = w(x, z);
      if (wt > h) { wet++; if (wt <= SEA) waterfront = true; else riverside = true; }
      else drySum += h;
    }
    const mean = sum / (PLOT * PLOT);
    const dry = PLOT * PLOT - wet;
    const dryMean = dry > 0 ? drySum / dry : 0;
    const slope = max - min;

    // …and in a 4-cube band around the parcel line (a wide dry beach between
    // the plot and the waterline still sells as waterfront)
    const BAND = 4;
    for (let z = z0 - BAND; z <= z1 + BAND; z++) for (let x = x0 - BAND; x <= x1 + BAND; x++) {
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) continue;
      const wt = w(x, z);
      if (wt > g(x, z)) { if (wt <= SEA) waterfront = true; else riverside = true; }
    }

    // clifftop: level ground with a hard drop just beyond the parcel line
    let cliffDrop = 0;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const rx = Math.round(midX + Math.cos(a) * (PLOT * 1.4));
      const rz = Math.round(midZ + Math.sin(a) * (PLOT * 1.4));
      cliffDrop = Math.max(cliffDrop, mean - g(rx, rz));
    }
    const clifftop = mean > SEA + 8 && slope <= 4 && cliffDrop >= 9;

    // dominant ground character for the deed's face chip
    const surf = {};
    for (let z = z0; z <= z1; z += 2) for (let x = x0; x <= x1; x += 2) {
      const y = g(x, z);
      if (y >= 0) { const id = world.get(x, y, z); surf[id] = (surf[id] || 0) + 1; }
    }
    const domId = +Object.entries(surf).sort((a, b) => b[1] - a[1])[0]?.[0];
    const GROUND_KIND = {
      [MAT.GRASS]: 'Meadow', [MAT.SAND]: 'Strand', [MAT.STONE]: 'Stone fell',
      [MAT.SNOW]: 'Snowfield', [MAT.GRAVEL]: 'Shingle', [MAT.BASALT]: 'Basalt',
      [MAT.MOSS]: 'Mossgarth', [MAT.SOIL]: 'Loam', [MAT.CLAY]: 'Clay pan',
    };
    const groundKind = GROUND_KIND[domId] || 'Seabed';

    // what's buried in the column volume — the deed includes mineral rights
    counts.fill(0);
    world.countInBox(x0, z0, x1, z1, counts);
    const minerals = {};
    let mineralValue = 0;
    for (const e of PALETTE) if (e.resource && counts[e.id] > 0) {
      minerals[e.resource.kind] = counts[e.id];
      mineralValue += counts[e.id] * e.resource.value;
    }
    const trees = counts[MAT.WOOD] > 0 ? Math.round(counts[MAT.WOOD] / 4) : 0;
    const springsOnPlot = counts[MAT.SPRING] > 0;

    // named-place proximity
    let commons = false, nearest = null, nearestD = 1e9;
    const namedNear = [];
    for (const lm of landmarks) {
      const inf = INFLUENCE[lm.key] || { hold: 0, near: 12 };
      const d = Math.hypot(lm.x - midX, lm.z - midZ);
      if (d < inf.hold + PLOT * 0.5) commons = true;
      if (d < inf.near) namedNear.push(lm);
      if (d < nearestD) { nearestD = d; nearest = lm; }
    }
    const has = key => namedNear.some(lm => lm.key === key);

    // terraceable rather than flat: cube terrain steps, buyers bring shovels.
    // up to a third of a plot may be tidal shallows — that's beachfront, not
    // a defect — as long as the dry ground stands above the sea
    const buildable = !commons && dry >= 40 && dryMean >= SEA + 0.5 && min >= SEA - 2.5 && slope <= 7;
    if (buildable) buildableCount++;

    const plot = {
      cx, cz, x0, z0, mean, min, max, slope,
      waterfront, riverside, clifftop, commons,
      lakefront: has('lake'), fallsView: has('falls'), caveMouth: has('cave'),
      archView: has('arch'), springs: springsOnPlot || has('springs'),
      summit: has('summit'), harborside: has('harbor'),
      minerals, mineralValue, trees, buildable, groundKind,
      named: namedNear.map(lm => lm.name), nearestName: nearest ? nearest.name : null,
      elevPct: 0, score: 0, tier: null, price: 0,
    };
    plots[cz * grid + cx] = plot;
  }

  // elevation percentile over buildable plots (views score higher up)
  const bld = plots.filter(p => p.buildable).sort((a, b) => a.mean - b.mean);
  bld.forEach((p, i) => { p.elevPct = bld.length > 1 ? i / (bld.length - 1) : 0.5; });

  for (const p of plots) {
    if (!p.buildable) continue;
    let s = 8
      + (p.waterfront ? 22 : 0) + (p.riverside ? 15 : 0) + (p.lakefront ? 18 : 0)
      + (p.fallsView ? 16 : 0) + (p.caveMouth ? 12 : 0) + (p.archView ? 12 : 0)
      + (p.springs ? 14 : 0) + (p.clifftop ? 13 : 0) + (p.summit ? 10 : 0)
      + (p.harborside ? 8 : 0)
      + p.elevPct * 18
      + Math.min(p.trees / 5, 1) * 10
      + Math.min(p.mineralValue / 60, 1) * 12
      + (p.slope <= 1 ? 6 : 0)
      + p.named.length * 3; // places where the composition stacks are the jewels
    p.score = Math.round(Math.min(s, 100));
    const t = TIERS.find(t => p.score >= t.min);
    p.tier = t.tier; p.price = t.price;
  }

  return { plots, grid, plotSize: PLOT, buildableCount };
}

SG.PLOT = PLOT;
SG.surveyDistrict = surveyDistrict;
})();
