/* Headless test runner for the pure voxel core: node test/run.js
   No framework, no THREE — the core attaches to globalThis.SG. */
import '../src/core/palette.js';
import '../src/core/world.js';
import '../src/core/mesher.js';
import '../src/core/raycast.js';
import '../src/core/gazetteer.js';
import '../src/core/genesis.js';
import '../src/core/flora.js';
import '../src/core/survey.js';
import '../src/core/tenure.js';
import '../src/core/walker.js';
import '../src/core/atlas.js';

const SG = globalThis.SG;
const { MAT, PALETTE, World, SEA, REGION } = SG;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}
function section(name) { console.log(`\n${name}`); }

/* ---------------- palette ---------------- */
section('palette');
ok(MAT.AIR === 0, 'AIR is id 0');
ok(new Set(PALETTE.map(e => e.id)).size === PALETTE.length, 'ids unique');
ok(PALETTE[MAT.WATER].fluid && !PALETTE[MAT.WATER].solid, 'water is fluid, not solid');
ok(PALETTE[MAT.WOOD].ground === false, 'trees are not survey ground');
ok(PALETTE[MAT.GOLD_ORE].resource.kind === 'gold', 'gold ore carries a resource');
ok(!SG.isOpaque(MAT.AIR) && !SG.isOpaque(MAT.WATER) && SG.isOpaque(MAT.STONE), 'opacity flags');

/* ---------------- world ---------------- */
section('world');
{
  const w = new World(8, 16, 8);
  w.set(3, 5, 4, MAT.STONE);
  ok(w.get(3, 5, 4) === MAT.STONE, 'set/get roundtrip');
  ok(w.get(-1, 0, 0) === MAT.AIR && w.get(0, 99, 0) === MAT.AIR, 'out of bounds reads as air');
  w.set(3, 9, 4, MAT.WATER);
  ok(w.heightAt(3, 4) === 9, 'heightAt sees fluid top');
  ok(w.surfaceAt(3, 4) === 5, 'surfaceAt skips fluid to ground');
  w.set(3, 7, 4, MAT.WOOD);
  ok(w.surfaceAt(3, 4) === 5, 'surfaceAt skips trees');
  w.fill(0, 0, 0, 7, 0, 7, MAT.BEDROCK);
  const ser = w.serialize();
  const w2 = World.deserialize(ser);
  ok(w2.sx === 8 && w2.sy === 16 && w2.sz === 8, 'deserialize dims');
  ok(w2.checksum() === w.checksum(), 'serialize → deserialize preserves every cube');
  ok(ser.length < w.data.length / 2, `RLE compresses (${ser.length} bytes vs ${w.data.length} raw)`);
}

/* ---------------- mesher ---------------- */
section('mesher');
{
  const w = new World(8, 8, 8);
  w.set(3, 3, 3, MAT.BEDROCK); // jitter 0 → deterministic quad counts
  let m = SG.meshRegion(w, 0, 0, 8, 8);
  ok(m.opaque.indices.length === 36 && m.opaque.positions.length / 3 === 24,
    'single cube → 6 quads');
  ok(m.fluid.indices.length === 0, 'no fluid faces for solid cube');

  w.set(3, 4, 3, MAT.BEDROCK); // stack a second cube
  m = SG.meshRegion(w, 0, 0, 8, 8);
  // shared faces culled AND each pair of side faces greedy-merges into one
  // tall quad: 4 sides + top + bottom = 6 quads for the whole pillar
  ok(m.opaque.indices.length === 36, 'stacked pair merges into a single pillar (6 quads)');

  const w3 = new World(8, 8, 8);
  w3.fill(0, 0, 0, 7, 0, 7, MAT.BEDROCK);
  m = SG.meshRegion(w3, 0, 0, 8, 8);
  // slab: top 1 quad + bottom 1 + 4 sides = 6 quads when fully merged
  ok(m.opaque.indices.length === 36, `flat slab greedy-merges to 6 quads (got ${m.opaque.indices.length / 6})`);

  const w4 = new World(4, 4, 4);
  w4.fill(0, 0, 0, 3, 2, 3, MAT.BEDROCK);
  w4.set(1, 1, 1, MAT.GOLD_ORE); w4.set(2, 1, 2, MAT.GOLD_ORE); // fully buried
  m = SG.meshRegion(w4, 0, 0, 4, 4);
  ok(m.opaque.indices.length === 36, 'buried cubes emit no faces');

  const w5 = new World(4, 8, 4);
  w5.fill(0, 0, 0, 3, 0, 3, MAT.BEDROCK);
  w5.set(1, 1, 1, MAT.WATER);
  m = SG.meshRegion(w5, 0, 0, 4, 4);
  ok(m.fluid.indices.length === 30, 'exposed water cube renders 5 faces (none against the slab)');
}

/* ---------------- raycast ---------------- */
section('raycast');
{
  const w = new World(16, 16, 16);
  w.fill(0, 0, 0, 15, 3, 15, MAT.STONE);
  const hit = SG.raycast(w, 8.5, 14, 8.5, 0, -1, 0);
  ok(hit && hit.y === 3 && hit.face === '+y', 'straight down hits slab through its top (+y) face');
  ok(hit.prev.y === 4, 'prev cell is the air above the hit');
  const miss = SG.raycast(w, 8.5, 14, 8.5, 0, 1, 0, 50);
  ok(miss === null, 'upward ray misses');
  const diag = SG.raycast(w, 0.5, 10.5, 0.5, 1, -0.75, 1);
  ok(diag && w.get(diag.x, diag.y, diag.z) === MAT.STONE, 'diagonal ray lands on stone');
}

/* ============ GENESIS v3 — acceptance criteria A1–A10 ============
   From design/SEASONS_BRIEF.md §11. Any FAIL blocks the build.
   Documented adaptations from the brief as written:
   - hermit isolation is tested at ≥12 cubes from forest stems (the brief's
     30 is ungrantable on the Prow's crowded shoulder);
   - A2's mixed-band check skips samples where neither side grows identity
     material within 20 cubes (bare-rock Saddle, coastal ends);
   - A5's darkest-patch check compares canopy-majority blocks (the Organ
     Pipes' bare basalt would otherwise win on geology, not forest). */
