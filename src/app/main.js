/* Socialgen app — boot, camera, picking, HUD, deeds.
   The district is fixed: there is no reroll button, by design.
   One place, one survey, everyone a neighbour. */
(() => {
const SG = globalThis.SG;
const R = SG.render;
const $ = id => document.getElementById(id);

let world, landmarks, survey, plots;
let wallet = 2500, claims = new Set(), selectedIdx = -1;
const beacons = new Map();
const SAVE_KEY = 'socialgen-district01-v1';
const EDITS_KEY = 'socialgen-district01-edits-v1';

/* ---------- creator mode: sculpt the district cube by cube ---------- */
let buildMode = false, selectedMat = -1; // set to GRASS once palette loads
const ERASER = -1;
const edits = new Map();   // "x,y,z" -> id placed (diff vs genesis, replayed on load)
const undoStack = [];

function applyEdit(x, y, z, id, opts = {}) {
  if (!world || !world.inBounds(x, y, z)) return false;
  if (y === 0) return false; // bedrock is forever
  const prev = world.get(x, y, z);
  if (prev === id) return false;
  world.set(x, y, z, id);
  edits.set(x + ',' + y + ',' + z, id);
  if (!opts.silent) {
    undoStack.push({ x, y, z, prev });
    if (undoStack.length > 500) undoStack.shift();
  }
  SG.render.rebuildAround(world, x, z);
  scheduleResurvey();
  schedulePersistEdits();
  return true;
}
function undoEdit() {
  const e = undoStack.pop();
  if (!e) { toast('Nothing to undo'); return; }
  applyEdit(e.x, e.y, e.z, e.prev, { silent: true });
}

// the district is re-surveyed after every edit: dig a canal to your plot and
// its deed reprices as waterfront — the land market reads the cubes, always
let resurveyT = null;
function scheduleResurvey() {
  clearTimeout(resurveyT);
  resurveyT = setTimeout(() => {
    survey = SG.surveyDistrict(world, landmarks);
    plots = survey.plots;
    if (SG.app) { SG.app.survey = survey; SG.app.plots = plots; }
    updateHUD();
    if (selectedIdx >= 0 && !buildMode) showCard(selectedIdx);
  }, 450);
}
let editsT = null;
function schedulePersistEdits() {
  clearTimeout(editsT);
  editsT = setTimeout(() => {
    try {
      localStorage.setItem(EDITS_KEY, JSON.stringify(
        [...edits].map(([k, id]) => [...k.split(',').map(Number), id])));
    } catch {}
  }, 700);
}
function loadEdits() {
  try { return JSON.parse(localStorage.getItem(EDITS_KEY)) || []; } catch { return []; }
}

/* ---------- camera rig (orbit / pan / zoom, touch-friendly) ---------- */
const target = new THREE.Vector3(0, 26, 0);
let theta = -0.7, phi = 1.02, radius = 300, interacted = false;
function updateCamera() {
  R.camera.position.set(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * Math.sin(phi) * Math.cos(theta));
  R.camera.lookAt(target);
}
const pointers = new Map();
let downPos = null, downTime = 0, pinchDist = 0;
function pan(dx, dy) {
  const f = new THREE.Vector3().subVectors(target, R.camera.position);
  f.y = 0; f.normalize();
  const r = new THREE.Vector3(f.z, 0, -f.x);
  const k = radius * 0.0016;
  target.addScaledVector(r, dx * k).addScaledVector(f, dy * k);
  const d = Math.hypot(target.x, target.z);
  if (d > 150) { target.x *= 150 / d; target.z *= 150 / d; }
}
function onDown(e) {
  interacted = true;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
  if (pointers.size === 1) { downPos = { x: e.clientX, y: e.clientY }; downTime = Date.now(); }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
  R.renderer.domElement.setPointerCapture(e.pointerId);
}
const lastNDC = new THREE.Vector2(); let needRay = false;
function onMove(e) {
  lastNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  needRay = true;
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button });
  if (pointers.size === 1) {
    if (prev.button === 2) pan(-dx, dy);
    else { theta -= dx * 0.0052; phi = THREE.MathUtils.clamp(phi - dy * 0.0042, 0.22, 1.45); }
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const nd = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) radius = THREE.MathUtils.clamp(radius * pinchDist / nd, 36, 540);
    pinchDist = nd;
    pan(-dx * 0.7, dy * 0.7);
  }
}
function onUp(e) {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (wasSingle && downPos) {
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (moved < 7 && Date.now() - downTime < 600) {
      if (buildMode && (e.button === 0 || e.button === 2)) buildClick(e.clientX, e.clientY, e.button);
      else if (e.button === 0) pickPlot(e.clientX, e.clientY);
    }
  }
  if (pointers.size < 2) pinchDist = 0;
}

