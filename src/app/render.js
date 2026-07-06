/* Socialgen app — THREE.js layer.
   Everything visual lives here; nothing in src/core touches THREE.
   Scene space = grid space shifted by (-sx/2, 0, -sz/2) so the island is
   centred on the origin. */
(() => {
const SG = (globalThis.SG ||= {});
const R = (SG.render = {});

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const SHADOWS = !IS_TOUCH;
R.IS_TOUCH = IS_TOUCH;

const SKY = {
  day: new THREE.Color(0x9cc2d4), dusk: new THREE.Color(0xd99a6b),
  sunDay: new THREE.Color(0xfff3dd), sunDusk: new THREE.Color(0xff9a5a),
};

let scene, camera, renderer, sun, hemi, worldGroup;
let fluidMats = [], sprites = [];

R.init = function () {
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  if (SHADOWS) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  document.body.appendChild(renderer.domElement);
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 2400);
  hemi = new THREE.HemisphereLight(0xbfd6e4, 0x40503e, 0.8);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff3dd, 1.05);
  if (SHADOWS) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -170; sc.right = 170; sc.top = 170; sc.bottom = -170;
    sc.near = 30; sc.far = 900;
    sun.shadow.bias = -0.001;
  }
  scene.add(sun); scene.add(sun.target);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  R.scene = scene; R.camera = camera; R.renderer = renderer;
};

/* ---- world meshes: one entry per 32×32 chunk, rebuildable in place ---- */
const CHUNK = 32;
R.CHUNK = CHUNK;
const chunkMeshes = new Map();
let opaqueMat = null, fluidMat = null;

function geomFrom(arrays) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(arrays.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3));
  g.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
  return g;
}

R.rebuildChunk = function (world, cx, cz) {
  const key = cx + ',' + cz;
  const prev = chunkMeshes.get(key);
  if (prev) for (const m of [prev.opaque, prev.fluid]) if (m) {
    worldGroup.remove(m); m.geometry.dispose();
  }
  const m = SG.meshRegion(world, cx, cz, CHUNK, CHUNK);
  const entry = { opaque: null, fluid: null };
  if (m.opaque.indices.length) {
    const mesh = new THREE.Mesh(geomFrom(m.opaque), opaqueMat);
    mesh.castShadow = mesh.receiveShadow = SHADOWS;
    worldGroup.add(mesh);
    entry.opaque = mesh;
  }
  if (m.fluid.indices.length) {
    const mesh = new THREE.Mesh(geomFrom(m.fluid), fluidMat);
    mesh.renderOrder = 2;
    worldGroup.add(mesh);
    entry.fluid = mesh;
  }
  chunkMeshes.set(key, entry);
};

// after editing cube (x,·,z): remesh its chunk, and any neighbour chunk whose
// culling/AO could see the change (AO reaches one cube across the border)
R.rebuildAround = function (world, x, z) {
  const dirty = new Set();
  for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nx >= world.sx || nz < 0 || nz >= world.sz) continue;
    dirty.add(Math.floor(nx / CHUNK) * CHUNK + ',' + Math.floor(nz / CHUNK) * CHUNK);
  }
  for (const k of dirty) {
    const [cx, cz] = k.split(',').map(Number);
    R.rebuildChunk(world, cx, cz);
  }
};

R.buildWorld = function (world) {
  worldGroup = new THREE.Group();
  worldGroup.position.set(-world.sx / 2, 0, -world.sz / 2);
  scene.add(worldGroup);
  R.worldGroup = worldGroup;
  opaqueMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  fluidMat = new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.8,
    depthWrite: false, side: THREE.DoubleSide,
  });
  fluidMats.push(fluidMat);
  for (let cz = 0; cz < world.sz; cz += CHUNK) for (let cx = 0; cx < world.sx; cx += CHUNK)
    R.rebuildChunk(world, cx, cz);

  // the sea continues past the diorama edge, slightly below the meshed
  // water tops to avoid z-fighting at the seam
  // depthWrite ON: the ocean is the floor of the transparency stack, so the
  // diorama's cut-wall water always composites over it in a stable order
  const oceanMat = new THREE.MeshLambertMaterial({
    color: 0x3d7ea6, transparent: true, opacity: 0.88, depthWrite: true,
  });
  const ocean = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = SG.SEA - 0.08;
  ocean.renderOrder = 1;
  scene.add(ocean);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(1500, 48),
    new THREE.MeshBasicMaterial({ color: 0x24404f }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 6;
  scene.add(bed);
};

/* ---- named-place labels ---- */
function makeLabel(text) {
  const cv = document.createElement('canvas');
  const font = '500 44px "IBM Plex Mono", ui-monospace, monospace';
  const ctx = cv.getContext('2d');
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  const tw = ctx.measureText(text.toUpperCase()).width;
  cv.width = Math.ceil(tw + 150); cv.height = 128;   // resize resets ctx state
  const c2 = cv.getContext('2d');
  c2.font = font;
  if ('letterSpacing' in c2) c2.letterSpacing = '6px';
  c2.textBaseline = 'middle';
  c2.fillStyle = 'rgba(217,164,65,0.96)';
  c2.save();
  c2.translate(34, 64); c2.rotate(Math.PI / 4);
  c2.fillRect(-11, -11, 22, 22); // the brass diamond
  c2.restore();
  c2.shadowColor = 'rgba(5,10,14,0.9)'; c2.shadowBlur = 12;
  c2.fillStyle = '#ece5d3';
  c2.fillText(text.toUpperCase(), 74, 66);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  return { tex, aspect: cv.width / cv.height };
}