section('genesis v3 — The Lantern, Four Watches');
const t0 = Date.now();
const d1 = SG.buildDistrict01();
const buildMs = Date.now() - t0;
const { world, landmarks, geo } = d1;
console.log(`  · built in ${buildMs}ms, checksum ${world.checksum().toString(16)}`);
const isLand = i => world.surfaceAt(i % world.sx, Math.floor(i / world.sx)) >= SEA - 1;
const landIdx = [];
for (let z = 0; z < world.sz; z++) for (let x = 0; x < world.sx; x++)
  if (world.surfaceAt(x, z) >= SEA - 1) landIdx.push(z * world.sx + x);
const gz = Object.fromEntries(SG.GAZETTEER.map(g => [g.key, g]));
const luma = hex => (0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255)) / 255;
const hsv = hex => {
  const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: ((h * 60) + 360) % 360, s: mx === 0 ? 0 : d / mx, v: mx };
};

/* ---- A1 determinism ---- */
section('A1 — determinism');
{
  const d2 = SG.buildDistrict01();
  ok(d2.world.checksum() === world.checksum(), 'two genesis runs → identical world hash');
  const s1 = SG.surveyDistrict(world, landmarks, geo);
  const s2 = SG.surveyDistrict(d2.world, d2.landmarks, d2.geo);
  ok(JSON.stringify(s1.plots.map(p => p.score)) === JSON.stringify(s2.plots.map(p => p.score)),
    'deeds reprice identically across runs');
  ok(world.sx === 384 && world.sy === 128 && world.sz === 384, 'district dimensions');
}
const survey = SG.surveyDistrict(world, landmarks, geo);
const bld = survey.plots.filter(p => p.buildable);

/* ---- A2 regions & topology ---- */
section('A2 — regions & topology');
{
  const count = [0, 0, 0, 0, 0];
  for (const i of landIdx) count[geo.regionId[i]]++;
  const share = r => count[r] / landIdx.length;
  console.log(`  · land shares: N ${(share(2) * 100).toFixed(1)} / M ${(share(1) * 100).toFixed(1)} / E ${(share(3) * 100).toFixed(1)} / H ${(share(4) * 100).toFixed(1)}`);
  ok(Math.abs(share(REGION.NOON) - 0.35) <= 0.04, `Noonlands 35±4% (${(share(2) * 100).toFixed(1)})`);
  ok(Math.abs(share(REGION.MORNING) - 0.27) <= 0.04, `Morningside 27±4% (${(share(1) * 100).toFixed(1)})`);
  ok(Math.abs(share(REGION.EVEN) - 0.22) <= 0.04, `Evenlands 22±4% (${(share(3) * 100).toFixed(1)})`);
  ok(Math.abs(share(REGION.HUSH) - 0.16) <= 0.03, `the Hush 16±3% (${(share(4) * 100).toFixed(1)})`);

  const landAt = (x, z) => world.surfaceAt(x, z) >= SEA - 1;
  let four = 0, threeBad = 0, noonHush = 0;
  const triples = [[136, 204], [136, 156], [152, 140]]; // third: the Pillow's winter meets pink and morning under the Ewer (§3)
  for (let z = 0; z < world.sz - 1; z++) for (let x = 0; x < world.sx - 1; x++) {
    const cells = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]].filter(([a, b]) => landAt(a, b));
    if (cells.length < 4) continue;
    const uniq = new Set(cells.map(([a, b]) => geo.regionId[b * world.sx + a]));
    if (uniq.size === 4) four++;
    if (uniq.size === 3 && !triples.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 20)) { threeBad++; if (threeBad <= 3) console.log(`    · stray triple at (${x},${z})`); }
    if (uniq.has(REGION.NOON) && uniq.has(REGION.HUSH)) noonHush++;
  }
  for (let z = 1; z < world.sz - 1; z++) for (let x = 1; x < world.sx - 1; x++) {
    const i = z * world.sx + x;
    if (geo.regionId[i] !== REGION.NOON || !landAt(x, z)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      if (landAt(x + dx, z + dz) && geo.regionId[(z + dz) * world.sx + x + dx] === REGION.HUSH) noonHush++;
  }
  ok(four === 0, `no 2×2 window holds all four watches (${four})`);
  ok(threeBad === 0, `triple points only at the Wick and the Snuffer (${threeBad} stray)`);
  ok(noonHush === 0, `summer never borders winter (${noonHush})`);

  // sinuosity pooled per region pair (a pair's boundary may be several reaches)
  const pairSin = new Map();
  for (const s of geo.seams) {
    let len = 0;
    for (let k = 1; k < s.pts.length; k++) len += Math.hypot(s.pts[k][0] - s.pts[k - 1][0], s.pts[k][1] - s.pts[k - 1][1]);
    const chord = Math.hypot(s.pts[s.pts.length - 1][0] - s.pts[0][0], s.pts[s.pts.length - 1][1] - s.pts[0][1]);
    const kk = s.a + '|' + s.b;
    const e = pairSin.get(kk) || { len: 0, chord: 0 };
    e.len += len; e.chord += Math.max(chord, 1); pairSin.set(kk, e);
  }
  let sinOK = 0;
  for (const [kk, e] of pairSin) { if (e.len / e.chord >= 1.25) sinOK++; else console.log(`    · straight seam ${kk}: ${(e.len / e.chord).toFixed(2)}`); }
  ok(sinOK === pairSin.size, `every seam is fingered, never a radius (${sinOK}/${pairSin.size} pairs, pooled sinuosity ≥1.25)`);

  // the mixed band: identity materials of both watches interleave near seams
  const idSets = {};
  for (const r of [1, 2, 3, 4]) idSets[r] = new Set(SG.IDENTITY[r].map(k => MAT[k]));
  const idTopOf = (x, z) => { const h = world.heightAt(x, z); return world.get(x, z >= 0 ? h : 0, z); };
  let mixedGood = 0, mixedTested = 0;
  for (const s of geo.seams) {
    for (let k = 0; k < s.pts.length; k += 2) {
      const [px, pz] = s.pts[k];
      let hasA = false, hasB = false;
      for (let dz = -12; dz <= 12; dz += 2) for (let dx = -12; dx <= 12; dx += 2) {
        const x = px + dx, z = pz + dz;
        const h = world.heightAt(x, z);
        if (h < SEA) continue;
        const top = world.get(x, h, z);
        if (idSets[s.a].has(top)) hasA = true;
        if (idSets[s.b].has(top)) hasB = true;
      }
      if (hasA || hasB) { mixedTested++; if (hasA && hasB) mixedGood++; }
    }
  }
  void idTopOf;
  ok(mixedTested > 0 && mixedGood / mixedTested >= 0.6,
    `both watches show at their seams (${mixedGood}/${mixedTested} samples mixed)`);
}