/* ---------- picking: exact voxel DDA, no proxy meshes ---------- */
const raycaster = new THREE.Raycaster();
function ddaFromScreen(px, py, skipFluid = false) {
  raycaster.setFromCamera(new THREE.Vector2((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1), R.camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  return SG.raycast(world, o.x + world.sx / 2, o.y, o.z + world.sz / 2,
    d.x, d.y, d.z, 1200, skipFluid);
}
function plotFromScreen(px, py) {
  const hit = ddaFromScreen(px, py);
  if (!hit) return -1;
  const cx = Math.floor(hit.x / SG.PLOT), cz = Math.floor(hit.z / SG.PLOT);
  if (cx < 0 || cx >= survey.grid || cz < 0 || cz >= survey.grid) return -1;
  return cz * survey.grid + cx;
}
// where would the current tool act, given a screen point?
function buildTarget(px, py) {
  const erase = selectedMat === ERASER;
  const skipFluid = !erase && !SG.PALETTE[selectedMat].fluid;
  const hit = ddaFromScreen(px, py, skipFluid);
  if (!hit) return null;
  if (erase) return { x: hit.x, y: hit.y, z: hit.z, erase: true, id: hit.id };
  return { x: hit.prev.x, y: hit.prev.y, z: hit.prev.z, erase: false };
}
function updateHover() {
  if (!needRay || R.IS_TOUCH || !world) return;
  needRay = false;
  const px = (lastNDC.x + 1) / 2 * innerWidth, py = (1 - lastNDC.y) / 2 * innerHeight;
  if (buildMode) {
    R.hoverMesh.visible = false;
    const t = buildTarget(px, py);
    if (t && world.inBounds(t.x, t.y, t.z) && t.y > 0) R.ghostTo(world, t.x, t.y, t.z, t.erase);
    else R.ghost.visible = false;
    return;
  }
  R.ghost.visible = false;
  if (radius > 320) { R.hoverMesh.visible = false; return; }
  const idx = plotFromScreen(px, py);
  if (idx < 0 || idx === selectedIdx) { R.hoverMesh.visible = false; return; }
  const p = plots[idx];
  R.drapeTo(R.hoverMesh, world, p,
    claims.has(idx) ? 0x8fae63 : p.buildable ? 0xd9a441 : 0xc4685a);
}
function buildClick(px, py, button) {
  if (button === 2) { // right-click always erases, whatever tile is selected
    const hit = ddaFromScreen(px, py);
    if (!hit) return;
    if (hit.id === SG.MAT.BEDROCK) { toast('Bedrock is forever'); return; }
    applyEdit(hit.x, hit.y, hit.z, SG.MAT.AIR);
    return;
  }
  const t = buildTarget(px, py);
  if (!t) return;
  if (t.erase) {
    if (t.id === SG.MAT.BEDROCK) { toast('Bedrock is forever'); return; }
    applyEdit(t.x, t.y, t.z, SG.MAT.AIR);
  } else {
    applyEdit(t.x, t.y, t.z, selectedMat);
  }
}
function pickPlot(px, py) {
  const idx = plotFromScreen(px, py);
  if (idx < 0) {
    selectedIdx = -1; R.selectMesh.visible = false;
    $('card').classList.add('hidden');
    return;
  }
  selectedIdx = idx;
  const p = plots[idx];
  R.drapeTo(R.selectMesh, world, p,
    claims.has(idx) ? 0x8fae63 : p.buildable ? 0xd9a441 : 0xc4685a);
  showCard(idx);
}

/* ---------- the deed card ---------- */
const pad2 = n => String(n).padStart(2, '0');
const plotName = p => pad2(p.cx) + '·' + pad2(p.cz);
function showCard(idx) {
  const p = plots[idx];
  $('plotName').textContent = plotName(p);
  $('placeTxt').textContent = p.named.length ? 'near ' + p.named.join(' · ') : '';
  const badge = $('tierBadge'), chips = $('chips'), price = $('priceTxt'),
        action = $('cardAction'), scoreTxt = $('scoreTxt');
  chips.innerHTML = '';
  const add = (txt, cls) => {
    const s = document.createElement('span');
    s.className = 'chip' + (cls ? ' ' + cls : '');
    s.textContent = txt;
    chips.appendChild(s);
  };
  add(p.groundKind, 'b');
  if (p.commons) {
    badge.textContent = 'COMMONS'; badge.className = 'lm'; scoreTxt.textContent = '';
    add('Held in district trust');
    price.innerHTML = 'Not for sale — ever';
    action.innerHTML = '';
  } else if (!p.buildable) {
    badge.textContent = 'UNBUILDABLE'; badge.className = 'na'; scoreTxt.textContent = '';
    add(p.dryMean !== undefined && p.mean <= SG.SEA + 0.5 ? 'Submerged / tidal ground' : 'Slope exceeds survey limit');
    price.innerHTML = '—'; action.innerHTML = '';
  } else {
    badge.textContent = p.tier;
    badge.className = p.tier === 'LANDMARK' ? 'lm' : '';
    scoreTxt.textContent = 'survey ' + p.score + ' / 100';
    if (p.waterfront) add('Waterfront');
    if (p.riverside) add('Riverside');
    if (p.lakefront) add('Lakefront');
    if (p.fallsView) add('Falls view');
    if (p.caveMouth) add('Cave mouth');
    if (p.archView) add('Arch view');
    if (p.springs) add('Hot springs');
    if (p.clifftop) add('Clifftop');
    if (p.summit) add('Summit shoulder');
    if (p.harborside) add('Harborside');
    if (p.elevPct > 0.85) add('Hilltop');
    if (p.trees >= 4) add('Forested');
    if (p.slope <= 1) add('Level ground');
    for (const [kind, n] of Object.entries(p.minerals))
      add(kind.charAt(0).toUpperCase() + kind.slice(1) + ' ×' + n, 'b');
    if (claims.has(idx)) {
      price.innerHTML = 'Deed held';
      action.innerHTML = '<span id="ownedTag">SETTLED</span>';
    } else {
      price.innerHTML = p.price.toLocaleString() + ' ◆<small>~$' + (p.price / 1000 * 9.99).toFixed(2) + '</small>';
      action.innerHTML = '<button id="claimBtn">Claim parcel</button>';
      $('claimBtn').onclick = () => claim(idx);
    }
  }
  $('card').classList.remove('hidden');
}
function claim(idx) {
  const p = plots[idx];
  if (wallet < p.price) { toast('Not enough gems — top up with the + control'); return; }
  wallet -= p.price;
  claims.add(idx);
  beacons.set(idx, R.addBeacon(world, p));
  R.drapeTo(R.selectMesh, world, p, 0x8fae63);
  showCard(idx); updateHUD(); persist();
  toast('Parcel ' + plotName(p) + ' settled — ' + p.tier.toLowerCase() + ' deed issued');
}
function updateHUD() {
  $('walletVal').textContent = wallet.toLocaleString() + ' ◆';
  $('occTxt').textContent = claims.size.toLocaleString() + ' / ' + survey.buildableCount.toLocaleString();
}
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- the tileset & build toggle ---------- */
const BUILD_MATS = ['GRASS', 'SOIL', 'SAND', 'GRAVEL', 'CLAY', 'STONE', 'BASALT',
  'MOSS', 'SNOW', 'WOOD', 'LEAF_PINE', 'LEAF_BROAD', 'COPPER_ORE', 'IRON_ORE',
  'GOLD_ORE', 'CRYSTAL', 'WATER', 'SPRING'];
const css = hex => '#' + hex.toString(16).padStart(6, '0');

function buildTileset() {
  const wrap = $('tiles');
  const pick = (id, el) => {
    selectedMat = id;
    wrap.querySelectorAll('.tile').forEach(t => t.classList.remove('sel'));
    el.classList.add('sel');
    $('tileName').textContent = id === ERASER ? 'Eraser' : SG.PALETTE[id].name;
  };
  const eraser = document.createElement('button');
  eraser.className = 'tile eraser';
  eraser.title = 'Eraser (or right-click any cube)';
  eraser.textContent = '⌫';
  eraser.onclick = () => pick(ERASER, eraser);
  wrap.appendChild(eraser);
  for (const key of BUILD_MATS) {
    const e = SG.PALETTE[SG.MAT[key]];
    const b = document.createElement('button');
    b.className = 'tile';
    b.title = e.name;
    b.style.background = `linear-gradient(160deg, ${css(e.colorTop)} 0 42%, ${css(e.color)} 42% 100%)`;
    if (e.fluid) b.style.opacity = 0.82;
    b.onclick = () => pick(e.id, b);
    wrap.appendChild(b);
    if (key === 'GRASS') pick(e.id, b); // sensible default tool
  }
}

const HINT_SURVEY = 'drag&nbsp;·&nbsp;orbit&emsp;scroll&nbsp;·&nbsp;zoom&emsp;right-drag / two-finger&nbsp;·&nbsp;pan<br>tap a parcel to survey it&nbsp;·&nbsp;the named places are held in trust';
const HINT_BUILD = 'click&nbsp;·&nbsp;place cube&emsp;right-click&nbsp;·&nbsp;erase&emsp;ctrl+Z&nbsp;·&nbsp;undo<br>B&nbsp;·&nbsp;exit creator mode&emsp;edits re-survey the district live';

function setBuildMode(on) {
  buildMode = on;
  $('buildBtn').classList.toggle('active', on);
  $('tileset').classList.toggle('hidden', !on);
  $('hints').innerHTML = on ? HINT_BUILD : HINT_SURVEY;
  if (on) {
    $('card').classList.add('hidden');
    R.hoverMesh.visible = false;
    R.selectMesh.visible = false;
    toast('Creator mode — the district is yours to sculpt');
  } else {
    R.ghost.visible = false;
    if (selectedIdx >= 0) { // resurface the deed, repriced if the land changed
      R.drapeTo(R.selectMesh, world, plots[selectedIdx],
        claims.has(selectedIdx) ? 0x8fae63 : plots[selectedIdx].buildable ? 0xd9a441 : 0xc4685a);
      showCard(selectedIdx);
    }
  }
}

/* ---------- persistence ---------- */
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ wallet, claims: [...claims] })); } catch {}
}

