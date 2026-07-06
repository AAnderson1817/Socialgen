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
const SAVE_KEY = 'socialgen-district01-v2';
const EDITS_KEY = 'socialgen-district01-edits-v2';

/* ---------- creator mode: sculpt the district cube by cube ---------- */
let buildMode = false, selectedMat = -1; // set to GRASS once palette loads
let brushSize = 1;                       // 1 = single cube, 2/3 = blob brushes
let tool = 'brush';                      // 'brush' | 'box'
let boxCorner = null;                    // first corner of a pending box fill
const ERASER = -1;
const edits = new Map();   // "x,y,z" -> id placed (diff vs genesis, replayed on load)
const undoStack = [];      // batches: one entry per click / stroke / box fill
let currentBatch = null;

function beginBatch() { currentBatch = []; }
function endBatch() {
  if (currentBatch && currentBatch.length) {
    undoStack.push(currentBatch);
    if (undoStack.length > 200) undoStack.shift();
  }
  currentBatch = null;
}
function applyEdit(x, y, z, id, opts = {}) {
  if (!world || !world.inBounds(x, y, z)) return false;
  if (y === 0) return false; // bedrock is forever
  const prev = world.get(x, y, z);
  if (prev === id || prev === SG.MAT.BEDROCK) return false;
  world.set(x, y, z, id);
  edits.set(x + ',' + y + ',' + z, id);
  if (!opts.silent) {
    if (currentBatch) currentBatch.push({ x, y, z, prev });
    else undoStack.push([{ x, y, z, prev }]);
  }
  SG.render.markDirty(world, x, z); // remeshed once per frame by flushDirty
  scheduleResurvey();
  schedulePersistEdits();
  return true;
}
// blob brush centred on a cell: size 1 acts on the single cell, 2/3 carve or
// mound a rough sphere, overwriting anything but bedrock — sculpting, not lego
function applyBrush(cx, cy, cz, id) {
  if (brushSize === 1) { applyEdit(cx, cy, cz, id); return; }
  const r = brushSize === 2 ? 1.4 : 2.3;
  const R2 = Math.ceil(r);
  for (let dz = -R2; dz <= R2; dz++) for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++)
    if (Math.hypot(dx, dy, dz) <= r) applyEdit(cx + dx, cy + dy, cz + dz, id);
}
function undoEdit() {
  const batch = undoStack.pop();
  if (!batch) { toast('Nothing to undo'); return; }
  for (let i = batch.length - 1; i >= 0; i--)
    applyEdit(batch[i].x, batch[i].y, batch[i].z, batch[i].prev, { silent: true });
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
const target = new THREE.Vector3(0, 32, 0);
let theta = -0.7, phi = 1.02, radius = 430, interacted = false;
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
  if (d > 225) { target.x *= 225 / d; target.z *= 225 / d; }
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
    else if (buildMode && prev.button === 0 && tool === 'brush' && !e.altKey && !R.IS_TOUCH)
      paintAt(e.clientX, e.clientY); // drag-to-paint; hold alt to orbit instead
    else { theta -= dx * 0.0052; phi = THREE.MathUtils.clamp(phi - dy * 0.0042, 0.22, 1.45); }
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const nd = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) radius = THREE.MathUtils.clamp(radius * pinchDist / nd, 54, 810);
    pinchDist = nd;
    pan(-dx * 0.7, dy * 0.7);
  }
}
function onUp(e) {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  endBatch(); // closes a paint stroke; harmless otherwise
  lastPaintKey = null;
  if (wasSingle && downPos) {
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (moved < 7 && Date.now() - downTime < 600) {
      if (buildMode && e.altKey && e.button === 0) eyedrop(e.clientX, e.clientY);
      else if (buildMode && (e.button === 0 || e.button === 2)) buildClick(e.clientX, e.clientY, e.button);
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
    d.x, d.y, d.z, 1800, skipFluid);
}
function plotFromScreen(px, py) {
  const hit = ddaFromScreen(px, py);
  if (!hit) return -1;
  const cx = Math.floor(hit.x / SG.PLOT), cz = Math.floor(hit.z / SG.PLOT);
  if (cx < 0 || cx >= survey.grid || cz < 0 || cz >= survey.grid) return -1;
  return cz * survey.grid + cx;
}
// where would the current tool act, given a screen point?
// size-1 place targets the empty cell in front of the hit face (lego-precise);
// bigger brushes centre on the hit cube itself (sculpting into the surface)
function buildTarget(px, py) {
  const erase = selectedMat === ERASER;
  const skipFluid = !erase && !SG.PALETTE[selectedMat].fluid;
  const hit = ddaFromScreen(px, py, skipFluid);
  if (!hit) return null;
  if (erase || brushSize > 1) return { x: hit.x, y: hit.y, z: hit.z, erase, id: hit.id };
  return { x: hit.prev.x, y: hit.prev.y, z: hit.prev.z, erase: false };
}
function updateHover() {
  if (!needRay || R.IS_TOUCH || !world) return;
  needRay = false;
  const px = (lastNDC.x + 1) / 2 * innerWidth, py = (1 - lastNDC.y) / 2 * innerHeight;
  if (buildMode) {
    R.hoverMesh.visible = false;
    const t = buildTarget(px, py);
    if (!t || !world.inBounds(t.x, t.y, t.z) || t.y <= 0) { R.ghost.visible = false; return; }
    if (tool === 'box' && boxCorner) R.ghostBoxTo(world, boxCorner, t, selectedMat === ERASER);
    else R.ghostTo(world, t.x, t.y, t.z, t.erase, tool === 'box' ? 1 : brushSize);
    return;
  }
  R.ghost.visible = false;
  if (radius > 480) { R.hoverMesh.visible = false; return; }
  const idx = plotFromScreen(px, py);
  if (idx < 0 || idx === selectedIdx) { R.hoverMesh.visible = false; return; }
  const p = plots[idx];
  R.drapeTo(R.hoverMesh, world, p,
    claims.has(idx) ? 0x8fae63 : p.buildable ? 0xd9a441 : 0xc4685a);
}

let lastPaintKey = null;
function paintAt(px, py) {
  const t = buildTarget(px, py);
  if (!t || t.y <= 0) return;
  const key = t.x + ',' + t.y + ',' + t.z;
  if (key === lastPaintKey) return;
  lastPaintKey = key;
  if (!currentBatch) beginBatch();
  applyBrush(t.x, t.y, t.z, t.erase ? SG.MAT.AIR : selectedMat);
}
function eyedrop(px, py) {
  const hit = ddaFromScreen(px, py);
  if (!hit) return;
  const el = document.querySelector(`#tiles .tile[data-mat="${hit.id}"]`);
  if (el) { el.click(); toast('Sampled ' + SG.PALETTE[hit.id].name); }
}
function buildClick(px, py, button) {
  if (button === 2) { // right-click always erases one cube, whatever is selected
    const hit = ddaFromScreen(px, py);
    if (hit) applyEdit(hit.x, hit.y, hit.z, SG.MAT.AIR);
    return;
  }
  const t = buildTarget(px, py);
  if (!t || t.y <= 0) return;
  const mat = t.erase ? SG.MAT.AIR : selectedMat;
  if (tool === 'box') {
    if (!boxCorner) { boxCorner = { x: t.x, y: t.y, z: t.z }; toast('Box corner set — click the far corner'); return; }
    const a = boxCorner, b = t;
    boxCorner = null;
    const vol = (Math.abs(b.x - a.x) + 1) * (Math.abs(b.y - a.y) + 1) * (Math.abs(b.z - a.z) + 1);
    if (vol > 20000) { toast('Box too large (' + vol.toLocaleString() + ' cubes) — capped at 20,000'); return; }
    beginBatch();
    for (let z = Math.min(a.z, b.z); z <= Math.max(a.z, b.z); z++)
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
        for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++)
          applyEdit(x, y, z, mat);
    endBatch();
    return;
  }
  beginBatch();
  applyBrush(t.x, t.y, t.z, mat);
  endBatch();
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
    b.title = e.name + ' (alt-click terrain to sample)';
    b.dataset.mat = e.id;
    b.style.background = `linear-gradient(160deg, ${css(e.colorTop)} 0 42%, ${css(e.color)} 42% 100%)`;
    if (e.fluid) b.style.opacity = 0.82;
    b.onclick = () => pick(e.id, b);
    wrap.appendChild(b);
    if (key === 'GRASS') pick(e.id, b); // sensible default tool
  }
  // brush sizes & tool switches
  const sel = (group, el) => {
    document.querySelectorAll(group).forEach(b => b.classList.remove('on'));
    el.classList.add('on');
  };
  document.querySelectorAll('.sizeBtn').forEach(b =>
    b.addEventListener('click', () => { brushSize = +b.dataset.size; sel('.sizeBtn', b); }));
  document.querySelectorAll('.toolBtn').forEach(b =>
    b.addEventListener('click', () => { tool = b.dataset.tool; boxCorner = null; sel('.toolBtn', b); }));
}