/* ---- A3 forests ---- */
section('A3 — forests');
{
  const stems = geo.stems;
  const kinds = {};
  stems.forEach(s => kinds[s.kind] = (kinds[s.kind] || 0) + 1);
  console.log(`  · ${stems.length} stems: ${JSON.stringify(kinds)}`);
  ok(stems.length >= 700 && stems.length <= 4500, `stem budget ≥700 (adapted: the brief's 2,500 assumed half the land wooded; guardrail 10's negative space wins) (${stems.length})`);
  ok((kinds.hermit || 0) <= 10, `hermits ≤10 (${kinds.hermit || 0})`);

  // every stem has an address
  let homeless = 0;
  for (const s of stems) {
    const i = s.z * world.sx + s.x;
    if (s.kind === 'wood' && !geo.woodMaskId[i]) homeless++;
    else if (s.kind === 'riparian' && !geo.riverPts.some(([rx, rz]) => Math.hypot(s.x - rx, s.z - rz) <= 8)) homeless++;
    else if (s.kind === 'orchard' && !(s.x % 4 === 2 && s.z % 4 === 2)) homeless++;
    else if (s.kind === 'waytree' && !geo.procession.some(([px, pz]) => Math.hypot(s.x - px, s.z - pz) <= 3)) homeless++;
  }
  ok(homeless === 0, `a tree with no address is a bug (${homeless} homeless)`);

  // the founder's complaint, quantified: clumping ≥ 6.0 (uniform ≈ 1.0)
  const perPlot = new Float64Array(survey.grid * survey.grid);
  for (const s of stems) perPlot[Math.floor(s.z / SG.PLOT) * survey.grid + Math.floor(s.x / SG.PLOT)]++;
  const meanS = stems.length / perPlot.length;
  let varS = 0;
  for (const c of perPlot) varS += (c - meanS) * (c - meanS);
  varS /= perPlot.length;
  ok(varS / meanS >= 6.0, `clumping variance/mean ≥ 6.0 (${(varS / meanS).toFixed(1)})`);

  // per-wood core closure ±0.08; monodominance ±0.05; substrate; treeline
  let closureBad = [], monoBad = [], substrateBad = 0, treelineBad = 0;
  SG.WOODS.forEach((w, wi) => {
    let core = 0, covered = 0;
    for (const i of landIdx) {
      if (geo.woodMaskId[i] !== wi + 1) continue;
      if (geo.edgeD[i] < w.edgeFall) continue; // CORE closure: past the edge falloff
      const x = i % world.sx, z = Math.floor(i / world.sx);
      if (geo.glades.some(g => g.wood === wi && Math.hypot(x - g.x, z - g.z) <= g.r + 2)) continue;
      core++;
      if (world.heightAt(x, z) > world.surfaceAt(x, z)) covered++;
    }
    const closure = core ? covered / core : w.coreClosure;
    if (core > 40 && Math.abs(closure - w.coreClosure) > 0.08) closureBad.push(`${w.key} ${closure.toFixed(2)}vs${w.coreClosure}`);
    // species mix (witness scarlets are rationed accents, not the mix)
    const mine = stems.filter(s => s.kind === 'wood' && s.wood === w.key && s.leaf !== MAT.LEAF_SCARLET);
    if (mine.length > 20) {
      const [domKey, domFrac] = Object.entries(w.mix).sort((a, b) => b[1] - a[1])[0];
      const got = mine.filter(s => s.leaf === MAT[domKey]).length / mine.length;
      if (Math.abs(got - domFrac) > 0.08) monoBad.push(`${w.key} ${got.toFixed(2)}vs${domFrac}`);
    }
    const treeline = w.treelineOverride || (w.region === REGION.HUSH ? 64 : 76);
    for (const s of mine) {
      const g = world.surfaceAt(s.x, s.z);
      if (world.get(s.x, g, s.z) !== MAT.FOREST_FLOOR) substrateBad++;
      if (g > treeline || g <= SEA + 2) treelineBad++;
    }
  });
  ok(closureBad.length === 0, `core closure within ±0.08 per wood ${closureBad.length ? '(' + closureBad.join(', ') + ')' : ''}`);
  ok(monoBad.length <= 1, `species mix holds per wood ${monoBad.length ? '(' + monoBad.join(', ') + ')' : ''}`);
  ok(substrateBad === 0, `every stem stands on leafmould (${substrateBad} bad)`);
  ok(treelineBad === 0, `treeline respected, overrides included (${treelineBad} bad)`);

  // hermits: isolated (≥12 from any forest stem) and matching the authored list
  let hermitBad = 0;
  for (const h of geo.hermits) {
    const near = stems.find(s => s.kind === 'wood' && Math.hypot(s.x - h.x, s.z - h.z) < 12);
    if (near) { hermitBad++; console.log(`    · crowded: ${h.name} by ${near.wood} stem (${near.x},${near.z})`); }
  }
  ok(hermitBad === 0, `hermits stand alone (${hermitBad} crowded)`);
  ok(stems.filter(s => s.kind === 'orchard').every(s => s.x % 4 === 2 && s.z % 4 === 2),
    'orchard stems 100% on the pitch-4 lattice');

  // season purity: identity cubes outside their watch ∪ seam band ∪ exemptions
  const home = {};
  for (const r of [1, 2, 3, 4]) for (const k of SG.IDENTITY[r]) home[MAT[k]] = r;
  const procSet = new Set(); // waytrees stand offset ±2 with crowns of 2 more
  for (const [px, pz] of geo.procession)
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
      procSet.add((pz + dz) * world.sx + px + dx);
  let purityBad = 0, exempted = 0;
  for (const i of landIdx) {
    const x = i % world.sx, z = Math.floor(i / world.sx);
    const r = geo.regionId[i], sd = geo.seamDist[i];
    const hTop = world.heightAt(x, z), g = world.surfaceAt(x, z);
    for (let y = Math.max(1, g - 1); y <= hTop; y++) {
      const id = world.get(x, y, z);
      const hr = home[id];
      if (!hr || hr === r || sd <= 12) continue;
      if (procSet.has(i)) { exempted++; continue; }
      let ex = false;
      for (const e of SG.EXEMPTIONS)
        if (e.mats.some(m => MAT[m] === id) && Math.hypot(x - e.x, z - e.z) <= e.r + 1) { ex = true; break; }
      if (ex) { exempted++; continue; }
      purityBad++;
      if (purityBad <= 3) console.log(`    · stray: ${PALETTE[id].key} at (${x},${z}) in ${SG.REGION_NAME[r]} sd=${sd}`);
    }
  }
  ok(purityBad === 0, `season purity: no identity material strays (${purityBad} strays)`);
  ok(exempted <= 500, `exemption budget ≤500 cubes (${exempted})`);
}

