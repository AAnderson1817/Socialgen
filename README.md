# Socialgen — Archipelago

**One authored voxel world. Plots people actually want.**

This repo contains District 01, **The Lantern**: a single hand-composed cube
island where every parcel is surveyed from the cubes themselves and sold as a
scarce deed. There is no terrain generator button. There is no seed lottery.
The island is 1 of 1, the named places are held in common trust, and every
buyer is every other buyer's neighbour — that is the product.

The island now carries **the Four Watches** (Genesis v3): four regions where
the season never changes — spring holds the east (the Morningside), summer
the south (the Noonlands), autumn the west (the Evenlands), winter the north
shelf (the Hush). The full design brief, written and agreed before any code,
lives at [`design/SEASONS_BRIEF.md`](design/SEASONS_BRIEF.md); the build is
gated by its ten acceptance criteria (A1–A10), which run headless in
`test/run.js`.

## Run it

```
node serve.js          # → http://localhost:8017
# or: python3 -m http.server 8017
```

Open in a browser. Drag to orbit, scroll to zoom, right-drag/two-finger to
pan, tap a parcel to survey it, claim it with gems (simulated wallet).

**Walk mode** (the ⚇ WALK button): the district on foot, at eye level.
Mouse to look (pointer lock), WASD to walk, space to jump, shift to
stride; a single terrace is a step, two is a wall, and water is honest —
you wade slow and swim up holding space. Click surveys the parcel ahead
of the crosshair; select your parcel first and you'll spawn standing on
it. Esc releases the mouse, Esc again (or the button) returns to the
survey glass. The physics lives in `src/core/walker.js` — pure JS against
the same cubes that price the deeds, gated by the headless suite.

**Creator mode** (the ⚒ BUILD button, or `B`): pick a cube from the tileset
and click — or hold and **drag to paint**. Brush sizes 1/2/3 place single
cubes or sculpting blobs; the **box** tool fills between two clicked
corners; right-click erases one cube; alt-click samples the material under
the cursor; alt-drag orbits while painting; `ctrl+Z` undoes a whole stroke;
*revert all* restores the authored district. Edits persist in the browser
and are replayed on top of genesis at load. Crucially, **every edit
re-surveys the district live** — dig a channel from the sea to an inland
plot and its deed reprices as Waterfront; bury ore in a column and the deed
gains mineral rights. The land market reads the cubes, always.

**The tenure law** (`src/core/tenure.js`): the deed is the edit
permission. You may shape only the parcels you hold — they glow green in
build mode, the cursor turns hollow slate over everyone else's ground, the
commons refuse everyone, and bedrock is forever. Your deed card keeps an
improvements ledger ("Shaped ×N") derived from the edit diff. The
**✪ steward** toggle lifts the law for district authoring — it is the old
god-mode, kept honest by a label — and persists with your save.

## Test it

```
node test/run.js       # 118 headless assertions, no browser needed
```

The entire world model is pure JS with zero rendering dependencies, so the
tests build the full district (~3s), verify its landmarks structurally
(the falls really are terraced sheets of water cubes, the cave really is
roofed air, the arch really spans open water), check the survey economy
(buildable counts, waterfront scarcity, tier distribution, commons held in
trust, end-to-end determinism) — and enforce the brief's A1–A10 gate:
land shares per watch, seam topology (summer never borders winter, no
four-corner meetings), flora law (every tree has an address in a named
wood), palette discipline, snowline honesty against the sun's aspect, ice
behaviour, and the §12 sightlines (all four watches visible from the
harbor mole).

## Why cubes

The previous prototype was a heightmap: one surface height per (x,z). Its
caves were painted black circles and its arch was a floating torus prop —
the *most desirable* features of a landscape (interiors, overhangs, tunnels,
things you can be inside) were exactly the ones it could not represent.

