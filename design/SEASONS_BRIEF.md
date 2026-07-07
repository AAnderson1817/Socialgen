# GENESIS v3 MASTER BRIEF — "THE LANTERN, FOUR WATCHES"
### District 01 · Archipelago · One island that holds the whole year, painted to be walked and surveyed to be sold

---

## 1. NORTH STAR

An island where the compass is the calendar: morning light on blossom in the east, noon on deep summer green in the south, ember evening in the west, and a blue hush of permanent winter on the shadowed northern height — one bedrock, one sea, one sky, four weathers, painted like a gouache handscroll you can walk around. The pitch in one sentence: **the year came ashore here and never left, and every deed is a plot of a season.** It must read as one painting from every angle — never four maps glued at a point — and the places where two seasons touch must be the most charged, most wanted ground on the map.

---

## 2. PREMISE & NAME

**The legend — this text goes on the certificate frontispiece, verbatim:**

> Every year, the Year is carried. A walker crosses every country with a pack of weathers on their back, and wherever the walker passes, the season turns. One midwinter the walker saw a lantern burning at a harbor mouth on an island too small to be on the round, came ashore to rest, set the pack down, and slept. The four seasons climbed out quietly and each chose the quarter that suited it, and they keep house there still, waiting to be picked back up. The islanders keep the harbor lantern lit — not to wake the walker, but so that the walker, whenever they wake, will know they were welcome.

**Name: keep "The Lantern."** It has the right ancestry — the lamppost at Lantern Waste burns exactly at the boundary between winter and spring, and this whole island is boundaries. The Lantern is the light that stopped the Year.

**The premise generates every name.** Four rules: (1) Regions are named for *watches of the day*, never seasons — **The Morningside** (east, spring), **The Noonlands** (south, summer), **The Evenlands** (west, autumn), **The Hush** (north, winter). The engine's own sun does the explaining. (2) The walker's spilled kit gives household objects at landscape scale, extending the existing grammar of the Ewer and the Kettles: the Saucer, the Pillow, the Nightcap, the Almanac. (3) A small fixed lexicon of land-words — *force* (waterfall), *tarn*, *beck*, *holt*, *garth*, *edge*, *hollow*, *mead* — plus genitives of the absent owner (the Sleeper's Steps). (4) One or two names darken on inspection (the Burnt Garth, the Tithe). **Never** Springvale/Winterhold — if the name says the season, the landscape is redundant. Every anomaly gets exactly one sentence of *why* as survey marginalia; never a lore dump.

---

## 3. SPATIAL COMPOSITION

**The compass is the clock is the year.** The engine's sun arcs east→west through the *southern* sky (constant z-offset +160) and never reaches north faces. So: **spring east** (the ESE dawn rises on it), **summer south** (noon country, the fully lit shore, the harbor plain), **autumn west** (the setting 0xff9a5a sun rakes it every evening — free golden hour on ember canopy and basalt), **winter north** (the Prow's north flank lives in cool hemisphere-fill forever; the lighting model itself argues that snow survives here). This is the one physically honest layout the renderer offers, and the fiction rides it.

**Five authored edits — and only five — touch rock and water; everything else in this brief is paint, planting, and survey on terrain that already stands.** The scope is declared here, out loud, because the retained heightfield (seed 1866) does not yet hold this composition and the brief refuses to let the mesher discover that first: the northeast this section builds a spring shore on is today 13.5% land — 6.5% where the Force must stand — the river rises from the Ewer's outflow notch at (172,138), not below any frozen force; Lantern Falls is a single ~26-cube sheet; and the Saddle, the Snuffer's col, the Saucer, and Longstride Ford exist in no survey. Genesis v3 therefore re-authors terrain and hydrology before it places a single tree — exactly this numbered list, cited by number everywhere below and repeated verbatim in the closing note. A sixth landform edit is a scope change, not a detail.