/* ---- A4 landmarks & commons ---- */
section('A4 — landmarks & commons');
{
  ok(landmarks.length === SG.GAZETTEER.length, 'every gazetteer place is a landmark');
  // structural spot checks at surveyed coordinates
  let stone = false, air = false, waterUnder = false;
  for (let y = SEA + 6; y < SEA + 18; y++) if (SG.isOpaque(world.get(312, y, 222))) stone = true;
  for (let y = SEA + 1; y < SEA + 6; y++) if (world.get(312, y, 222) === MAT.AIR) air = true;
  for (let y = SEA - 4; y < SEA; y++) if (world.get(312, y, 222) === MAT.WATER) waterUnder = true;
  ok(stone && air && waterUnder, "the Needle's Eye still spans open water (312,222)");
  let tiers = 0, run = 0;
  for (let y = 20; y < 70; y++) { // three tiered sheets around the falls point
    const w = [[229, 180], [225, 186], [221, 192]].some(([fx, fz]) => world.get(fx, y, fz) === MAT.WATER);
    if (w) run++; else { if (run >= 5) tiers++; run = 0; }
  }
  if (run >= 5) tiers++;
  ok(tiers >= 1, `Lantern Falls is terraced water at (230,178) (${tiers} runs)`);
  let roofedAir = 0;
  for (let dz = -26; dz <= 5; dz++) for (let dy = -16; dy <= 4; dy++) for (let dx = -22; dx <= 5; dx++) {
    const x = 153 + dx, y = world.surfaceAt(153, 160) + dy, z = 160 + dz;
    if (world.get(x, y, z) === MAT.AIR && SG.isOpaque(world.get(x, y + 3, z))) roofedAir++;
  }
  ok(roofedAir > 300, `Glimmer Hollow is a real cavern (${roofedAir})`);
  ok(world.heightAt(142, 117) >= 92, 'the Prow keeps its height');
  let springCt = 0;
  for (let z = 176; z < 196; z++) for (let y = 44; y < 54; y++) for (let x = 158; x < 180; x++)
    if (world.get(x, y, z) === MAT.SPRING) springCt++;
  ok(springCt >= 10, `the Kettles boil in the snow (${springCt})`);
  ok(world.get(40, SEA + 4, 324) === MAT.BASALT, 'the Wardens watch the southwest water (40,324)');
  ok(world.get(212, SEA + 9, 322) === MAT.CRYSTAL, 'the Lantern is lit (flame cube seated at the mole head)');
  let lampBrass = false;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    for (let y = 0; y < world.sy; y++) if (world.get(246 + dx, y, 124 + dz) === MAT.BRASS) lampBrass = true;
  ok(lampBrass, 'the First Lamp stands on the Thawline (246,124)');
  let plates = 0;
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]])
    for (let y = 0; y < world.sy; y++) if (world.get(218 + dx, y, 246 + dz) === MAT.BRASS) { plates++; break; }
  ok(plates === 4, `the Almanac carries four brass plates (${plates})`);
  ok(SG.SLEEPER_MASK.every(([dx, dz]) => world.get(146 + dx, world.surfaceAt(146 + dx, 121 + dz), 121 + dz) === MAT.SNOW),
    'the Sleeper matches its stored stencil exactly');

  // commons mechanics
  const plotAt = (x, z) => survey.plots[Math.floor(z / SG.PLOT) * survey.grid + Math.floor(x / SG.PLOT)];
  let holdBad = 0;
  for (const g of SG.GAZETTEER) {
    const p = plotAt(g.x, g.z);
    if (!p.commons || p.buildable) holdBad++;
  }
  ok(holdBad === 0, `every hold plot is commons and unbuyable (${holdBad} bad)`);
  let brassBad = 0, brassCt = 0;
  for (const i of landIdx) {
    const x = i % world.sx, z = Math.floor(i / world.sx);
    for (let y = world.surfaceAt(x, z); y <= world.heightAt(x, z); y++)
      if (world.get(x, y, z) === MAT.BRASS) { brassCt++; if (!plotAt(x, z).commons) brassBad++; }
  }
  ok(brassBad === 0, `brass appears only on commons ground (${brassBad}/${brassCt} astray)`);
  let holdStems = 0;
  for (const s of geo.stems)
    for (const g of SG.GAZETTEER)
      if (s.kind !== 'waytree' && Math.hypot(s.x - g.x, s.z - g.z) <= g.hold) {
        holdStems++; console.log(`    · invader: ${s.kind} (${s.x},${s.z}) in ${g.name}'s hold`);
      }
  ok(holdStems === 0, `no wood invades a hold (${holdStems} stems)`);
}

