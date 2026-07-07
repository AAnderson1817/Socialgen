/* Socialgen core — cube material palette.
   Cubes ARE the data model: every voxel is one byte indexing into this palette,
   and every gameplay property (is it ground? does it hold a resource? does the
   surveyor price it?) hangs off the palette entry, not off the renderer.
   Pure JS: safe for browser <script>, node import, and headless tests. */
(() => {
const SG = (globalThis.SG ||= {});

// entry: { id, key, name, color, colorTop?, solid, fluid, ground, jitter, resource? }
//  solid   — occupies space / occludes neighbours (meshing + AO)
//  fluid   — rendered in the translucent pass, never a building surface
//  ground  — counts as terrain surface for surveys (trees/canopy do not)
//  jitter  — per-cube lightness variance, 0..1 (organic patchwork look)
//  resource— { kind, value } minable value discovered inside a plot's column
const DEFS = [
  ['AIR',        null,     { solid: false }],
  ['WATER',      0x3d7ea6, { fluid: true, jitter: 0 }],
  ['SPRING',     0x6fc9bd, { fluid: true, jitter: 0 }],                       // hot mineral water
  ['BEDROCK',    0x23231f, { jitter: 0 }],
  ['STONE',      0x95897a, { jitter: 0.05 }],
  ['BASALT',     0x4d4d57, { jitter: 0.06 }],                                 // columnar cliffs, sea stacks
  ['SOIL',       0x6f5136, { jitter: 0.06 }],
  ['GRASS',      0x6d8f44, { top: 0x84a552, jitter: 0.08 }],
  ['SAND',       0xc4ad74, { top: 0xd2bd82, jitter: 0.05 }],
  ['GRAVEL',     0xa09a8e, { jitter: 0.09 }],
  ['CLAY',       0xb57052, { jitter: 0.05 }],
  ['SNOW',       0xeef1f2, { top: 0xf6f8f8, jitter: 0.02 }],
  ['MOSS',       0x5d7f4e, { jitter: 0.07 }],                                 // damp stone near falls & cave mouths
  ['WOOD',       0x6b4f35, { ground: false, jitter: 0.04 }],
  ['LEAF_PINE',  0x2f5638, { top: 0x38623f, ground: false, jitter: 0.09 }],
  ['LEAF_BROAD', 0x53823a, { top: 0x619547, ground: false, jitter: 0.10 }],
  ['COPPER_ORE', 0x6f9282, { jitter: 0.05, resource: { kind: 'copper', value: 1 } }],
  ['IRON_ORE',   0x9b8571, { jitter: 0.05, resource: { kind: 'iron', value: 2 } }],
  ['GOLD_ORE',   0xc9a84c, { jitter: 0.04, resource: { kind: 'gold', value: 6 } }],
  ['CRYSTAL',    0x9a74d0, { top: 0xb08ce0, jitter: 0.06, resource: { kind: 'crystal', value: 10 } }],
  // ---- Genesis v3, "Four Watches": exactly 20 additions (design/SEASONS_BRIEF.md §7) ----
  ['GRASS_SPRING', 0x84a648, { top: 0x92b258, jitter: 0.08 }],   // spring "Freshmead" (top kept under the loudness law)
  ['GRASS_DUN',    0x93804c, { top: 0xa8944f, jitter: 0.08 }],   // autumn "Dun moor"
  ['FOREST_FLOOR', 0x4a3b28, { top: 0x564733, jitter: 0.08 }],   // under closed canopy, "Leafmould"
  ['FLOWERS_WHITE',0x7c9a50, { top: 0xe6dfd2, jitter: 0.06 }],   // spring carpets (stem-green sides by design)
  ['FLOWERS_GOLD', 0x6d8f44, { top: 0xe0c04a, jitter: 0.06 }],   // the Gilt Meadow
  ['ICE',          0xbcd6de, { top: 0xd8e9ef, jitter: 0.02 }],   // walkable lake ice (opaque solid by design)
  ['ICE_BLUE',     0x7fb5cf, { top: 0x9ed2e4, jitter: 0.03 }],   // the blue hour: force heart, lid crevices
  ['LEAF_SPRING',  0x83b054, { top: 0x95c25e, ground: false, jitter: 0.10 }],
  ['LEAF_BLOSSOM', 0xdfa9bf, { top: 0xf0c6d4, ground: false, jitter: 0.07 }],
  ['LEAF_WILLOW',  0x6fa05a, { top: 0x82b268, ground: false, jitter: 0.09 }],
  ['LEAF_EMBER',   0xb85a20, { top: 0xd06a24, ground: false, jitter: 0.10 }],
  ['LEAF_GOLD',    0xc79a24, { top: 0xe2b93a, ground: false, jitter: 0.10 }],
  ['LEAF_SCARLET', 0xb13018, { top: 0xd23e1e, ground: false, jitter: 0.08 }], // ~12 witness trees, rationed
  ['LEAF_SPRUCE',  0x24402f, { top: 0x2d4c38, ground: false, jitter: 0.08 }],
  ['LEAF_FROST',   0xafc2bf, { top: 0xcdd9d5, ground: false, jitter: 0.06 }], // doubles as the winter bush
  ['BARK_BIRCH',   0xc6c0b4, { top: 0xd8d3c8, ground: false, jitter: 0.04 }],
  ['BUSH_GREEN',   0x4d7a38, { top: 0x5b8a40, ground: false, jitter: 0.09 }],
  ['BUSH_BRAMBLE', 0x7d451f, { top: 0x9a5a28, ground: false, jitter: 0.09 }],
  ['BRASS',        0xb08d57, { top: 0xc9a86a, ground: false, jitter: 0.03 }], // commons metal — never a resource
  ['MILKWATER',    0xa8d8c4, { fluid: true, jitter: 0 }],                     // jade thaw pools below the Force
];

const MAT = {};      // key -> id
const PALETTE = [];  // id  -> entry
DEFS.forEach(([key, color, opts], id) => {
  const e = {
    id, key,
    name: key.charAt(0) + key.slice(1).toLowerCase().replace('_ore', ' ore').replace('leaf_', ''),
    color: color ?? 0,
    colorTop: opts.top ?? color ?? 0,
    solid: opts.solid !== false && !opts.fluid,
    fluid: !!opts.fluid,
    ground: opts.ground !== false && !opts.fluid && opts.solid !== false,
    jitter: opts.jitter ?? 0,
    resource: opts.resource || null,
  };
  MAT[key] = id;
  PALETTE[id] = e;
});

// flat lookup tables for the mesher's hot loops
const opaque = new Uint8Array(PALETTE.length);
const fluid = new Uint8Array(PALETTE.length);
PALETTE.forEach(e => { opaque[e.id] = e.solid ? 1 : 0; fluid[e.id] = e.fluid ? 1 : 0; });

SG.MAT = MAT;
SG.PALETTE = PALETTE;
SG.OPAQUE = opaque;
SG.FLUID = fluid;
SG.isOpaque = id => opaque[id] === 1;
})();