R.addLandmarks = function (landmarks, world) {
  landmarks.forEach((lm, i) => {
    const { tex, aspect } = makeLabel(lm.name);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false,
    }));
    sp.userData.aspect = aspect;
    // stagger heights so neighbouring labels don't collide at low zoom
    sp.position.set(lm.x - world.sx / 2, lm.y + 4 + (i % 2) * 5, lm.z - world.sz / 2);
    sp.renderOrder = 5;
    sprites.push(sp);
    scene.add(sp);
  });
};

/* ---- plot overlays: hover / selection drapes + claim beacons ---- */
function makeDrape(opacity) {
  const g = new THREE.PlaneGeometry(1, 1, 8, 8);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: 0xd9a441, transparent: true, opacity,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  m.renderOrder = 3;
  m.visible = false;
  scene.add(m);
  return m;
}
R.makeDrapes = function () {
  R.hoverMesh = makeDrape(0.22);
  R.selectMesh = makeDrape(0.4);
};

/* ---- build-mode ghost cube ---- */
R.makeGhost = function () {
  const box = new THREE.BoxGeometry(1.04, 1.04, 1.04);
  const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({
    color: 0xd9a441, transparent: true, opacity: 0.3, depthWrite: false,
  }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box),
    new THREE.LineBasicMaterial({ color: 0xd9a441 }));
  const g = new THREE.Group();
  g.add(fill); g.add(edges);
  g.visible = false;
  fill.renderOrder = 4;
  scene.add(g);
  R.ghost = g;
  R.ghostTo = (world, x, y, z, erase) => {
    g.position.set(x + 0.5 - world.sx / 2, y + 0.5, z + 0.5 - world.sz / 2);
    const c = erase ? 0xc4685a : 0xd9a441;
    fill.material.color.setHex(c); edges.material.color.setHex(c);
    g.visible = true;
  };
};
R.drapeTo = function (mesh, world, plot, color) {
  const P = SG.PLOT, pos = mesh.geometry.attributes.position;
  const ox = -world.sx / 2, oz = -world.sz / 2;
  for (let i = 0; i < pos.count; i++) {
    const gx = plot.x0 + (i % 9) * (P / 8);
    const gz = plot.z0 + Math.floor(i / 9) * (P / 8);
    const sx = Math.min(Math.floor(gx), world.sx - 1), sz = Math.min(Math.floor(gz), world.sz - 1);
    const y = Math.max(world.surfaceAt(sx, sz) + 1, SG.SEA) + 0.35;
    pos.setXYZ(i, gx + ox, y, gz + oz);
  }
  pos.needsUpdate = true;
  mesh.material.color.setHex(color);
  mesh.visible = true;
};

R.addBeacon = function (world, plot) {
  const P = SG.PLOT, ox = -world.sx / 2, oz = -world.sz / 2;
  const cx = plot.x0 + P / 2, cz = plot.z0 + P / 2;
  const y = world.surfaceAt(Math.floor(cx), Math.floor(cz)) + 1;
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x2b2b28 }));
  pole.position.set(cx + ox, y + 1.6, cz + oz);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.07),
    new THREE.MeshLambertMaterial({ color: 0xd9a441 }));
  flag.position.set(cx + ox + 0.72, y + 2.75, cz + oz);
  pole.castShadow = flag.castShadow = SHADOWS;
  grp.add(pole); grp.add(flag);
  const pts = [];
  const ring = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  for (let s = 0; s < 4; s++) {
    const [a, b] = ring[s], [c, d] = ring[s + 1];
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const gx = plot.x0 + 0.3 + (a + (c - a) * t) * (P - 0.6);
      const gz = plot.z0 + 0.3 + (b + (d - b) * t) * (P - 0.6);
      const yy = Math.max(world.surfaceAt(Math.floor(gx), Math.floor(gz)) + 1, SG.SEA) + 0.3;
      pts.push(gx + ox, yy, gz + oz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  grp.add(new THREE.LineLoop(g, new THREE.LineBasicMaterial({
    color: 0xd9a441, transparent: true, opacity: 0.85,
  })));
  scene.add(grp);
  return grp;
};

/* ---- sun & sky ---- */
R.updateSun = function (t) {
  const a = Math.PI * (0.10 + 0.80 * t);
  sun.position.set(Math.cos(a) * 340, Math.sin(a) * 300 + 16, 105);
  const low = Math.pow(1 - Math.sin(a), 1.4);
  sun.color.copy(SKY.sunDay).lerp(SKY.sunDusk, low);
  sun.intensity = 0.58 + 0.36 * Math.sin(a);
  hemi.intensity = 0.32 + 0.26 * Math.sin(a);
  const sky = SKY.day.clone().lerp(SKY.dusk, low * 0.9);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky.getHex(), 340, 1100);
};

/* ---- per-frame effects ---- */
R.tick = function (elapsed, camDist) {
  const breathe = 0.78 + 0.035 * Math.sin(elapsed * 0.8);
  for (const m of fluidMats) m.opacity = breathe;
  const fade = THREE.MathUtils.clamp(1.45 - camDist / 520, 0.2, 0.95);
  for (const sp of sprites) {
    sp.material.opacity = fade;
    // constant screen size: shrink up close, grow (capped) when far
    const d = camera.position.distanceTo(sp.position);
    const s = THREE.MathUtils.clamp(d * 0.021, 2.2, 8.5);
    sp.scale.set(s * sp.userData.aspect, s, 1);
  }
};
})();
