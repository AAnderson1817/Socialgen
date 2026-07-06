/* Headless test runner for the pure voxel core: node test/run.js
   No framework, no THREE — the core attaches to globalThis.SG. */
import '../src/core/palette.js';
import '../src/core/world.js';
import '../src/core/mesher.js';
import '../src/core/raycast.js';
import '../src/core/genesis.js';
import '../src/core/survey.js';

const SG = globalThis.SG;
const { MAT, PALETTE, World, SEA } = SG;

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

/* ---------------- genesis: District 01 ---------------- */
section('genesis — The Lantern');
const t0 = Date.now();
const d1 = SG.buildDistrict01();
const buildMs = Date.now() - t0;
const { world, landmarks } = d1;
{
  ok(world.sx === 256 && world.sy === 80 && world.sz === 256, 'district dimensions');
  console.log(`  · built in ${buildMs}ms, checksum ${world.checksum().toString(16)}`);
  const d2 = SG.buildDistrict01();
  ok(d2.world.checksum() === world.checksum(), 'genesis is fully deterministic (same checksum twice)');

  ok(landmarks.length === 9, 'all nine named places exist');
  const lm = Object.fromEntries(landmarks.map(l => [l.key, l]));

  // the Ewer holds water above sea level
  ok(world.get(lm.lake.x, 49, lm.lake.z) === MAT.WATER, 'the Ewer holds water above sea level');

  // Lantern Falls is a real vertical water sheet: ≥8 consecutive water cubes
  let sheet = 0, best = 0;
  for (let y = 10; y < 60; y++) {
    if (world.get(lm.falls.x, y, lm.falls.z) === MAT.WATER) { sheet++; best = Math.max(best, sheet); }
    else sheet = 0;
  }
  ok(best >= 8, `Lantern Falls is a real vertical sheet (${best} stacked water cubes)`);

  // Glimmer Hollow is a real tunnel: air cells under solid roof near the mouth
  let roofedAir = 0;
  for (let dz = -12; dz <= 4; dz++) for (let dy = -8; dy <= 4; dy++) for (let dx = -10; dx <= 4; dx++) {
    const x = lm.cave.x + dx, y = lm.cave.y - 5 + dy, z = lm.cave.z + dz;
    if (world.get(x, y, z) === MAT.AIR && SG.isOpaque(world.get(x, y + 3, z))) roofedAir++;
  }
  ok(roofedAir > 60, `Glimmer Hollow is a real cave (${roofedAir} roofed air cells)`);
  let crystals = 0;
  for (let z = 85; z < 105; z++) for (let y = 10; y < 45; y++) for (let x = 85; x < 105; x++)
    if (world.get(x, y, z) === MAT.CRYSTAL) crystals++;
  ok(crystals > 20, `the geode chamber is studded with crystal (${crystals} cubes)`);

  // the Needle's Eye is a real arch: stone above air above water at its center
  const ax = lm.arch.x, az = lm.arch.z;
  let hasStoneOver = false, hasAirUnder = false, hasWaterBelow = false;
  for (let y = SEA + 4; y < SEA + 14; y++) if (SG.isOpaque(world.get(ax, y, az))) hasStoneOver = true;
  for (let y = SEA + 1; y < SEA + 5; y++) if (world.get(ax, y, az) === MAT.AIR) hasAirUnder = true;
  for (let y = SEA - 3; y < SEA; y++) if (world.get(ax, y, az) === MAT.WATER) hasWaterBelow = true;
  ok(hasStoneOver && hasAirUnder, "the Needle's Eye spans open air (stone over air)");
  ok(hasWaterBelow, 'water passes beneath the arch');

  // hot springs hold SPRING fluid
  let springCubes = 0;
  for (let z = 118; z < 132; z++) for (let y = 28; y < 36; y++) for (let x = 104; x < 120; x++)
    if (world.get(x, y, z) === MAT.SPRING) springCubes++;
  ok(springCubes >= 6, `the Kettles hold mineral water (${springCubes} spring cubes)`);

  // ore exists in sensible amounts
  const counts = world.countInBox(0, 0, 255, 255);
  ok(counts[MAT.COPPER_ORE] > 100, `copper veins seeded (${counts[MAT.COPPER_ORE]})`);
  ok(counts[MAT.IRON_ORE] > 60, `iron veins seeded (${counts[MAT.IRON_ORE]})`);
  ok(counts[MAT.GOLD_ORE] > 20, `gold veins seeded (${counts[MAT.GOLD_ORE]})`);
  ok(counts[MAT.WOOD] > 400, `forests planted (${counts[MAT.WOOD]} trunk cubes)`);
  ok(counts[MAT.BASALT] > 500, `the Organ Pipes are basalt (${counts[MAT.BASALT]})`);
  ok(counts[MAT.SNOW] > 50, `the Prow is snow-capped (${counts[MAT.SNOW]})`);

  const ser = world.serialize();
  ok(World.deserialize(ser).checksum() === world.checksum(),
    `district serializes losslessly (${(ser.length / 1024).toFixed(0)}KB vs ${(world.data.length / 1048576).toFixed(1)}MB raw)`);
}