const HINT_SURVEY = 'drag&nbsp;·&nbsp;orbit&emsp;scroll&nbsp;·&nbsp;zoom&emsp;right-drag / two-finger&nbsp;·&nbsp;pan<br>tap a parcel to survey it&nbsp;·&nbsp;the named places are held in trust';
const HINT_BUILD = 'drag&nbsp;·&nbsp;paint&emsp;alt-drag&nbsp;·&nbsp;orbit&emsp;right-click&nbsp;·&nbsp;erase&emsp;alt-click&nbsp;·&nbsp;sample&emsp;ctrl+Z&nbsp;·&nbsp;undo<br>B&nbsp;·&nbsp;exit creator mode&emsp;edits re-survey the district live';

function setBuildMode(on) {
  buildMode = on;
  boxCorner = null;
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
  const loadTxt = document.querySelector('#loader .t2');
  setTimeout(async () => {
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
    await R.buildWorld(world, f =>
      loadTxt.textContent = `RAISING DISTRICT 01 — CUBE BY CUBE · ${Math.round(f * 100)}%`);
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
    if (world) { R.flushDirty(world); updateHover(); R.tick(clock.getElapsedTime(), radius); }
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
    radius = THREE.MathUtils.clamp(radius * (1 + e.deltaY * 0.0011), 54, 810);
  }, { passive: true });
}

boot();
})();