/* ---------- boot ---------- */
function boot() {
  R.init();
  updateCamera();
  setTimeout(() => {
    const t0 = performance.now();
    const genesis = SG.buildDistrict01();
    world = genesis.world; landmarks = genesis.landmarks;
    // replay the creator's saved edits on top of genesis before anything reads the world
    for (const [x, y, z, id] of loadEdits())
      if (world.inBounds(x, y, z) && y > 0) {
        world.set(x, y, z, id);
        edits.set(x + ',' + y + ',' + z, id);
      }
    survey = SG.surveyDistrict(world, landmarks);
    plots = survey.plots;
    R.buildWorld(world);
    R.addLandmarks(landmarks, world);
    R.makeDrapes();
    R.makeGhost();
    buildTileset();
    const save = loadSave();
    if (save) {
      wallet = typeof save.wallet === 'number' ? save.wallet : 2500;
      claims = new Set(save.claims || []);
      claims.forEach(idx => { if (plots[idx]) beacons.set(idx, R.addBeacon(world, plots[idx])); });
    }
    updateHUD();
    R.updateSun($('sunSlider').value / 100);
    SG.app = { world, landmarks, survey, plots, claims, applyEdit, setBuildMode }; // for tooling & tests
    console.log('district raised in', Math.round(performance.now() - t0), 'ms');
    requestAnimationFrame(() => requestAnimationFrame(() => $('loader').classList.add('off')));
  }, 80);

  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    if (!interacted) theta += 0.0006;
    if (world) { updateHover(); R.tick(clock.getElapsedTime(), radius); }
    updateCamera();
    R.renderer.render(R.scene, R.camera);
  })();

  /* UI wiring */
  $('sunSlider').addEventListener('input', e => R.updateSun(e.target.value / 100));
  $('topUp').addEventListener('click', () => {
    wallet += 1000; updateHUD(); persist();
    toast('Simulated purchase — $9.99 pack → 1,000 ◆');
  });
  $('buildBtn').addEventListener('click', () => setBuildMode(!buildMode));
  $('undoBtn').addEventListener('click', undoEdit);
  $('revertBtn').addEventListener('click', () => {
    if (!edits.size) { toast('No edits to revert'); return; }
    if (!confirm('Revert every edit and restore the authored district?')) return;
    try { localStorage.removeItem(EDITS_KEY); } catch {}
    location.reload();
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'b' || e.key === 'B') setBuildMode(!buildMode);
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoEdit(); }
  });
  addEventListener('contextmenu', e => e.preventDefault());
  document.body.addEventListener('pointerdown', e => {
    if (e.target === R.renderer.domElement) onDown(e);
  });
  document.body.addEventListener('pointermove', onMove);
  document.body.addEventListener('pointerup', onUp);
  document.body.addEventListener('pointercancel', onUp);
  addEventListener('wheel', e => {
    interacted = true;
    radius = THREE.MathUtils.clamp(radius * (1 + e.deltaY * 0.0011), 36, 540);
  }, { passive: true });
}

boot();
})();