1. **The raised shelf.** The one new landmass. Lift the drowned NE shallows (x≈240–312, z≈40–140) into a settled shelf: a cold upper lip at y≈70–84 under the Prow's east shoulder, from which the Stilled Force hangs its ice at (240,104), fingering down-sun through spur-and-gully ground the aspect law can argue over, down to willow meads at y≈30–36 that meet the existing spring coast. One landform serves two watches — its shadowed gullies are the Hush's lowest snow, its lit spurs the Morningside's highest meads — so the Thawline (§8, seam 1) is a fact of rock before it is a line of paint. Nothing under the legacy nine moves (A4).
2. **The re-plumbed river.** Re-source the river in the Milkwater pools at the Stilled Force's foot (242,110, y≈64) and ice-dam the Ewer's old outflow notch at (172,138) — the dam is authored ICE, the lidded lake keeps its water, and the certificate spends its one sentence: *"the Ewer saves its pouring for the walker."* The new course S-curves south off the shelf through the Morningside's willow meads, takes the falls at (230,178), then swings southwest across the Noonlands flats to Lantern Harbor at the river mouth. The dead plateau reach below the notch is backfilled to moor — no second riverbed survives to contradict the story — and the old lower meander is rejoined at (220,237).
3. **The terraced falls.** Recut Lantern Falls (230,178) from one ~26-cube sheet (crest y≈62 to plunge pool y≈35) into 2–3 tiered drops with a catch-pool at every step — a broken fall reads taller, the pools take the riparian willows, and the FALLS placement logic already knows the work; it is asked to do it three times instead of once. The crest keeps its height; only the profile changes.
4. **The carved Saddle and col.** Raise a bare-rock ridge above the treeline, crest ≥y77, running (136,160)→(136,200) south from the massif — wide enough for the Procession's track and its lantern posts, too high and too stony for a single stem. Pin the Wick's knoll at its south end (136,204) and notch the Snuffer's cold col at its north (136,156): the island's only two triple-points, and the ridge exists so they can be authored rather than found.
5. **The sunk Saucer and paved Ford.** Sink the Saucer at (150,88) into the Prow's north flank — a closed basin, rim sealed, no outflow, so ice is all it will ever hold — and pave Longstride Ford at (214,250): a hard gravel sill across the new river, shin-deep, banks stepped so the Procession and the plot tracks cross without a bridge. Small edits, load-bearing: seam 2's domestic hinge, the Almanac's knoll, and money shot 4 stand on the Ford; winter's labor (§5's sawn ICE blocks) stands on the Saucer.

**Asymmetry, enforced:** land areas ≈ **Noonlands 35% / Morningside 27% / Evenlands 22% / The Hush 16%** (±4%, Hush ±3%). Winter is smallest and highest; summer sprawls. Every seam is a fingered, terrain-following contour, never a radius: pathLength/endpointDistance ≥ 1.25 per seam polyline.

**Clash management by topology, not dithering:** the Noonlands **never touches the Hush anywhere** — summer green and winter white are kept apart structurally. And legacy landmarks take the watch their surveyed ground actually keeps, never the one a tidy quadrant would deal them: the Kettles boil mid-island at (168,186), so **an authored Hush finger** runs south off the Prow's cold shoulder past the Ewer's east rim to hold them — spine (164,132)→(168,186), 10–16 cubes wide, cut as a shadow-holding gully so the aspect law defends its snow, flanked by the Morningside on both sides so no summer column ever borders winter (A2 re-verifies every window around (160,170)) — while Glimmer Hollow leaves the Noonlands for the Morningside, the cave of the spring wedge under the Ewer's shoulder, its mouth opening southeast into the dawn exactly as the dug geometry always said (mouth at (153,160)). The Morningside and the Evenlands (the pink/orange clash pair) meet only along **the Saddle**, a short bare-rock ridge above the treeline running south from the massif, so blossom and ember never abut on grass. **Exactly two triple-points exist, both authored:** **The Wick** (136,204) (spring·summer·autumn — the Saddle's south end, mile-zero of the survey, holding the brass Prime Mark) and **The Snuffer** (136,156) (spring·autumn·winter — the cold col at the Saddle's north end, *"where the warm year is put out"*). No 2×2 column window contains all four region ids; 3-distinct windows occur only within r=20 of these two coordinates.

**Shared landforms cross seasons** so it reads as one island: the **river** rises at the Stilled Force's foot on the Thawline (edit 2 above), S-curves south through the Morningside's willow meads, over **Lantern Falls** (2–3 tiered drops with catch-pools — a broken fall reads taller; edit 3), then southwest across the Noonlands flats to **Lantern Harbor**, which sits deliberately **on the spring–summer seam at the river mouth — the thesis at the front door**, and arrival plots double as equinox stock. One sand strand rings the whole coast save under the Organ Pipes, where the wall drops sheer into the sea; one stone family underlies everything. Legacy geography is retained *in fact, not just in name*: the Needle's Eye at its east cove (312,222), the Organ Pipes on the west coast (x≈98), the Wardens in their surveyed southwest water, the Prow at (142,117), the harbor at the south bay — the gazetteer (§9) marks all nine at their surveyed points.

**The Ewer** (crater rim y76, unchanged) sits west-of-center on the autumn–winter seam as the lidded lake: solid ICE on its shaded north half, open dark water south, gold birches on the west rim, dun moor on the south lip, its old outflow ice-dammed (edit 2). **Spring never comes to the Ewer; the certificate says so, and the absence is the asymmetry.** Summer never climbs to it at all.

**The Procession** — a single planted avenue of **waytrees** (one rowan silhouette in four material states: blossom **LEAF_BLOSSOM** / green **LEAF_BROAD** / ember **LEAF_EMBER** / bare BARK_BIRCH trunks) — runs mole → **Longstride Ford** → up the Saddle past the Wick → over the Snuffer → down to **The Pillow**, a boulder at the Prow's south foot, where **The Nightcap**, the last waytree, stands bare. Tree by tree the avenue turns blossom→green→ember→bare: the year readable in one glance, proof this is one world in four weathers. At Longstride Ford stands **The Almanac** — a flat glacial boulder with four brass plates on its faces, the only inland point where all four watches are co-visible at ground level (tested, §11).

**Plan thumbnail** (N up, +x east; **one char = 16 cubes in x × 24 in z** — 24×16 chars covers the full 384×384; `W` Hush `P` Morningside `S` Noonlands `A` Evenlands `^` Prow `E` Ewer `!` Stilled Force `k` Kettles `F` Lantern Falls `r` river `|` Saddle `+` Snuffer `*` Wick `n` Needle's Eye `O` Organ Pipes `w` Wardens `G` Greenvault `o` orchards `H` harbor `≈` sea). Landmark, river, and seam glyphs sit inside the region drawn around them; sub-cell detail (the Ewer's rim stand, the Milkwater) is below map resolution. Region-glyph tally (G counted to the Noonlands): **S 46 / P 39 / A 31 / W 23 of 139 → 33% / 28% / 22% / 17%**, inside A2's bands:

```
≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
≈≈≈≈≈≈≈≈≈WW≈≈≈≈≈≈≈≈≈≈≈≈≈
≈≈≈≈≈≈≈≈≈WWWWWWPP≈≈≈≈≈≈≈
≈≈≈≈≈AAAWWWWWWWPPP≈≈≈≈≈≈
≈≈≈≈≈≈AA^^WWWWW!PP≈≈≈≈≈≈
≈≈≈≈≈≈OAWEWPPPPPr≈≈≈≈≈≈≈
≈≈≈≈≈≈OA+PWPPPPrP≈≈≈≈≈≈≈
≈≈≈≈≈AAA|PkPPPFPP≈≈≈≈≈≈≈
≈≈AAAAAA*PPPPPrP≈≈≈≈≈≈≈≈
≈≈AAAASSSSSSSrPPPPPn≈≈≈≈
≈≈AAAASSGGGSSrPo≈≈≈≈≈≈≈≈
≈≈AAAASSGGSSSrPo≈≈≈≈≈≈≈≈
≈≈≈AAASSSSSSSrP≈≈≈≈≈≈≈≈≈
≈≈w≈SSSSSSSSSHP≈≈≈≈≈≈≈≈≈
≈≈≈≈SSSSSSSSS≈≈≈≈≈≈≈≈≈≈≈
≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈
```

**The journey.** Land at the harbor: the **Overture** — the one composed sightline where all four watches show at once (blossom bank east, the Greenvault's dark mass west, an ember ridgeline beyond it, the Prow's white crown over everything). Then walk sunwise from the **Needle's Eye** at dawn: down the Morningside coast through pink orchard lattice; round the harbor into the Noonlands' hay garths and the Greenvault's cool interior; up the Evenlands under the Organ Pipes with the low sun burning the Tinderbeeches; over the frost-line into the Hush — the Kettles turquoise in their moss halos in white silence, the Hushfirs' black wall, the Saucer's lidded ice — and finally down the **Thawline**, snow giving way to blossom in fingers, back to the arch. Circumnavigation is reading a handscroll of the year; the last page is the first. Except for the Overture, ridgelines and woods conceal each region until approached; winter, especially, is *arrived at*.

---

## 4. MASTER COLOR SCRIPT

Color is the skeleton. The four palettes sit on a **shared ground bass** — one rock (STONE `0x95897a`, BASALT `0x4d4d57`), one sand (SAND `0xc4ad74`), **exactly one WATER hex island-wide** (`0x3d7ea6`), one sky — seasons differ in what *grows on and dusts over* the geology, never in the geology.

**Harmony rules (non-negotiable):**
- **Value script first.** Grayscale squint = 3–4 masses: the Hush the brightest (snow ~0.93 luma), the Hushfirs/Greenvault interiors the darkest (~0.22), all grounds and water in the 0.40–0.65 midband. Adjacent regions sit in different value groups where they meet.
- **Saturation is currency:** ≤10% of exposed cubes above HSV-S 0.55. Fields are muted; accents ring. 60-30-10 at island scale *and* region scale: 60% shared neutrals / 30% regional hue / 10% accent.
- **Warm top, cool flank, baked in:** every new material's side hex is 5–15° cooler and slightly grayer than its `colorTop` — Lambert can only darken, so we pre-paint the cool shadow. (Applies wherever both hexes are defined; single-hex rows are exempt by construction. **Two authored exemptions, written into A5:** the flower carpets FLOWERS_WHITE and FLOWERS_GOLD, whose sides are stem greens a quarter-wheel away by design, and BARK_BIRCH, whose side cools in value only — all three still keep side luma below top luma.)
- **Color-wheel adjacency:** spring→summer analogous greens; summer-green/autumn-red, autumn-orange/winter-blue, winter-blue/spring-pink deliberate complements. Hard cap **6 hue families per frame**.
- **Water is tinted by its bed,** not its fluid: the 0.8-opacity pass shows the solid beneath. Pale SAND beds = turquoise coves; BASALT beds = ink tarns. One fluid hex serves all.
- **Aerial perspective by dithering, zero new materials:** above y≈68, STONE tops dither 30→60% into the paler, cooler existing GRAVEL `0xa09a8e` before snow — altitude turns pale blue-gray for free.
- **Jitter budgets by law:** organic 0.08–0.10; snow, ice, and worked stone 0.00–0.04 — the contrast between busy meadow and serene snowfield is itself composition.

| Season | Ground | Canopy | Water treatment | Accent | **Impossible color** |
|---|---|---|---|---|---|
| **Spring** | GRASS_SPRING `0x9cbe55`/`0x84a648`; FLOWERS_WHITE carpets | LEAF_SPRING `0x95c25e/0x83b054`; LEAF_BLOSSOM `0xf0c6d4/0xdfa9bf`; LEAF_WILLOW `0x82b268/0x6fa05a` | Swollen becks; pale SAND beds in flooded meads | Blossom pink | **MILKWATER `0xa8d8c4`** — jade-milk thaw pools below the Stilled Force; snow that became water but kept winter's color |
| **Summer** | GRASS `0x84a552/0x6d8f44` (existing); FOREST_FLOOR under canopy | LEAF_BROAD, LEAF_PINE (existing) | Coves floored with pale SAND → lagoon-turquoise | FLOWERS_GOLD `0xe0c04a` top — the Gilt Meadow, one hillside of spilled gold | **The Greenvault's heart** — a green too deep for summer: LEAF_BROAD dithered over FOREST_FLOOR in full AO shadow reads near-blue. Spent from *nothing* — zero new materials |
| **Autumn** | GRASS_DUN `0xa8944f/0x93804c` — dun, low-chroma, with mud | LEAF_EMBER `0xd06a24/0xb85a20`; LEAF_GOLD `0xe2b93a/0xc79a24` | Dark BASALT/CLAY beds → ink tarns mirroring ember canopy | Bramble rust | **LEAF_SCARLET `0xd23e1e/0xb13018`** — the Sleeper's Red, rationed to ~12 lone witness trees |
| **Winter** | SNOW (existing); ICE `0xd8e9ef/0xbcd6de` | LEAF_SPRUCE `0x2d4c38/0x24402f`; LEAF_FROST `0xcdd9d5/0xafc2bf` on BARK_BIRCH | Black open water on BASALT beds beside walkable ICE | Kettle turquoise (existing SPRING `0x6fc9bd`) | **ICE_BLUE `0x9ed2e4/0x7fb5cf`** — the blue hour, only in the heart of the frozen force and under-lid crevices |

Every impossible color gets the CRYSTAL treatment: bright hex, brighter top, low jitter, seated in AO-darkened geometry so the 0.52 AO floor makes it ring. No emissive exists and none is needed.

**Identity materials — the testable definition of a season.** A2's interleave test, A3's purity test, and A10's sightline test read this table and nothing else:

| Region | Identity materials | A5 hue signature | A10 sightline signature |
|---|---|---|---|
| The Morningside | GRASS_SPRING, FLOWERS_WHITE, LEAF_SPRING, LEAF_BLOSSOM, LEAF_WILLOW | LEAF_BLOSSOM | LEAF_BLOSSOM |
| The Noonlands | GRASS, LEAF_BROAD, LEAF_PINE, FLOWERS_GOLD | LEAF_BROAD (top) | LEAF_BROAD |
| The Evenlands | GRASS_DUN, LEAF_EMBER, LEAF_GOLD, LEAF_SCARLET, BUSH_BRAMBLE | LEAF_EMBER | LEAF_EMBER |
| The Hush | SNOW, ICE, LEAF_SPRUCE, LEAF_FROST, ICE_BLUE | ICE_BLUE | **SNOW** |

ICE_BLUE keeps winter's seat in A5's hue-separation test, but it is authored into AO shadow precisely so it *cannot* be seen from a mole two regions away — A10 reads winter as SNOW, which crowns the island. Neutrals (STONE, BASALT, SAND, GRAVEL, SOIL, WATER, FOREST_FLOOR, BARK_BIRCH, BUSH_GREEN, BRASS) belong to every region and none, and never trip A3.

---

## 5. REGION BRIEFS

### THE MORNINGSIDE — spring, east, 27%
**Emotional key:** the year's first morning; everything about to happen. **Landforms:** low settled shelf and flooded meads along the river's east reach; soft headlands; the sea arch on the dawn horizon; seed furrows (SOIL lines in grass — labor made visible, no animation needed) and hedgerows snapped to the 12-cube plot grid. Water is spring's element. Its drop of the opposite: one stubborn snow pocket in a −z gully above the meads — the Snow Pocket (248,60). **Named places (commons):** **The Needle's Eye** (312,222) — *"the walker's needle, dropped threading the coast"*; **Lantern Falls** (230,178) — *"the river's three-step laugh; the island's loudest silence"*; **The Bridal Copse** — *the definitive blossom stand, pilgrimage of the pink week*; **The Milkwater** (242,110) — *"the Force drinks itself here"*; **Glimmer Hollow** (153,160) — the cave in the spring wedge under the Ewer's shoulder, its mouth opening southeast into the dawn, moss thick on the south lip — *"the morning steps one chamber in, and no morning has ever come back out."* **Forest:** small, airy, deliberate — the Bridal Copse, Lambgrass Wood, willow ribbons, pink-lattice orchards. **Deeds sell:** morning light every single day, blossom frontage, riverside meads, orchard rows — the honeymoon plots. Blossom-front is scarce because the Copse is small forever.

### THE NOONLANDS — summer, south, 35%
**Emotional key:** deep noon; abundance with a cool dark heart. **Landforms:** the broad lit shore — harbor amphitheater, hay garths with WOOD drying racks, sand coves floored pale so the water goes turquoise. Its opposite-within: the Greenvault's interior, the darkest cool room on the sunlit side. **Named places (commons):** **Lantern Harbor** — *"the light was lit for ships; it caught a walker instead"*; **The Lantern** itself — the squat basalt tower at the mole head (212,322), one CRYSTAL-treated flame cube seated in the lamp-room's AO shadow, bright the way everything here is bright: by contrast — *"not lit to wake the walker; lit so the walker knows they were welcome"*; **The Greenvault** — *"a wood so closed the noon comes through in coins"*; **The Gilt Meadow** (168,278) — *"one field the sun paid in full; mown never, owned never"*. **Forest:** the hero wood — the Greenvault (closure 0.75, 4+ glades, FOREST_FLOOR interior) and Hummock Pines. **Deeds sell:** volume and status — harborside addresses, turquoise-cove waterfront, glade clearings ("a clearing in The Greenvault" is a jewel deed).

### THE EVENLANDS — autumn, west, 22%
**Emotional key:** the lit hour before dark; harvest and smoke. **Landforms:** cliff country — the Organ Pipes' basalt columns (x≈98) take the sunset broadside; high dun moors, ink tarns, hollows carved for AO (notches, undercuts, stepped ledges); cut-log stacks and a cider press by the Rustfall track. Mud and dun grass keep the reds honest. **Named places (commons):** **The Organ Pipes** — *"the sea practices; the island listens"*; **The Tinderbeeches** — *the definitive ember wood, pilgrimage of the red week*; **The Burnt Garth** (70,224) — *"something was celebrated here once, or ended"*; **The Tithe** — a stone jetty below the Pipes (94,158) — *"a tenth of every harvest went into the sea here; the sea has not said why"*; **The Wardens**, offshore to the southwest — *"four who watch the sleeper's seaward side."* **Forest:** the forest region — the Tinderbeeches, Coinbirch Stand (gold crowns on white BARK_BIRCH), Rustfall Wood at the summer seam. Scarlet witness trees stand alone. **Deeds sell:** the writing-cabin fantasy — clifftop solitude over ember canopy, evening light guaranteed by the sun's own geometry; finite VISTA ring.

### THE HUSH — winter, north, 16%
**Emotional key:** an inhabited otherworld, not an absence — the island's richest secrets. **Landforms:** the Prow and its shadowed north flank; snowline dropping to ~y34 here, aspect-driven (−6 in shadowed gullies, +10 on lit spurs); the frozen force; walkable ICE sheets; **The Saucer**, a lidded tarn, 100% ice, with sawn ICE blocks stacked beside it (winter's labor); krummholz fading to bare summit; one green hollow where a hot seep keeps a garden — the Seep Garden (156,98) (opposite-within). **Named places (commons):** **The Prow** — *"the survey calls it a mountain; the islanders call it a shoulder"*; **The Stilled Force** (240,104) — *"a flame of ice above a pool of jade; it will finish falling when the walker wakes"* (the no-animation constraint made into the poem); **The Kettles** (168,186) — *"the walker's kettles, still on the boil"* — turquoise pools in moss halos in snow; **The Saucer** (150,88) — *"what the ice catches, the ice keeps"*; **The Sleeper** — the authored permanent snow-figure set into the Prow's southeast face (146,121), laid across stepped shelves so each tread shades its own riser and the AO holds the white against the sun; read from the willow meads on the river's east reach (vantage pinned at (208,150)): *the garths were first planted the year the walker came, when the Sleeper's arm melted free*; **The Pillow** and **The Nightcap** at the Procession's end. **Forest:** the Hushfirs (spruce 1.0, treeline 64, its shadowed north wall the island's darkest mass) and the Bone Birches. **Deeds sell:** rarity itself — the fewest buildable plots, ice-locked mineral rights, Kettle-shore, force-view. Winter must hold some of the highest-tier deeds on the island, or the design has failed.

---

## 6. FORESTS AS PLACES

**The one law: tree density outside an authored mask is exactly zero.** Every tree belongs to a named wood, a riparian ribbon, an orchard, a hedgerow, or the hermit list. A tree with no address is a bug. This replaces the island-wide fbm scatter (genesis.js:408–451) the founder called out.

**Registry — 9 woods**, each `{name, region, blobs[[x,z,r]…], wobble≈3, mix, coreClosure, edgeFall, glades[]}`; woods never straddle a seam; masks never intersect landmark hold radii (asserted): the Bridal Copse (blossom .90, closure 0.55) and Lambgrass Wood (mixed, 0.50) in the Morningside; the Greenvault (beech .92, 0.75, edgeFall 8) and Hummock Pines (pine 1.0, 0.55) in the Noonlands; the Tinderbeeches (ember .95, 0.65), Coinbirch Stand (gold birch .95, 0.55), Rustfall Wood (ember .40/gold .35/broad .25, 0.60) in the Evenlands; the Hushfirs (spruce 1.0, 0.55) and the Bone Birches (frost birch 1.0, 0.30) in the Hush. `edgeFall` defaults to **5** wherever unlisted; overrides: the Greenvault 8, the Bone Birches 3. Monodominance enforced ±0.05.

**The forest law as one implementable line:** stem acceptance = `coreRate × clamp(edgeD/edgeFall, 0, 1)² × gladeFactor × fbm patchiness`, evaluated as stratified blue-noise on a 3-cube grid — min spacing Chebyshev 3, slope ≤ 2, substrate ∈ {GRASS*, SOIL, FOREST_FLOOR} only. Core rates 0.075–0.085 stems/column broadleaf, 0.06–0.07 conifer (→ closures 0.60–0.75 / 0.45–0.60). Crowns may overhang the mask ≤2; stems never.

**The rest of the law:**
- **Glades:** one per ~1,200 mask columns, radius 4–9, zero stems inside, ≥1 glade ≥r6 per large wood (a 12×12 plot fits — sellable). Floors 50–70% dressed with region flowers — except the Hushfirs' glade, which is dressed with *nothing*: untouched snow, **a bare white room in the firs**. Showpiece glades sit in each wood's **south half** so the player looks into lit trunks.
- **Forest floor:** columns ≥60% leaf-covered in a 5×5 neighborhood swap GRASS→FOREST_FLOOR. Closed canopy over lawn is the #1 fake-forest tell.
- **Riparian ribbon:** willows at 2–5 cubes from river water, density 0.12 tapering to 0, whole 24-cube windows skipped at 35% — the river must flash between curtains.
- **Treeline:** y76 global, **y64 in the Hush**; one named exception: the Coinbirch Stand's Ewer-rim blobs carry `treelineOverride: 80` (the sealed rim tops out y76–78, and the west-rim gold birches are the point of money shot 3) — A3 audits them against the override; 6-cube krummholz band of 1–2-cube stunted clumps below it; no stems below SEA+2.
- **Understory skirts:** bushes at density 0.18 in the mask-edge annulus ±2 cubes (LEAF_FROST doubles as the winter bush). Bushes never count as trees.
- **Hedgerows & orchards:** hedges snapped to plot-grid lines, a standard tree every 18±6; orchards on pitch **exactly 4, zero jitter** — the shock of the lattice against wild woods is the point.
- **Hermits: ≤10 island-wide,** hand-placed, 1.5× stature (4–5 trunk, r3 crown), ≥30 cubes from any stem, **each visible against sky or water from a named vantage** — the Salt Oak above the Needle's Eye, the Mole Pine at the harbor, the Last Pine on the Prow's lit shoulder (the highest tree on the island), the Kettle Birch over the turquoise pools, the Nightcap at the Pillow.
- **Budget:** 2,500–4,500 stems. **Clumping metric:** variance/mean of stems over the 32×32 plot grid ≥ 6.0 (uniform scatter ≈1.0 — the founder's complaint, quantified).

---

## 7. NEW MATERIALS TABLE (exactly 20 additions; 216 palette slots remain)

| Key | Top hex | Side hex | Flags | Jitter | Use |
|---|---|---|---|---|---|
| GRASS_SPRING | `0x9cbe55` | `0x84a648` | solid, ground | 0.08 | Spring ("Freshmead") |
| GRASS_DUN | `0xa8944f` | `0x93804c` | solid, ground | 0.08 | Autumn ("Dun moor") |
| FOREST_FLOOR | `0x564733` | `0x4a3b28` | solid, ground | 0.08 | All woods ("Leafmould") |
| FLOWERS_WHITE | `0xe6dfd2` | `0x7c9a50` | solid, ground | 0.06 | Spring ("Flowering mead") |
| FLOWERS_GOLD | `0xe0c04a` | `0x6d8f44` | solid, ground | 0.06 | Gilt Meadow ("Goldfield") |
| ICE | `0xd8e9ef` | `0xbcd6de` | solid, ground | 0.02 | Winter ("Lake ice") |
| ICE_BLUE | `0x9ed2e4` | `0x7fb5cf` | solid, ground | 0.03 | Force heart, lid crevices |
| LEAF_SPRING | `0x95c25e` | `0x83b054` | solid, ¬ground | 0.10 | Spring broadleaf |
| LEAF_BLOSSOM | `0xf0c6d4` | `0xdfa9bf` | solid, ¬ground | 0.07 | Copse, orchards, waytree-spring |
| LEAF_WILLOW | `0x82b268` | `0x6fa05a` | solid, ¬ground | 0.09 | Riparian |
| LEAF_EMBER | `0xd06a24` | `0xb85a20` | solid, ¬ground | 0.10 | Tinderbeeches |
| LEAF_GOLD | `0xe2b93a` | `0xc79a24` | solid, ¬ground | 0.10 | Coinbirch |
| LEAF_SCARLET | `0xd23e1e` | `0xb13018` | solid, ¬ground | 0.08 | ~12 witness trees |
| LEAF_SPRUCE | `0x2d4c38` | `0x24402f` | solid, ¬ground | 0.08 | Hushfirs |
| LEAF_FROST | `0xcdd9d5` | `0xafc2bf` | solid, ¬ground | 0.06 | Bone Birches + winter bush |
| BARK_BIRCH | `0xd8d3c8` | `0xc6c0b4` | solid, ¬ground | 0.04 | Birch/waytree trunks |
| BUSH_GREEN | `0x5b8a40` | `0x4d7a38` | solid, ¬ground | 0.09 | Spring/summer skirts |
| BUSH_BRAMBLE | `0x9a5a28` | `0x7d451f` | solid, ¬ground | 0.09 | Autumn skirts |
| BRASS | `0xc9a86a` | `0xb08d57` | solid, ¬ground, **no resource** | 0.03 | Lantern-post caps, Prime Mark, Almanac plates, commons boundary stones |
| MILKWATER | — | `0xa8d8c4` | **fluid** | 0 | Thaw pools only |

Notes. Every double-hex row obeys warm-top/cool-flank or one of §4's two named exemptions (the flower carpets shift hue by design; BARK_BIRCH cools in value only) — side luma sits below top luma in every row regardless. **ICE is opaque and walkable by design** — translucent ice would need a third mesher bucket (fluid faces emit only against AIR, fluids are never ground, and the bucket would inherit water's breathing opacity); cut, not worth it. The window effect comes from ICE_BLUE crevices, open-water leads, and ore set flush in the lid. **BRASS carries no resource field** — never mark commons with ore cubes, which leak phantom mineralValue through `countInBox` into adjacent surveys. **MILKWATER behaves as WATER for `riverside`/`wet`** — one line of survey wiring so the new fluid never silently zeroes river traits; its pools are perched catch-basins behind 1-cube gravel sills far above SEA, so they can never read `waterfront` (that trait demands fluid at or below sea level — A8 asserts the riverside read and the waterfront absence), and no basin ever holds two fluids. All new grounds get GROUND_KIND labels; `trees` becomes `(WOOD + BARK_BIRCH trunk cubes)/4`, excluding all LEAF_*/BUSH_*.

---

## 8. THE SEAMS

The border is the premium. Each seam is a named, lantern-posted commons track — basalt posts capped with a single BRASS cube, "never for sale" made legible geography in the certificate's own metal — and each has a buyer.

**1. The Thawline (Hush/Morningside, NE) — the flagship; the collector buys it.** Snow clings to shaded gullies and retreats up sunlit spurs — an interlocking fingered contour the south-sun renders honestly, dithered 4–10 cubes wide, running down the raised shelf (§3, edit 1). Set into it: **The Stilled Force** frozen mid-drop (vertical ICE sheet where the FALLS logic would place water, ICE_BLUE at its heart), melting at its foot into the Milkwater pools that water the blossom meads. The **First Lamp** post stands exactly on the boundary (246,124) — the district's Narnia moment, earned by name. A plot half garden, half snowfield is the island's signature deed.

**2. The River Hinge at Longstride Ford (Morningside/Noonlands, SE) — deliberately domestic; the one a family buys.** Analogous greens; the seam is read through labor, not color: seed furrows one bank, hay rows the other, blossom-pink orchard lattice rhyming with fruit-green lattice across the current. The Almanac on its knoll; the harbor at the seam's mouth; the Procession begins here. Proof the island isn't zoned.

**3. The Smolder Edge (Noonlands/Evenlands, SW) — the two-view vista buyer.** A dry basalt ridge where green rusts over into ember across 15 cubes; Rustfall Wood wholly on the autumn side, bramble skirts on the crest, one scarlet witness tree against the green. Runs to the sea near the Organ Pipes, with the Wardens standing off its foot.

**4. The First Frost (Evenlands/Hush, NW) — the trophy hunter's.** Gold birches below, bone birches above — *the same white BARK_BIRCH trunks*, only the crowns change; the species itself is the seam. **The Ewer** sits here as the lidded lake: solid ICE north, open black water south, a 2–4-cube dithered fringe between, and 6–10 GOLD_ORE/CRYSTAL cubes set flush in the lid — *"what the ice catches, the ice keeps"* — spectacle inside the commons hold, promise of the priced ice elsewhere.

**5. The Saddle (Morningside/Evenlands) — the bare seam.** Pink and orange meet only here, across naked stone above the treeline, with the Wick at one end and the Snuffer at the other. Nothing grows on the border between morning and evening; the certificate calls it *"the hour with no color."*

**Equinox plots** — deeds whose own columns sample two regions — are rare by construction (target 40–70 island-wide) and carry the seam's name on the certificate.

---

## 9. ECONOMY & SURVEY HOOKS

Genesis exports a `regionId` byte per column plus the seam and Procession polylines.

**The Gazetteer** — every named place, machine-readable; A2, A4, and A10 read coordinates from this table and nowhere else († = legacy nine, unmoved):

| Place | Watch | x, z | Hold r |
|---|---|---|---|
| The Needle's Eye † | Morningside | 312, 222 | 6 |
| Lantern Falls † | Morningside | 230, 178 | 6 |
| Glimmer Hollow † | Morningside | 153, 160 | 6 |
| Lantern Harbor † | seam (M/N) | 212, 318 | 6 |
| The Prow † | Hush | 142, 117 | 12 |
| The Ewer † | seam (E/H) | 158, 132 | 12 |
| The Kettles † | Hush | 168, 186 | 8 |
| The Organ Pipes † | Evenlands | 98, 132 (wall z 84–183) | 10 |
| The Wardens † | offshore SW | 40, 324 | 8 |
| The Lantern (tower) | harbor mole | 212, 322 | 4 |
| The Stilled Force | Thawline | 240, 104 | 8 |
| The Milkwater | Morningside | 242, 110 | 6 |
| First Lamp | Thawline | 246, 124 | 4 |
| Snow Pocket | Morningside | 248, 60 | 6 |
| The Bridal Copse (heart) | Morningside | 266, 180 | 6 |
| Longstride Ford | seam (M/N) | 214, 250 | 6 |
| The Almanac | seam (M/N) | 218, 246 | 10 |
| The Wick | triple point | 136, 204 | 10 |
| The Snuffer | triple point | 136, 156 | 8 |
| The Saddle | seam (M/E) | ridge (136,160)→(136,200) | track ⊕2 |
| The Pillow | Hush | 140, 140 | 4 |
| The Nightcap | Hush | 140, 138 | in Pillow hold |
| The Sleeper (stencil) | Hush | 146, 121 | 6 |
| The Saucer | Hush | 150, 88 | 10 |
| Seep Garden | Hush | 156, 98 | 5 |
| The Third Kettle | Hush | 172, 188 | in Kettles hold |
| The Gilt Meadow | Noonlands | 168, 278 | 12 |
| The Greenvault (heart glade) | Noonlands | 144, 252 | 6 |
| The Tithe | Evenlands | 94, 158 | 6 |
| The Burnt Garth | Evenlands | 70, 224 | 6 |

Woods enter by their registry blobs, hermits by the hermit list, seam tracks and the Procession as polylines dilated 2.

**New traits, all cube-derived, live-re-survey safe, with explicit weights:**

- `region` — majority regionId sampled every 3 columns; deed carries the watch-name plus a microseason epithet chosen by region+trait hash (*"East wind melts the ice"*), never "snow-adjacency bonus." +0 (identity).
- `equinox` — the plot's own 144 columns sample ≥2 regionIds with minority ≥25%. **+14.**
- `seamFrontage` — plot center within 6 of a seam or Procession polyline. **+8; does not stack with equinox** (the greater applies) — frontage stays scarce, not inflationary.
- `blossomFront` / `emberFront` — ≥40 LEAF_BLOSSOM / LEAF_EMBER-or-GOLD cubes in the plot+6 band. **+12 / +10.**
- `gladePlot` — ≥55% of columns inside a wood mask, zero stems, <10% leaf overhead → "Clearing in [wood]." **+12.**
- `orchardRow` — ≥6 stems on the exact pitch-4 lattice. **+8.**
- `iceShore` — ICE cubes replace fluid at the plot edge. `lakefront` is re-specced to require an adjacent above-sea open-fluid cube (today it keys on `has('lake')` landmark proximity, which icing cannot remove); with that change the north-Ewer shore genuinely trades `lakefront` (+18) for `iceShore` (**+10**) — winter sells a different verb, and the two never stack. Covered by a repricing fixture.
- **`iceLocked` minerals** — resource cubes within or directly beneath walkable ICE count at **1.5× mineralValue** inside the existing `min(mineralValue/90,1)·12` cap; the certificate says exactly this: *"unminable until the walker wakes."* (Existing gold veins stay confined to x<165 — the **west** half: the Evenlands sits over the bank, and evening guards the gold. Winter's own supply is authored, not implied: 3–5 CRYSTAL/GOLD_ORE pockets seeded beneath walkable ICE in Hush columns — off the Saucer's hold, along the Ewer's north-shore aprons — outside every commons hold, so A9's iceLocked ledger is stocked.)
- `woodNear` — every named wood enters INFLUENCE as `{hold:0, near:18}`, feeding the existing `3 × namedNear` term; hermits enter at `{hold:0, near:8}` ("near the Last Pine").
- `hotShore` — existing springs trait (+14), now a Hush scarcity.

**Commons (hold radii per the gazetteer, never sold, BRASS-marked):** all nine legacy landmarks by name and coordinate, plus the Stilled Force (8), the Milkwater (6), the Saucer (10), the Almanac (10), the Wick (10), the Snuffer (8), the Tithe (6), the Gilt Meadow (12), the Burnt Garth (6), the Sleeper's stencil (6), the Lantern tower (4), each wood's heart glade (6), the Procession and all seam tracks (polylines dilated 2).

**Scarcity stories:** Noonlands = volume and status (most plots, harbor premium, glade jewels). Morningside = blossom scarcity (the Copse is small forever). Evenlands = vista scarcity (finite clifftop ring, evening light priced in). The Hush = absolute scarcity (fewest buildable; must clear ≥25 buildable and ≥3 LANDMARK-tier). Equinox plots = the flagship rarity across all five seams. No rerolls: this one arrangement of the year is the entire supply, forever.

---

## 10. GUARDRAILS — what this island must NEVER look like

1. **Never a pizza:** no four-corner point, two authored triple-points only, unequal areas, seam sinuosity ≥1.25.
2. **Never a reskin:** each region has its own landforms and labors — spring floods and furrows, summer hay, autumn presses and log stacks, winter ice-cutting.
3. **Never season-in-the-name:** watches, kit, land-words, events, absent owners.
4. **Never full saturation:** fields muted, accents ≤10%; autumn keeps its mud; candy is failure.
5. **Never an empty winter:** the Hush is the secret-richest region or the design failed.
6. **Never the symmetric checklist:** spring is best at water, summer at coast and canopy, autumn at forests and cliffs, winter at verticality and secrets — deliberately unequal.
7. **Never unmotivated anomaly:** every seam and wonder carries one sentence of myth on the certificate — no more, no less.
8. **Never scattered trees:** zero stems outside masks; a tree with no address is a bug.
9. **Never all-visible:** the Overture and the Almanac are the two composed exceptions; everything else is earned by walking.
10. **Never break the engine's word:** no emissive, no particles, no animation beyond the water breathe; brightness is done the CRYSTAL way; the frozen waterfall doesn't move *because it is ice*.

Ship-gate audits, in order: grayscale squint (3–4 masses), hue count per frame (≤6), chroma histogram (accents rare), silhouette distinct from four compass angles, and the negative-space walk — the empty bay, the bare snowfield, the big meadow are the rests between notes, and they are still deeds.

---

## 11. ACCEPTANCE CRITERIA (headless, in test/run.js; any FAIL blocks the build)

- **A1 Determinism:** two genesis runs from seed 1866 → identical world-buffer hashes; deeds reprice identically across runs.
- **A2 Regions & topology:** land coverage 0.35/0.27/0.22/0.16 (±0.04; Hush ±0.03); no 2×2 window contains all four regionIds; 3-distinct windows only within r=20 of the Wick (136,204) and the Snuffer (136,156), read from the §9 gazetteer; 2-distinct windows legal everywhere (the Kettle finger's flanks around (160,170) read Hush–Morningside only — re-verified); zero Noonlands column 4-adjacent to a Hush column; every seam polyline pathLength/endpointDistance ≥ 1.25; sampling each seam every 8 cubes along its length, the perpendicular mixed band (both regions' §4 identity materials interleaved) spans 4–20 cubes at every sample.
- **A3 Forests:** stems outside union(masks ∪ riparian ∪ orchards ∪ hedges⊕2) ≤ hermit count ≤ 10, each matching an authored hermit within 1 cube; plot-grid stem variance/mean ≥ 6.0; per-wood core closure ±0.08 (edgeFall per registry: default 5, Greenvault 8, Bone Birches 3); substrate 100% GRASS*/SOIL/FOREST_FLOOR; treeline (per-wood overrides included: the Coinbirch rim stand audits at y80) and SEA+2 violations = 0; monodominance ±0.05; **season purity: zero §4 identity materials outside their region ∪ its seam bands ∪ the closed exemption list — the Procession polyline ⊕2 (all four waytree states), the Snow Pocket (248,60) r6 (SNOW in spring), the Seep Garden (156,98) r5 (GRASS_SPRING in winter) — with exempted cubes hard-capped at 500 island-wide**; total stems 2,500–4,500; orchard stems 100% on pitch-4 points; hermit NN distance ≥ 30.
- **A4 Landmarks & commons:** every gazetteer place exists at its table coordinates; legacy nine unmoved — Needle's Eye (312,222), Lantern Falls (230,178), Glimmer Hollow (153,160), Lantern Harbor (212,318), Prow (142,117), Ewer (158,132), Kettles (168,186), Organ Pipes (98,132), Wardens (40,324); the Lantern tower stands at the mole head (212,322) with its CRYSTAL flame cube seated; hold radii intersect no wood mask; all hold plots survey `commons=true`, unbuildable; BRASS cubes appear only on commons plots; the Sleeper's snow stencil matches its stored mask exactly.
- **A5 Color:** palette additions ≤ 20; the **four named signatures** — LEAF_BLOSSOM, LEAF_BROAD top, LEAF_EMBER, ICE_BLUE — pairwise circular hue distance ≥ 40° (tested on these hexes, not region means, so analogous field greens can't fail it); exposed cubes with HSV-S > 0.55 ≤ 10% per region; mean top-face luma of the Hush exceeds every other region by ≥ 0.08 (softened from 0.12 and pre-validated on a mock composition — the Hush also owns the island's darkest masses: the Hushfirs' north wall, the black leads, the basalt beds); the darkest 32×32 luma patch lies inside the Hushfirs; side luma < top luma for every new material defining both (§4's named carpet/trunk exemptions are exempt from the 5–15° hue law, never from the luma law).
- **A6 Sun honesty:** along the Thawline sampled every 8 cubes, snowline y has σ ≥ 4, and mean snowline on −z aspects ≤ (+z aspects − 6) — the thaw fingers are real, not noise.
- **A7 Economy:** equinox plots 40–70; Hush buildable ≥ 25 with ≥ 3 LANDMARK-tier; every region contains ≥ 1 LANDMARK-tier deed; a creator-edit fixture covering ICE ground semantics, the re-specced `lakefront`, and iceLocked pricing re-surveys without flag errors.
- **A8 Water:** exactly one WATER hex island-wide; MILKWATER cubes only within 20 of the Stilled Force; MILKWATER satisfies `riverside` and `wet` in a fixture plot — and `waterfront` is asserted **absent** there (the pools are perched above SEA; above-sea fluid is riverside by definition).
- **A9 Ice:** the Saucer's surface 100% ICE; the Ewer's surface 40–60% ICE (north half) with a 2–4-cube mixed fringe; ≥ 6 resource cubes flush in commons ice lids; ≥ 1 buildable Hush plot with iceLocked minerals (supplied by the authored Hush pockets, §9).
- **A10 Sightlines & Procession:** voxel ray-fans (180° north from the harbor mole column; **full 360° from the Almanac column** — the Noonlands lies mostly south of Longstride Ford; 320-cube budget each) each hit ≥ 1 A10 sightline signature of all four regions (§4 identity table: LEAF_BLOSSOM, LEAF_BROAD, LEAF_EMBER, **SNOW**); the Procession has ≥ 40 waytrees at spacing 8±2, crosses all four regionIds, and its state sequence is **monotone blossom→green→ember→bare along arclength**, ending at the Nightcap.

---

## 12. MONEY SHOTS

1. **The Overture** — from Lantern Harbor mole, looking north, t≈0.25. Blossom bank right, Greenvault dark mass left, ember ridge behind, the Prow's white crown crowning the frame. The thesis in one screenshot, proven by A10's ray-fan; low camera, brass-capped mole posts foreground.
2. **First Light on the Stilled Force** — from the Milkwater pools looking northwest, t≈0.08, dawn. The ESE sun reaches the east-facing ice for one hour a day, exactly as the legend promises — the frozen fall lit gold, ICE_BLUE heart in AO dark, jade-milk pools below, first blossom at the frame's bottom edge. **Shoot it then or not at all.**
3. **The Lidded Lake** — from the Ewer's west rim among gold birches, t≈0.85. Warm low light on the autumn rim; the shaded ice half going blue; gold glinting flush in the lid. Shoot slightly downward to catch both halves of the water.
4. **The Procession** — telephoto down the avenue from Longstride Ford, t≈0.35: waytrees running blossom→green→ember→bare up the Saddle, the Snuffer's col and the Pillow terminating the line. The continuity proof, self-composing.
5. **The Kettles at the Hushfirs' Wall** — from the frozen tarn at the Kettles' east lip — the survey calls it the Third Kettle (172,188), inside the Kettles' hold — t≈0.9. White field, the black north wall of the spruce wood, three turquoise pools ringed in moss — the loudest color on the island surrounded by the most silence, done with two existing hexes and the CRYSTAL trick.

---

## FOOTNOTES — adaptations & rejections

- **B2's "The Candle"** — line adopted verbatim, name rejected: two flame-names in one gazetteer (the Lantern, the Candle) dilute both, so the landmark stays the Stilled Force.
- **B2's STONE_FROST / B3's RIME altitude materials** — rejected: aerial perspective is fully funded by the mandated STONE→GRAVEL dither, spending zero palette slots.
- **B2's equinox band of 8–24** — rejected as gerrymandered-tight for five seams on a 1,024-plot grid; 40–70 with the tightened plot-only definition is testable and honest.
- **B3's "Pane" region names** — rejected: diagram labels, not lived geography; the watch-names carry the same sun logic in warmer language.
- **B1's BUSH_FROST** — cut to fund BRASS within the 20-slot budget; LEAF_FROST doubles as the winter bush, per B3.
- **B3's half-MELTWATER Ewer** — rejected: two fluids in one basin is an interface the mesher has never rendered; the lidded lake uses solid ICE against open WATER instead.

*Genesis v3 replaces the terrain-finishing and hydrology passes (the five authored edits of §3 — the raised shelf, the re-plumbed river, the terraced falls, the carved Saddle and col, the sunk Saucer and paved Ford), the tree pass, and the material pass; it will trip every checksum in test/run.js, intentionally, once. Set the new hash, and the year stays put — deterministic, surveyed, never rerolled. Where the walker sleeps, the light is kept burning. Paint accordingly.*