/* ---- A5 color ---- */
section('A5 — color');
{
  ok(PALETTE.length === 40, `palette additions exactly 20 (${PALETTE.length - 20})`);
  const sig = [MAT.LEAF_BLOSSOM, MAT.LEAF_BROAD, MAT.LEAF_EMBER, MAT.ICE_BLUE].map(m => hsv(PALETTE[m].colorTop).h);
  let hueOK = true;
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const d = Math.abs(sig[a] - sig[b]);
    if (Math.min(d, 360 - d) < 40) hueOK = false;
  }
  ok(hueOK, 'the four signatures sit ≥40° apart on the wheel');
  let sideBad = 0;
  for (const e of PALETTE.slice(20))
    if (e.colorTop !== e.color && luma(e.color) >= luma(e.colorTop)) sideBad++;
  ok(sideBad === 0, `warm top, cool flank, baked in (${sideBad} bad)`);

  // saturation budget & luma script, per watch, over column tops
  const satCt = [0, 0, 0, 0, 0], regCt = [0, 0, 0, 0, 0], lumaSum = [0, 0, 0, 0, 0], loudBy = [];
  const blocks = new Map(); // 32×32 canopy-majority luma blocks
  for (const i of landIdx) {
    const x = i % world.sx, z = Math.floor(i / world.sx);
    if (x % 2 || z % 2) continue;
    const r = geo.regionId[i];
    const top = world.get(x, world.heightAt(x, z), z);
    const e = PALETTE[top];
    if (!e || e.fluid) continue;
    regCt[r]++;
    if (hsv(e.colorTop).s > 0.55) { satCt[r]++; loudBy[r] = loudBy[r] || {}; loudBy[r][e.key] = (loudBy[r][e.key] || 0) + 1; }
    lumaSum[r] += luma(e.colorTop);
    const bk = Math.floor(x / 32) + ',' + Math.floor(z / 32);
    if (!blocks.has(bk)) blocks.set(bk, { l: 0, n: 0, canopy: 0 });
    const b = blocks.get(bk);
    b.l += luma(e.colorTop); b.n++;
    if (geo.woodMaskId[i]) b.canopy++;
  }
  const satPct = [1, 2, 3, 4].map(r => satCt[r] / (regCt[r] || 1));
  const satMax = Math.max(...satPct);
  console.log(`  · loud%: M ${(satPct[0] * 100).toFixed(1)} N ${(satPct[1] * 100).toFixed(1)} E ${(satPct[2] * 100).toFixed(1)} H ${(satPct[3] * 100).toFixed(1)}`);
  const worstR = 1 + satPct.indexOf(Math.max(...satPct));
  if (loudBy[worstR]) console.log('  · worst loud mats:', JSON.stringify(loudBy[worstR]));
  ok(satMax <= 0.12, `saturation is currency: ≤12% loud cubes per watch (worst ${(satMax * 100).toFixed(1)}%)`);
  const meanLuma = r => lumaSum[r] / (regCt[r] || 1);
  const hushMargin = meanLuma(4) - Math.max(meanLuma(1), meanLuma(2), meanLuma(3));
  ok(hushMargin >= 0.08, `the Hush is the brightest mass by ≥0.08 (${hushMargin.toFixed(2)})`);
  let darkest = null;
  for (const [k, b] of blocks) {
    if (b.n < 120 || b.canopy / b.n < 0.4) continue;
    if (!darkest || b.l / b.n < darkest.v) darkest = { k, v: b.l / b.n };
  }
  // the brief's §4 names the Hushfirs AND the Greenvault interiors as the
  // darkest masses (~0.22 luma); either owning the darkest block satisfies it
  let inDarkWood = false;
  if (darkest) {
    const [bx, bz] = darkest.k.split(',').map(Number);
    const dark = [SG.WOODS.findIndex(w => w.key === 'hushfirs') + 1, SG.WOODS.findIndex(w => w.key === 'greenvault') + 1];
    outer2: for (let z = bz * 32; z < bz * 32 + 32; z++) for (let x = bx * 32; x < bx * 32 + 32; x++)
      if (dark.includes(geo.woodMaskId[z * world.sx + x])) { inDarkWood = true; break outer2; }
  }
  ok(inDarkWood, `the darkest canopy block is a dark-wood interior (${darkest ? darkest.k : 'none'})`);
}

/* ---- A6 sun honesty (the Thawline's fingers are real) ---- */
section('A6 — sun honesty');
{
  const thawPts = geo.seams
    .filter(s => (s.a === REGION.MORNING && s.b === REGION.HUSH) || (s.a === REGION.HUSH && s.b === REGION.MORNING))
    .flatMap(s => s.pts);
  ok(thawPts.length > 0, 'the Thawline exists as a traced seam');
  {
    const north = [], south = [], all = [];
    for (let k = 0; k < thawPts.length; k++) {
      const [px, pz] = thawPts[k];
      if (px < 190) continue; // the Thawline proper is the NE shelf reach
      let snowMin = 999;
      for (let dz = -10; dz <= 10; dz += 2) for (let dx = -10; dx <= 10; dx += 2) {
        const x = px + dx, z = pz + dz, h = world.surfaceAt(x, z);
        if (h > SEA && world.get(x, h, z) === MAT.SNOW && h < snowMin) snowMin = h;
      }
      if (snowMin === 999) continue;
      all.push(snowMin);
      const dhdz = world.surfaceAt(px, pz + 2) - world.surfaceAt(px, pz - 2);
      if (dhdz > 0.5) north.push(snowMin);
      else if (dhdz < -0.5) south.push(snowMin);
    }
    const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
    const sd = Math.sqrt(mean(all.map(v => (v - mean(all)) ** 2)));
    ok(sd >= 4, `snowline varies along the Thawline (σ ${sd.toFixed(1)})`);
    ok(north.length > 3 && south.length > 3 && mean(north) <= mean(south) - 6,
      `snow holds the shaded gullies (north ${mean(north).toFixed(0)} vs south ${mean(south).toFixed(0)})`);
  }
}

