/* Socialgen core — the gazetteer of District 01, "The Lantern, Four Watches".
   The design brief (design/SEASONS_BRIEF.md) made machine-readable: every
   named place with coordinates and commons hold radius, the nine-wood
   registry, the region skeletons, and the survey epithets. The acceptance
   suite reads coordinates from here and nowhere else. Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});

// region ids (0 = unassigned/sea in the region map)
const REGION = { NONE: 0, MORNING: 1, NOON: 2, EVEN: 3, HUSH: 4 };
const REGION_NAME = ['—', 'The Morningside', 'The Noonlands', 'The Evenlands', 'The Hush'];
const REGION_SEASON = ['—', 'spring', 'summer', 'autumn', 'winter'];

/* ---- the gazetteer (§9): name, watch, x, z, hold radius; label = sprite ----
   † = legacy places. Lantern Falls, the harbor and the Wardens sit at the
   brief's new coordinates (the re-plumbed river moved them); the gazetteer
   is the coordinate authority (brief §9). */
const GAZETTEER = [
  { key: 'arch',      name: "The Needle's Eye",  x: 312, z: 222, hold: 6,  label: true },
  { key: 'falls',     name: 'Lantern Falls',     x: 230, z: 178, hold: 6,  label: true },
  { key: 'cave',      name: 'Glimmer Hollow',    x: 153, z: 160, hold: 6,  label: true },
  { key: 'harbor',    name: 'Lantern Harbor',    x: 212, z: 318, hold: 6,  label: true },
  { key: 'summit',    name: 'The Prow',          x: 142, z: 117, hold: 12, label: true },
  { key: 'lake',      name: 'The Ewer',          x: 158, z: 132, hold: 12, label: true },
  { key: 'springs',   name: 'The Kettles',       x: 168, z: 186, hold: 8,  label: true },
  { key: 'pipes',     name: 'The Organ Pipes',   x: 98,  z: 132, hold: 10, label: true },
  { key: 'stacks',    name: 'The Wardens',       x: 40,  z: 324, hold: 8,  label: true },
  { key: 'lantern',   name: 'The Lantern',       x: 212, z: 322, hold: 4,  label: false },
  { key: 'force',     name: 'The Stilled Force', x: 240, z: 104, hold: 8,  label: true },
  { key: 'milkwater', name: 'The Milkwater',     x: 242, z: 110, hold: 6,  label: false },
  { key: 'firstlamp', name: 'First Lamp',        x: 246, z: 124, hold: 4,  label: false },
  { key: 'snowpocket',name: 'Snow Pocket',       x: 248, z: 60,  hold: 6,  label: false },
  { key: 'copse',     name: 'The Bridal Copse',  x: 266, z: 180, hold: 6,  label: true },
  { key: 'ford',      name: 'Longstride Ford',   x: 214, z: 250, hold: 6,  label: false },
  { key: 'almanac',   name: 'The Almanac',       x: 218, z: 246, hold: 10, label: true },
  { key: 'wick',      name: 'The Wick',          x: 136, z: 204, hold: 10, label: true },
  { key: 'snuffer',   name: 'The Snuffer',       x: 136, z: 156, hold: 8,  label: false },
  { key: 'pillow',    name: 'The Pillow',        x: 140, z: 140, hold: 4,  label: false },
  { key: 'sleeper',   name: 'The Sleeper',       x: 146, z: 121, hold: 6,  label: false },
  { key: 'saucer',    name: 'The Saucer',        x: 150, z: 88,  hold: 10, label: true },
  { key: 'seep',      name: 'Seep Garden',       x: 156, z: 98,  hold: 5,  label: false },
  { key: 'gilt',      name: 'The Gilt Meadow',   x: 168, z: 278, hold: 12, label: true },
  { key: 'vaultglade',name: 'The Greenvault',    x: 144, z: 252, hold: 6,  label: true },
  { key: 'tithe',     name: 'The Tithe',         x: 94,  z: 158, hold: 6,  label: false },
  { key: 'garth',     name: 'The Burnt Garth',   x: 70,  z: 224, hold: 6,  label: false },
];

/* ---- the nine-wood registry (§6) ----
   blobs [[x,z,r]...]; mix by leaf material key; coreClosure is the canopy
   target the acceptance test measures; edgeFall default 5. */
