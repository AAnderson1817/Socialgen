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
  ['STONE',      0x8b8477, { jitter: 0.05 }],
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
  ['LEAF_BROAD', 0x53823a, { top: 0x619340, ground: false, jitter: 0.10 }],
  ['COPPER_ORE', 0x6f9282, { jitter: 0.05, resource: { kind: 'copper', value: 1 } }],
  ['IRON_ORE',   0x9b8571, { jitter: 0.05, resource: { kind: 'iron', value: 2 } }],
  ['GOLD_ORE',   0xc9a84c, { jitter: 0.04, resource: { kind: 'gold', value: 6 } }],
  ['CRYSTAL',    0x9a74d0, { top: 0xb08ce0, jitter: 0.06, resource: { kind: 'crystal', value: 10 } }],
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

// occludes(id): does this cube hide the faces of solid neighbours?
const opaque = new Uint8Array(PALETTE.length);
PALETTE.forEach(e => { opaque[e.id] = e.solid ? 1 : 0; });

SG.MAT = MAT;
SG.PALETTE = PALETTE;
SG.isOpaque = id => opaque[id] === 1;
})();