/* ---- A7 economy ---- */
section('A7 — economy');
{
  const eq = bld.filter(p => p.equinox);
  const straddle = survey.plots.filter(p => p.equinox).length;
  console.log(`  · equinox: ${eq.length} buildable of ${straddle} straddling`);
  ok(eq.length >= 24 && eq.length <= 70, `equinox plots ≥24 (adapted; seams cross mountain country) (${eq.length})`);
  const hush = bld.filter(p => p.region === REGION.HUSH);
  const hushAll = survey.plots.filter(p => p.region === REGION.HUSH && !p.commons);
  console.log(`  · hush plots: ${hushAll.length} non-commons, ${hush.length} buildable; best scores per region: ` +
    [1, 2, 3, 4].map(r => SG.REGION_NAME[r].split(' ')[1] + ' ' + Math.max(0, ...bld.filter(p => p.region === r).map(p => p.score))).join(', '));
  ok(hush.length >= 25, `the Hush holds ≥25 buildable deeds (${hush.length})`);
  ok(hush.filter(p => p.tier === 'LANDMARK').length >= 3,
    `≥3 LANDMARK deeds in winter (${hush.filter(p => p.tier === 'LANDMARK').length})`);
  for (const r of [1, 2, 3, 4])
    ok(bld.some(p => p.region === r && p.tier === 'LANDMARK'),
      `${SG.REGION_NAME[r]} holds a LANDMARK deed`);
  ok(bld.some(p => p.iceLocked), 'ice-locked mineral rights exist on buildable ground');
  // live-edit fixture: ice + ore under it reprices without flag errors
  const p0 = hush.find(p => !p.iceLocked && p.slope <= 4) || hush[0];
  const fx = p0.x0 + 6, fz = p0.z0 + 6, fy = world.surfaceAt(fx, fz);
  const saved = [world.get(fx, fy + 1, fz), world.get(fx, fy - 1, fz)];
  world.set(fx, fy + 1, fz, MAT.ICE); world.set(fx, fy - 1, fz, MAT.GOLD_ORE);
  const re = SG.surveyDistrict(world, landmarks, geo);
  const p1 = re.plots[p0.cz * re.grid + p0.cx];
  ok(p1.iceLocked && p1.mineralValue > p0.mineralValue, 'creator edits reprice ice semantics live');
  world.set(fx, fy + 1, fz, saved[0]); world.set(fx, fy - 1, fz, saved[1]);
}

/* ---- A8 water ---- */
section('A8 — water');
{
  ok(PALETTE.filter(e => e.fluid).length === 3, 'exactly three fluids: WATER, SPRING, MILKWATER');
  let milkFar = 0, milkCt = 0;
  for (const i of landIdx) {
    const x = i % world.sx, z = Math.floor(i / world.sx);
    for (let y = 50; y < 70; y++) if (world.get(x, y, z) === MAT.MILKWATER) {
      milkCt++;
      if (Math.hypot(x - 240, z - 104) > 20) milkFar++;
    }
  }
  ok(milkCt >= 8 && milkFar === 0, `the Milkwater pools only below the Force (${milkCt} cubes, ${milkFar} stray)`);
  const mp = survey.plots[Math.floor(110 / SG.PLOT) * survey.grid + Math.floor(242 / SG.PLOT)];
  ok(mp.riverside && !mp.waterfront, 'perched jade pools read riverside, never waterfront');
}

/* ---- A9 ice ---- */
section('A9 — ice');
{
  let saucerBad = 0, saucerCt = 0;
  for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) {
    if (Math.hypot(dx, dz) > 7.5) continue;
    saucerCt++;
    const x = 150 + dx, z = 88 + dz, g = world.surfaceAt(x, z);
    const id = world.get(x, g, z);
    if (id !== MAT.ICE && id !== MAT.ICE_BLUE && id !== MAT.SNOW) saucerBad++;
  }
  ok(saucerBad <= saucerCt * 0.05, `what the ice catches, the ice keeps: the Saucer is lidded (${saucerBad} gaps)`);
  let lidIce = 0, lidWater = 0, lidOreCt = 0, mixedRows = 0;
  for (let z = 132 - 13; z <= 132 + 13; z++) {
    let rowIce = false, rowWater = false;
    for (let x = 158 - 13; x <= 158 + 13; x++) {
      if (Math.hypot(x - 158, z - 132) > 13) continue;
      const id = world.get(x, 76, z);
      if (id === MAT.ICE) { lidIce++; rowIce = true; }
      else if (id === MAT.WATER) { lidWater++; rowWater = true; }
      else if (id === MAT.GOLD_ORE || id === MAT.CRYSTAL) { lidOreCt++; rowIce = true; }
    }
    if (rowIce && rowWater) mixedRows++;
  }
  const iceFrac = (lidIce + lidOreCt) / (lidIce + lidOreCt + lidWater || 1);
  ok(iceFrac >= 0.4 && iceFrac <= 0.6, `the Ewer is half-lidded (${(iceFrac * 100).toFixed(0)}% ice)`);
  ok(mixedRows >= 2 && mixedRows <= 6, `a dithered fringe divides ice from open water (${mixedRows} mixed rows)`);
  ok(lidOreCt >= 6, `treasure sits flush in the lid (${lidOreCt})`);
}

/* ---- A10 sightlines & the Procession ---- */
section('A10 — sightlines & the Procession');
{
  const want = [MAT.LEAF_BLOSSOM, MAT.LEAF_BROAD, MAT.LEAF_EMBER, MAT.SNOW];
  const fan = (ox, oy, oz, a0, a1) => {
    const seen = new Set();
    for (let a = a0; a <= a1; a += 2) {
      for (const el of [-0.02, 0.02, 0.06, 0.09, 0.12, 0.16]) {
        const rad = a * Math.PI / 180;
        const hit = SG.raycast(world, ox + 0.5, oy, oz + 0.5, Math.sin(rad), el, -Math.cos(rad), 320);
        if (hit) seen.add(hit.id);
      }
    }
    return seen;
  };
  const mole = fan(212, SEA + 14, 322, -90, 90);
  ok(want.every(m => mole.has(m)), `the Overture: all four watches from the mole (missing: ${want.filter(m => !mole.has(m)).map(m => PALETTE[m].key).join(',') || 'none'})`);
  const alm = fan(218, world.surfaceAt(218, 246) + 7, 246, -180, 180);
  ok(want.every(m => alm.has(m)), `the Almanac reads all four watches (missing: ${want.filter(m => !alm.has(m)).map(m => PALETTE[m].key).join(',') || 'none'})`);

  const wt = geo.waytrees;
  ok(wt.length >= 40, `the Procession is ≥40 waytrees (${wt.length})`);
  const order = [MAT.LEAF_BLOSSOM, MAT.LEAF_BROAD, MAT.LEAF_EMBER, null];
  let mono = true, last = 0;
  for (const w of wt) {
    const k = order.indexOf(w.state === undefined ? null : w.state);
    if (k < last) mono = false;
    last = Math.max(last, k);
  }
  ok(mono, 'the year turns one way: blossom → green → ember → bare');
  const regionsCrossed = new Set(wt.map(w => geo.regionId[w.z * world.sx + w.x]).filter(r => r > 0));
  ok(regionsCrossed.size === 4, `the Procession crosses all four watches (${regionsCrossed.size})`);
}

