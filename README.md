# Socialgen — Archipelago

**One authored voxel world. Plots people actually want.**

This repo contains District 01, **The Lantern**: a single hand-composed cube
island where every parcel is surveyed from the cubes themselves and sold as a
scarce deed. There is no terrain generator button. There is no seed lottery.
The island is 1 of 1, the named places are held in common trust, and every
buyer is every other buyer's neighbour — that is the product.

## Run it

```
node serve.js          # → http://localhost:8017
# or: python3 -m http.server 8017
```

Open in a browser. Drag to orbit, scroll to zoom, right-drag/two-finger to
pan, tap a parcel to survey it, claim it with gems (simulated wallet).

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

## Test it

```
node test/run.js       # 53 headless assertions, no browser needed
```

The entire world model is pure JS with zero rendering dependencies, so the
tests build the full district (~300ms), verify its landmarks structurally
(the falls really are a vertical sheet of water cubes, the cave really is
roofed air, the arch really spans open water), and check the survey economy
(buildable counts, waterfront scarcity, tier distribution, commons held in
trust, end-to-end determinism).

## Why cubes

The previous prototype was a heightmap: one surface height per (x,z). Its
caves were painted black circles and its arch was a floating torus prop —
the *most desirable* features of a landscape (interiors, overhangs, tunnels,
things you can be inside) were exactly the ones it could not represent.

Cubes fix that, and they are also the data model. Every voxel is one byte
into a palette (`src/core/palette.js`) that carries gameplay properties:
whether it's ground, whether it's fluid, what resource it holds. A plot is
an 8×8 bundle of columns owned bedrock-to-sky, so a deed can include ore
that nobody has found yet — value is *inside* the land, not just on it.

## Why one authored island

Procedural variety is worthless to a land economy: if a better waterfall is
one reroll away, no waterfall is worth anything. Scarcity requires a fixed,
shared, *composed* place with names people can meet at. The generator that
built the heightmap prototype survives here only as a set of texture
brushes inside `src/core/genesis.js` — every landmark is placed at chosen
coordinates, and the file reads as a composition, not an algorithm:

- **The Prow** — snow-capped massif
- **The Ewer** — crater lake on its shoulder
- **Lantern Falls** — the lake's outflow leaping the shoulder cliff
- **Glimmer Hollow** — a real cave tunnel into a crystal geode
- **The Kettles** — hot-spring terrace
- **The Needle's Eye** — a stone sea arch over the east cove
- **The Organ Pipes** — sheer basalt columns on the west face
- **The Wardens** — sea stacks in the south-west water
- **Lantern Harbor** — the sheltered bay the settlement plain wraps around

`DISTRICT_SEED` is fixed forever. Change a number in genesis and you have
changed the district for everyone — that's the point, and the checksum test
will tell you that you did.

## Architecture

```
src/core/   pure JS, no THREE, runs headless in node
  palette.js   cube materials + gameplay properties
  world.js     chunk-free Uint8 voxel store, column-contiguous, RLE serialization
  mesher.js    greedy mesher: face culling, merged quads, baked AO + shading
  raycast.js   Amanatides–Woo DDA — exact voxel picking, no proxy meshes
  genesis.js   the authored composition of District 01
  survey.js    plots = 8×8 columns; traits/score/tier/price derived from cubes
src/app/    THREE.js layer (r128, vendored)
  render.js    chunk meshes, ocean, sun/sky, landmark labels, drapes, beacons
  main.js      camera rig, DDA picking, deed card, wallet, persistence
test/run.js  headless suite
vendor/      three.min.js r128 (vendored — works offline)
```

The world is 384×384×128 (18MB raw, ~2.4MB serialized) — landscape scale:
a cube is small against the land, trees are three cubes of crown, the Prow
rises ~74 cubes over the sea and Lantern Falls drops ~26. Plots are 12×12
columns → a 32×32 survey grid, ~250 buildable deeds, LANDMARK tier scarce.
The full mesh builds in under a second (greedy mesher with height-clamped
sweeps); edits remesh only their 32×32 chunk, batched once per frame.

## Next

- **Genesis v3 — the four-season rebuild.** The full master brief (the
  design prompt, agreed before any code changes) lives at
  [`design/SEASONS_BRIEF.md`](design/SEASONS_BRIEF.md): one island, four
  watches — the Morningside (spring), the Noonlands (summer), the
  Evenlands (autumn), the Hush (winter) — with named woods replacing
  scattered trees, five authored terrain edits, 20 new materials, and
  headless acceptance criteria A1–A10.
- Player-scoped building: gate edits to plots whose deed you hold (creator
  mode already carries the machinery — it just skips the ownership check)
- Ship the world as a baked `.sgw` data file (sculpt → export) instead of
  rebuilding genesis + edits at load
- Copy/paste stamps and mirrored symmetry for faster authoring
- District 02, when 01 sells out