Cubes fix that, and they are also the data model. Every voxel is one byte
into a palette (`src/core/palette.js`) that carries gameplay properties:
whether it's ground, whether it's fluid, what resource it holds. A plot is
a 12×12 bundle of columns owned bedrock-to-sky, so a deed can include ore
that nobody has found yet — value is *inside* the land, not just on it
(under the Hush's lake lids, ice-locked minerals appraise at 1.5×).

## Why one authored island

Procedural variety is worthless to a land economy: if a better waterfall is
one reroll away, no waterfall is worth anything. Scarcity requires a fixed,
shared, *composed* place with names people can meet at. The generator that
built the heightmap prototype survives here only as a set of texture
brushes inside `src/core/genesis.js` — every landmark is placed at chosen
coordinates, and the file reads as a composition, not an algorithm:

- **The Prow** — snow-capped massif, winter's high seat
- **The Ewer** — crater lake on its shoulder, half-lidded in ice
- **Lantern Falls** — the river leaping the shelf in three terraced tiers
- **The Stilled Force** — a frozen waterfall, a flame of ice above jade pools
- **Glimmer Hollow** — a real cave tunnel into a crystal geode
- **The Kettles** — hot-spring terrace at the Hush finger's tip
- **The Needle's Eye** — a stone sea arch over the east cove
- **The Organ Pipes** — sheer basalt columns, gold in their crown
- **The Wardens** — sea stacks in the south-west water
- **Lantern Harbor** — the bay where the Procession meets the sea

…and the named woods of the Four Watches: the Bridal Copse and Lambgrass
Wood in blossom, the Greenvault's closed summer canopy, the Tinderbeeches,
Coinbirch Stand and Rustfall Wood in ember and gold, the Hushfirs and the
Bone Birches under snow. The **Procession** — a brass-posted commons track
of ~42 waytrees walking the whole year from blossom to bare — crosses all
four watches from the harbor mole to the Wick.

`DISTRICT_SEED` is fixed forever. Change a number in genesis and you have
changed the district for everyone — that's the point, and the checksum test
will tell you that you did.

**Known deviations from the brief** (each argued in test comments): the
stem budget floor is 700 (the brief's 2,500 assumed half the land wooded;
guardrail 10's negative space wins), Rustfall mixes ember+gold instead of
broadleaf (broadleaf is summer's identity — purity wins), Lantern Harbor
files under the Noonlands per §5's own listing, the Wardens wear moss caps,
a third seam triple point at the Ewer's rim is sanctioned (the finger's
own geometry forces it), and the Last Pine was cut.

## Architecture

```
src/core/   pure JS, no THREE, runs headless in node
  palette.js   40 cube materials + gameplay properties
  world.js     chunk-free Uint8 voxel store, column-contiguous, RLE serialization
  mesher.js    greedy mesher: face culling, merged quads, baked AO + shading
  raycast.js   Amanatides–Woo DDA — exact voxel picking, no proxy meshes
  gazetteer.js the named places, woods, region identities & epithets
  flora.js     the forest law: closure-calibrated woods, glades, orchards,
               hermits, witnesses, the Procession's waytrees
  genesis.js   the authored composition: terrain, regions, water, ice, seams
  survey.js    plots = 12×12 columns; traits/score/tier/price from the cubes
               (equinox parcels, blossom/ember fronts, ice shores, glades…)
  tenure.js    the ownership law: canEdit (deed-gated sculpting) + the
               per-deed improvements ledger
  walker.js    first-person physics: AABB vs the grid, gravity, one-cube
               auto-step, honest water — the cubes carry your weight
src/app/    THREE.js layer (r128, vendored)
  render.js    chunk meshes, ocean, sun/sky, landmark labels, drapes, beacons
  main.js      camera rig, DDA picking, deed card, wallet, persistence
test/run.js  headless suite
vendor/      three.min.js r128 (vendored — works offline)
```

The world is 384×384×128 (18MB raw, ~2.4MB serialized) — landscape scale:
a cube is small against the land, trees are three cubes of crown, the Prow
rises ~74 cubes over the sea and Lantern Falls drops ~26. Plots are 12×12
columns → a 32×32 survey grid, ~200 buildable deeds, LANDMARK tier scarce
and present in every watch.
The full mesh builds in under a second (greedy mesher with height-clamped
sweeps); edits remesh only their 32×32 chunk, batched once per frame.

## Next

- Touch controls for walk mode (virtual stick; it's keyboard-only today)
- Ship the world as a baked `.sgw` data file (sculpt → export) instead of
  rebuilding genesis + edits at load
- Copy/paste stamps and mirrored symmetry for faster authoring
- District 02, when 01 sells out