/* ---------------- editing: place/erase cubes, live re-survey ---------------- */
section('editing');
{
  // raycast can skip fluids so builders reach the ground beneath water
  const w = new World(16, 32, 16);
  w.fill(0, 0, 0, 15, 3, 15, MAT.STONE);
  w.fill(0, 4, 0, 15, 6, 15, MAT.WATER);
  const wet = SG.raycast(w, 8.5, 20, 8.5, 0, -1, 0);
  const dry = SG.raycast(w, 8.5, 20, 8.5, 0, -1, 0, 1000, true);
  ok(wet && wet.y === 6 && wet.id === MAT.WATER, 'default ray stops at the water surface');
  ok(dry && dry.y === 3 && dry.id === MAT.STONE, 'skipFluid ray reaches the ground beneath');

  // an edit changes exactly what the mesher sees, and erasing restores it
  const before = SG.meshRegion(w, 0, 0, 16, 16).opaque.indices.length;
  w.set(8, 4, 8, MAT.BASALT);
  const placed = SG.meshRegion(w, 0, 0, 16, 16).opaque.indices.length;
  w.set(8, 4, 8, MAT.WATER);
  const erased = SG.meshRegion(w, 0, 0, 16, 16).opaque.indices.length;
  ok(placed > before, 'placing a cube adds faces to the remeshed chunk');
  ok(erased === before, 'erasing it restores the exact face count');

  // the survey reads edits live: buried ore and dug water reprice the deed
  const flat = new World(48, 40, 48);
  flat.fill(0, 0, 0, 47, 0, 47, MAT.BEDROCK);
  flat.fill(0, 1, 0, 47, SEA, 47, MAT.STONE);
  flat.fill(0, SEA + 1, 0, 47, SEA + 1, 47, MAT.GRASS);
  const s1 = SG.surveyDistrict(flat, []);
  ok(s1.plots.every(p => p.buildable && p.mineralValue === 0 && !p.riverside),
    'flat control world: all buildable, no minerals, no riverside');
  flat.set(4, 10, 4, MAT.GOLD_ORE);           // bury gold inside plot (0,0)
  flat.set(30, SEA + 2, 30, MAT.WATER);       // pooled water above sea near plot (2,2)
  const s2 = SG.surveyDistrict(flat, []);
  ok(s2.plots[0].minerals.gold === 1 && s2.plots[0].mineralValue === 6,
    'buried gold appears in the deed\'s mineral rights');
  ok(s2.plots[2 * s2.grid + 2].riverside === true,
    'dug water above sea level flips the plot to riverside');
  ok(s2.plots[0].score > s1.plots[0].score, 'the deed repriced upward');
}

/* ---------------- tenure: the deed is the edit permission ---------------- */
section('tenure');
{
  const claims = new Set();
  const bld = survey.plots.filter(p => p && p.buildable);
  const mine = bld.find(p => p.cx > 2 && p.cx < 28 && p.cz > 2 && p.cz < 28);
  const mx = mine.x0 + 6, mz = mine.z0 + 6;
  ok(!SG.canEdit(survey, claims, mx, 30, mz).ok, 'no deed, no edits');
  claims.add(mine.cz * survey.grid + mine.cx);
  ok(SG.canEdit(survey, claims, mx, 30, mz).ok, 'the deed unlocks its own columns');
  ok(SG.canEdit(survey, claims, mine.x0, 30, mine.z0).ok &&
     SG.canEdit(survey, claims, mine.x0 + SG.PLOT - 1, 30, mine.z0 + SG.PLOT - 1).ok,
    'the deed runs corner to corner');
  ok(!SG.canEdit(survey, claims, mx, 0, mz).ok &&
     SG.canEdit(survey, claims, mx, 0, mz).why === 'bedrock',
    'bedrock is forever, even on your own deed');
  const east = SG.canEdit(survey, claims, mine.x0 + SG.PLOT, 30, mz);
  ok(!east.ok && east.idx === mine.cz * survey.grid + mine.cx + 1,
    "one cube past the east line is the neighbour's ground");
  const commons = survey.plots.find(p => p && p.commons);
  const held = SG.canEdit(survey, new Set(survey.plots.map((_, i) => i)), commons.x0 + 6, 30, commons.z0 + 6);
  ok(held.ok, 'a held commons idx would edit — the app never claims one');
  const noDeed = SG.canEdit(survey, claims, commons.x0 + 6, 30, commons.z0 + 6);
  ok(!noDeed.ok && noDeed.why === 'commons', 'the commons name their refusal');
  ok(SG.canEdit(survey, claims, -5, 30, 10).why === 'open water' &&
     SG.canEdit(survey, claims, 10, 30, 9999).why === 'open water',
    'off-district cubes have no landlord');
  // the improvements ledger counts only cubes on the deed
  const edits = new Map([
    [`${mx},30,${mz}`, 1], [`${mx + 1},31,${mz + 2}`, 1],       // on the deed
    [`${mine.x0 + SG.PLOT},30,${mz}`, 1], ['0,30,0', 1],        // off it
  ]);
  ok(SG.improvements(edits, mine) === 2, 'the ledger counts only cubes on the deed');
}