/* Wood masks are clipped to their region (∪ a 10-cube seam grace) at build
   time, so generous radii can't leak a season's leaves across a boundary.
   Autumn's woods stay deliberately small: ember and gold are loud hexes and
   A5's saturation budget is the law — autumn spends its canopy like accent. */
const WOODS = [
  { key: 'bridalcopse', name: 'The Bridal Copse', region: REGION.MORNING,
    blobs: [[266, 180, 23], [255, 170, 16]], mix: { LEAF_BLOSSOM: 0.9, LEAF_SPRING: 0.1 },
    coreClosure: 0.55, edgeFall: 5, rise: true },
  { key: 'lambgrass', name: 'Lambgrass Wood', region: REGION.MORNING,
    blobs: [[272, 220, 36], [256, 236, 27], [284, 202, 17], [250, 212, 20]], mix: { LEAF_SPRING: 0.6, LEAF_WILLOW: 0.2, LEAF_BLOSSOM: 0.2 },
    coreClosure: 0.50, edgeFall: 5, rise: true },
  { key: 'greenvault', name: 'The Greenvault', region: REGION.NOON,
    blobs: [[150, 256, 50], [128, 242, 34], [166, 276, 29], [136, 272, 24], [178, 258, 22]], mix: { LEAF_BROAD: 0.92, LEAF_PINE: 0.08 },
    coreClosure: 0.75, edgeFall: 8, rise: true },
  { key: 'hummock', name: 'Hummock Pines', region: REGION.NOON,
    blobs: [[194, 286, 22], [182, 298, 17], [208, 274, 16]], mix: { LEAF_PINE: 1.0 },
    coreClosure: 0.55, edgeFall: 5, rise: true },
  { key: 'tinderbeeches', name: 'The Tinderbeeches', region: REGION.EVEN,
    blobs: [[84, 196, 10], [94, 206, 8], [78, 184, 7]], mix: { LEAF_EMBER: 0.95, LEAF_GOLD: 0.05 },
    coreClosure: 0.65, edgeFall: 5, rise: true },
  { key: 'coinbirch', name: 'Coinbirch Stand', region: REGION.EVEN,
    blobs: [[140, 132, 7], [135, 139, 6], [116, 126, 7]], mix: { LEAF_GOLD: 0.95, LEAF_EMBER: 0.05 },
    coreClosure: 0.55, edgeFall: 5, treelineOverride: 80, birch: true },
  { key: 'rustfall', name: 'Rustfall Wood', region: REGION.EVEN,
    blobs: [[106, 232, 10], [114, 244, 9]], mix: { LEAF_EMBER: 0.5, LEAF_GOLD: 0.5 },
    coreClosure: 0.60, edgeFall: 5, rise: true, riseTarget: 57 }, // high enough that its embers clear the Greenvault from the mole (§12 Overture)
  { key: 'hushfirs', name: 'The Hushfirs', region: REGION.HUSH,
    blobs: [[174, 98, 33], [194, 86, 25], [156, 82, 20], [186, 112, 18]], mix: { LEAF_SPRUCE: 1.0 },
    coreClosure: 0.55, edgeFall: 5, bareGlade: true, darkFloor: true, rise: true, riseTarget: 48 },
  { key: 'bonebirches', name: 'The Bone Birches', region: REGION.HUSH,
    blobs: [[218, 106, 19], [206, 94, 17]], mix: { LEAF_FROST: 1.0 },
    coreClosure: 0.30, edgeFall: 3, birch: true, rise: true, riseTarget: 58 },
];

/* ---- region skeletons: argmin-of-distance seeds, biased then repaired ----
   Placed to yield the brief's topology: Hush north + the Kettles finger,
   Morningside east + the strip flanking the finger, Noonlands south,
   Evenlands west; triple points near the Wick (136,204) and Snuffer
   (136,156); Noonlands never adjacent to the Hush. */