/* ---------------- survey ---------------- */
section('survey');
{
  const t1 = Date.now();
  const s = SG.surveyDistrict(world, landmarks);
  console.log(`  · surveyed ${s.grid}×${s.grid} plots in ${Date.now() - t1}ms; ${s.buildableCount} buildable`);
  ok(s.grid === 32, '32×32 plot grid');
  ok(s.buildableCount > 150 && s.buildableCount < 700,
    `sane buildable count (${s.buildableCount})`);
  const bld = s.plots.filter(p => p.buildable);
  ok(bld.every(p => p.price > 0 && p.tier), 'every buildable plot is priced and tiered');
  const waterfront = bld.filter(p => p.waterfront).length;
  ok(waterfront >= 20, `waterfront plots exist (${waterfront})`);
  ok(bld.some(p => p.riverside), 'riverside plots exist');
  ok(bld.some(p => p.fallsView), 'falls-view plots exist');
  ok(bld.some(p => p.clifftop), 'clifftop plots exist');
  ok(bld.some(p => p.mineralValue > 0), 'some deeds carry mineral rights');
  const commons = s.plots.filter(p => p.commons).length;
  ok(commons >= 8, `the named places are held as commons (${commons} plots in trust)`);
  ok(s.plots.filter(p => p.commons).every(p => !p.buildable), 'commons are never for sale');
  const landmarkTier = bld.filter(p => p.tier === 'LANDMARK').length;
  ok(landmarkTier > 0 && landmarkTier < bld.length * 0.15,
    `LANDMARK tier is scarce (${landmarkTier} of ${bld.length})`);
  // determinism of the whole pipeline
  const s2 = SG.surveyDistrict(SG.buildDistrict01().world, landmarks);
  ok(JSON.stringify(s2.plots.map(p => p.score)) === JSON.stringify(s.plots.map(p => p.score)),
    'survey is deterministic end to end');
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
  const flat = new World(32, 32, 32);
  flat.fill(0, 0, 0, 31, 0, 31, MAT.BEDROCK);
  flat.fill(0, 1, 0, 31, SEA, 31, MAT.STONE);
  flat.fill(0, SEA + 1, 0, 31, SEA + 1, 31, MAT.GRASS);
  const s1 = SG.surveyDistrict(flat, []);
  ok(s1.plots.every(p => p.buildable && p.mineralValue === 0 && !p.riverside),
    'flat control world: all buildable, no minerals, no riverside');
  flat.set(4, 10, 4, MAT.GOLD_ORE);           // bury gold inside plot (0,0)
  flat.set(20, SEA + 2, 20, MAT.WATER);       // pooled water above sea near plot (2,2)
  const s2 = SG.surveyDistrict(flat, []);
  ok(s2.plots[0].minerals.gold === 1 && s2.plots[0].mineralValue === 6,
    'buried gold appears in the deed\'s mineral rights');
  ok(s2.plots[2 * 4 + 2].riverside === true,
    'dug water above sea level flips the plot to riverside');
  ok(s2.plots[0].score > s1.plots[0].score, 'the deed repriced upward');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