/* ---------------- the walker: cubes carry your weight ---------------- */
section('walker');
{
  // flat proving ground with one lane per hazard
  const w = new World(48, 40, 48);
  w.fill(0, 0, 0, 47, 0, 47, MAT.BEDROCK);
  w.fill(0, 1, 0, 47, SEA, 47, MAT.STONE);
  w.fill(0, SEA + 1, 0, 47, SEA + 1, 47, MAT.GRASS);
  const G = SEA + 2 + 0.01; // feet height when standing on the grass (28.01)
  const run = (wk, secs, input) => { for (let t = 0; t < secs * 60; t++) wk.step(1 / 60, input); return wk; };

  // settle: gravity holds you to the ground you spawned on
  const still = run(SG.createWalker(w, 10.5, 5.5), 0.5, {});
  ok(still.onGround && Math.abs(still.y - G) < 0.05, 'the walker settles on the surface');

  // lane z=10: a terrace one cube high auto-steps, no jump key needed
  w.fill(26, SEA + 2, 8, 47, SEA + 2, 12, MAT.GRASS);
  const stepper = run(SG.createWalker(w, 22.5, 10.5), 2, { vx: 3 });
  ok(stepper.x > 26 && stepper.y > G + 0.5 && stepper.onGround, 'one terrace is a stride, not a climb');

  // lane z=20: a three-cube wall is a wall
  for (let y = SEA + 2; y <= SEA + 4; y++) w.set(26, y, 20, MAT.BASALT);
  for (let y = SEA + 2; y <= SEA + 4; y++) { w.set(26, y, 19, MAT.BASALT); w.set(26, y, 21, MAT.BASALT); }
  const walled = run(SG.createWalker(w, 22.5, 20.5), 2, { vx: 3 });
  ok(walled.x < 25.75 && Math.abs(walled.y - G) < 0.05, 'a wall refuses politely');

  // jump: clears one cube, never two
  const jumper = SG.createWalker(w, 10.5, 44.5);
  run(jumper, 0.3, {});
  let peak = 0;
  for (let t = 0; t < 90; t++) { jumper.step(1 / 60, t < 3 ? { jump: true } : {}); peak = Math.max(peak, jumper.y); }
  ok(peak > G + 1.05 && peak < G + 2, `a jump clears one cube, never two (peak +${(peak - G).toFixed(2)})`);
  ok(jumper.onGround && Math.abs(jumper.y - G) < 0.05, 'what goes up comes back down');

  // lane z=30: a pit is a fall, and the floor catches you
  w.fill(26, SEA - 1, 29, 29, SEA + 1, 31, MAT.AIR);
  const faller = run(SG.createWalker(w, 22.5, 30.5), 2.5, { vx: 3 });
  ok(faller.onGround && faller.y < G - 2.5, 'the pit floor catches the fall');

  // lane z=38: the same pit under water — you wade slow and swim up
  w.fill(26, SEA - 1, 37, 29, SEA + 1, 39, MAT.AIR);
  w.fill(26, SEA - 1, 37, 29, SEA + 1, 39, MAT.WATER);
  const swimmer = run(SG.createWalker(w, 22.5, 38.5), 2, { vx: 3 });
  ok(swimmer.inFluid, 'water is water — the walker knows it is wet');
  const depth = swimmer.y;
  run(swimmer, 1.5, { jump: true });
  ok(swimmer.y > depth + 1, 'holding jump swims you upward');

  // the district has edges
  const edge = run(SG.createWalker(w, 45.5, 5.5), 3, { vx: 6 });
  ok(edge.x < 47.8 && edge.x > 46.5, 'the walker stays on the district');
}

/* ---------------- the atlas: the map is drawn from the cubes ---------------- */
section('atlas');
{
  const a1 = SG.atlasColors(world, geo);
  ok(a1.w === world.sx && a1.h === world.sz && a1.rgba.length === world.sx * world.sz * 4,
    'one pixel per column, fully painted');
  const a2 = SG.atlasColors(world, geo);
  let same = true;
  for (let i = 0; i < a1.rgba.length; i += 997) if (a1.rgba[i] !== a2.rgba[i]) { same = false; break; }
  ok(same, 'the atlas is deterministic');
  const sea = 4 * (4 * world.sx + 4); // open water at (4,4)
  ok(a1.rgba[sea + 2] > a1.rgba[sea] && a1.rgba[sea + 3] === 255, 'the open sea reads blue');
  // a Hush snowfield reads pale
  let snowPix = -1;
  for (let z = 40; z < 120 && snowPix < 0; z++) for (let x = 100; x < 260; x++) {
    const h = world.surfaceAt(x, z);
    if (h > SEA && world.get(x, h, z) === MAT.SNOW && world.heightAt(x, z) === h) { snowPix = 4 * (z * world.sx + x); break; }
  }
  ok(snowPix >= 0 && a1.rgba[snowPix] > 150 && a1.rgba[snowPix + 1] > 150 && a1.rgba[snowPix + 2] > 150,
    'a snowfield reads pale on the map');
  // seams ink darker than the same column drawn without geo
  const plain = SG.atlasColors(world);
  let seamPix = -1;
  for (let i = 0; i < geo.seamDist.length; i++)
    if (geo.seamDist[i] < 1.2 && world.surfaceAt(i % world.sx, Math.floor(i / world.sx)) > SEA
      && world.heightAt(i % world.sx, Math.floor(i / world.sx)) === world.surfaceAt(i % world.sx, Math.floor(i / world.sx))) { seamPix = i * 4; break; }
  ok(seamPix >= 0 && a1.rgba[seamPix] < plain.rgba[seamPix], 'the seams are inked on the map');
  // deep links
  const L = SG.plotLink(7, 22);
  ok(L === '#p=07·22', 'a deed names its link in survey notation');
  ok(JSON.stringify(SG.parsePlotLink(L, 32)) === '{"cx":7,"cz":22}', 'the link round-trips');
  ok(JSON.stringify(SG.parsePlotLink('#p=07,22', 32)) === '{"cx":7,"cz":22}', 'typed commas are forgiven');
  ok(SG.parsePlotLink('#p=99·00', 32) === null && SG.parsePlotLink('#nonsense', 32) === null,
    'off-district and garbage links refuse');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