const SKELETONS = {
  [REGION.HUSH]: [
    [142, 117], [150, 88], [130, 100], [162, 108], [186, 100], [210, 96],
    [232, 92], [244, 76], [238, 56], [150, 128], [166, 136], [167, 152],
    [168, 168], [168, 184], [136, 128],
  ],
  [REGION.MORNING]: [
    [262, 122], [284, 136], [300, 166], [304, 200], [288, 232], [262, 146],
    [252, 168], [240, 200], [248, 236], [242, 256], [186, 168], [188, 190],
    [176, 204], [152, 162], [150, 180], [200, 150], [222, 140], [164, 204],
    [160, 152],
  ],
  [REGION.NOON]: [
    [180, 262], [150, 246], [206, 282], [166, 296], [128, 262], [116, 288],
    [200, 308], [136, 232], [186, 236],
  ],
  [REGION.EVEN]: [
    [100, 150], [84, 196], [72, 226], [92, 258], [108, 122], [98, 178],
    [116, 208], [108, 204], [108, 156], [140, 124],
  ],
};
// target land-area shares (§3): Noon 35 / Morning 27 / Even 22 / Hush 16
const REGION_TARGET = { [REGION.MORNING]: 0.27, [REGION.NOON]: 0.35, [REGION.EVEN]: 0.22, [REGION.HUSH]: 0.16 };

// per-region identity materials (§4) — the testable definition of a season.
// Everything not listed here is a neutral and belongs to every region.
const IDENTITY = {
  [REGION.MORNING]: ['GRASS_SPRING', 'FLOWERS_WHITE', 'LEAF_SPRING', 'LEAF_BLOSSOM', 'LEAF_WILLOW'],
  [REGION.NOON]: ['GRASS', 'LEAF_BROAD', 'LEAF_PINE', 'FLOWERS_GOLD'],
  [REGION.EVEN]: ['GRASS_DUN', 'LEAF_EMBER', 'LEAF_GOLD', 'LEAF_SCARLET', 'BUSH_BRAMBLE'],
  [REGION.HUSH]: ['SNOW', 'ICE', 'LEAF_SPRUCE', 'LEAF_FROST', 'ICE_BLUE'],
};
// A5 hue signatures / A10 sightline signatures
const SIGNATURE_HUE = { [REGION.MORNING]: 'LEAF_BLOSSOM', [REGION.NOON]: 'LEAF_BROAD', [REGION.EVEN]: 'LEAF_EMBER', [REGION.HUSH]: 'ICE_BLUE' };
const SIGNATURE_SIGHT = { [REGION.MORNING]: 'LEAF_BLOSSOM', [REGION.NOON]: 'LEAF_BROAD', [REGION.EVEN]: 'LEAF_EMBER', [REGION.HUSH]: 'SNOW' };

// microseason epithets, picked by plot hash — the certificate's one line of weather
const EPITHETS = {
  [REGION.MORNING]: ['East wind melts the ice', 'First light on wet furrows', 'Petals ride the current',
    'The orchard holds its breath', 'Frost gone by the second bell'],
  [REGION.NOON]: ['Hay down before the heat', 'The bay glitters all afternoon', 'Shade is wealth here',
    'Cicadas own the third watch', 'The sea keeps the evening warm'],
  [REGION.EVEN]: ['Smoke stands straight at dusk', 'The presses run till lamplight', 'Red leaves hold the last sun',
    'Mist pools in the garths by morning', 'The year leans west'],
  [REGION.HUSH]: ['Unminable until the walker wakes', 'Snow keeps every footprint', 'The ice speaks at midnight',
    'The kettles never cool', 'Stars burn harder here'],
};

// A3's closed exemption list: identity materials allowed outside their region
// (plus the Procession polyline ⊕2, exported by genesis). Hard cap 500 cubes.
const EXEMPTIONS = [
  { key: 'snowpocket', x: 248, z: 60, r: 6, mats: ['SNOW'] },          // snow in spring
  { key: 'seep', x: 156, z: 98, r: 5, mats: ['GRASS_SPRING'] },        // spring in winter
  { key: 'force', x: 240, z: 104, r: 7, mats: ['ICE', 'ICE_BLUE'] },   // the Force straddles the Thawline
];

SG.REGION = REGION;
SG.REGION_NAME = REGION_NAME;
SG.REGION_SEASON = REGION_SEASON;
SG.GAZETTEER = GAZETTEER;
SG.WOODS = WOODS;
SG.SKELETONS = SKELETONS;
SG.REGION_TARGET = REGION_TARGET;
SG.IDENTITY = IDENTITY;
SG.SIGNATURE_HUE = SIGNATURE_HUE;
SG.SIGNATURE_SIGHT = SIGNATURE_SIGHT;
SG.EPITHETS = EPITHETS;
SG.EXEMPTIONS = EXEMPTIONS;
})();
