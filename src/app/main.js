/* Socialgen app — boot, camera, picking, HUD, deeds.
   The district is fixed: there is no reroll button, by design.
   One place, one survey, everyone a neighbour. */
(() => {
const SG = globalThis.SG;
const R = SG.render;
const $ = id => document.getElementById(id);

let world, landmarks, geo, survey, plots;
let wallet = 2500, claims = new Set(), selectedIdx = -1;
const beacons = new Map();
const SAVE_KEY = 'socialgen-district01-v3';
const EDITS_KEY = 'socialgen-district01-edits-v3';

/* ---------- creator mode: sculpt the district cube by cube ----------
   The tenure law (src/core/tenure.js): you may shape only the parcels
   whose deed you hold. The steward toggle lifts the law for district
   authoring — it is the old god-mode, kept honest by a label. */
let buildMode = false, selectedMat = -1; // set to GRASS once palette loads
let brushSize = 1;                       // 1 = single cube, 2/3 = blob brushes
let tool = 'brush';                      // 'brush' | 'box'
let boxCorner = null;                    // first corner of a pending box fill
let steward = false;                     // deed checks off — authoring mode
const ERASER = -1;
const edits = new Map();   // "x,y,z" -> id placed (diff vs genesis, replayed on load)
const undoStack = [];      // batches: one entry per click / stroke / box fill
let currentBatch = null;

let denyT = 0;
function denyEdit(why) {
  if (Date.now() - denyT < 1400) return; // drag-paint must not spam the toast
  denyT = Date.now();
  toast(why === 'commons' ? 'The commons are held in trust — not yours to shape'
    : why === 'bedrock' ? 'Bedrock is forever'
    : why === 'open water' ? 'The open water has no landlord'
    : 'No deed held here — claim the parcel to shape it');
}
// where may the cursor act? (undo and boot replay pass silent and skip this)
const mayEdit = (x, y, z) => steward ? { ok: y !== 0 } : SG.canEdit(survey, claims, x, y, z);

/* ---------- walk mode: the district on foot ----------
   Physics lives in src/core/walker.js (pure, headless-tested); this layer
   only feeds it keys and mouse-look, and pins the camera to its eyes. */
let walkMode = false, walker = null, yaw = 0, pitch = 0, orbitSave = null;
const keys = new Set();
function walkInput() {
  const fwd = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const str = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const sp = keys.has('shift') ? 9 : 5.5;
  let vx = -Math.sin(yaw) * fwd + Math.cos(yaw) * str;
  let vz = -Math.cos(yaw) * fwd - Math.sin(yaw) * str;
  const m = Math.hypot(vx, vz);
  if (m > 0) { vx = vx / m * sp; vz = vz / m * sp; }
  return { vx, vz, jump: keys.has(' ') };
}
function walkSpawn() { // stand on your parcel if one is selected, else where you were looking
  if (selectedIdx >= 0 && plots[selectedIdx]) {
    const p = plots[selectedIdx];
    return [p.x0 + SG.PLOT / 2, p.z0 + SG.PLOT / 2];
  }
  const hit = ddaFromScreen(innerWidth / 2, innerHeight / 2, true);
  if (hit && hit.x > 2 && hit.x < world.sx - 2) return [hit.x + 0.5, hit.z + 0.5];
  return [212.5, 316.5]; // the harbor mole — where the Overture begins
}
function surveyAtCrosshair() {
  const dir = new THREE.Vector3();
  R.camera.getWorldDirection(dir);
  const o = R.camera.position;
  const hit = SG.raycast(world, o.x + world.sx / 2, o.y, o.z + world.sz / 2, dir.x, dir.y, dir.z, 400);
  if (!hit) return;
  const cx = Math.floor(hit.x / SG.PLOT), cz = Math.floor(hit.z / SG.PLOT);
  if (cx < 0 || cx >= survey.grid || cz < 0 || cz >= survey.grid) return;
  selectedIdx = cz * survey.grid + cx;
  R.drapeTo(R.selectMesh, world, plots[selectedIdx],
    claims.has(selectedIdx) ? 0x8fae63 : plots[selectedIdx].buildable ? 0xd9a441 : 0xc4685a);
  showCard(selectedIdx);
}
function setWalkMode(on) {
  if (on === walkMode) return;
  if (on) {
    if (buildMode) setBuildMode(false);
    const [sx, sz] = walkSpawn();
    walker = SG.createWalker(world, sx, sz);
    yaw = theta; pitch = -0.06;
    orbitSave = { theta, phi, radius, target: target.clone() };
    walkMode = true;
    $('walkBtn').classList.add('active');
    $('crosshair').classList.remove('hidden');
    $('card').classList.add('hidden');
    R.hoverMesh.visible = false; R.ghost.visible = false;
    $('hints').innerHTML = HINT_WALK;
    R.camera.rotation.order = 'YXZ';
    R.camera.fov = 68; R.camera.updateProjectionMatrix();
    R.renderer.domElement.requestPointerLock?.();
    toast('On foot — WASD · space · shift; click surveys the land ahead');
  } else {
    walkMode = false; walker = null;
    document.exitPointerLock?.();
    $('walkBtn').classList.remove('active');
    $('crosshair').classList.add('hidden');
    if (orbitSave) { theta = orbitSave.theta; phi = orbitSave.phi; radius = orbitSave.radius; target.copy(orbitSave.target); }
    R.camera.fov = 50; R.camera.updateProjectionMatrix();
    $('hints').innerHTML = HINT_SURVEY;
    if (selectedIdx >= 0) showCard(selectedIdx);
    toast('Back to the survey glass');
  }
}

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
  if (!opts.silent) { // undo restores prior state; the law applied when it was made
    const t = mayEdit(x, y, z);
    if (!t.ok) { denyEdit(t.why); return false; }
  }
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
    survey = SG.surveyDistrict(world, landmarks, geo);
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
  if (walkMode) {
    if (!document.pointerLockElement) R.renderer.domElement.requestPointerLock?.();
    else if (e.button === 0) surveyAtCrosshair();
    return;
  }
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
  if (walkMode) {
    if (document.pointerLockElement) {
      yaw -= e.movementX * 0.0023;
      pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0021, -1.45, 1.45);
    }
    return;
  }
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
  if (walkMode) return;
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
    const denied = !mayEdit(t.x, t.y, t.z).ok;
    if (tool === 'box' && boxCorner) R.ghostBoxTo(world, boxCorner, t, selectedMat === ERASER, denied);
    else R.ghostTo(world, t.x, t.y, t.z, t.erase, tool === 'box' ? 1 : brushSize, denied);
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
    if (!boxCorner) {
      const may = mayEdit(t.x, t.y, t.z);
      if (!may.ok) { denyEdit(may.why); return; }
      boxCorner = { x: t.x, y: t.y, z: t.z }; toast('Box corner set — click the far corner'); return;
    }
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
  const where = [];
  if (p.regionName) where.push(p.regionName + (p.season ? ' · always ' + p.season : ''));
  if (p.named.length) where.push('near ' + p.named.join(' · '));
  $('placeTxt').textContent = where.join(' — ');
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
    if (p.epithet) add(p.epithet, 'b');
    if (p.equinox) add('Equinox parcel', 'b');
    if (p.seamFrontage) add('Seam frontage');
    if (p.waterfront) add('Waterfront');
    if (p.riverside) add('Riverside');
    if (p.lakefront) add('Lakefront');
    if (p.iceShore) add('Ice shore');
    if (p.blossomFront) add('Blossom front');
    if (p.emberFront) add('Ember front');
    if (p.gladePlot) add(p.gladeWood ? 'Clearing in ' + p.gladeWood : 'Clearing');
    if (p.orchardRow) add('Orchard row');
    if (p.springs) add('Hot springs');
    if (p.clifftop) add('Clifftop');
    if (p.elevPct > 0.85) add('Hilltop');
    if (p.trees >= 4) add('Forested');
    if (p.slope <= 1) add('Level ground');
    for (const [kind, n] of Object.entries(p.minerals))
      add(kind.charAt(0).toUpperCase() + kind.slice(1) + ' ×' + n + (p.iceLocked ? ' · under ice' : ''), 'b');
    if (claims.has(idx)) {
      const shaped = SG.improvements(edits, p);
      if (shaped) add('Shaped ×' + shaped, 'b');
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
const BUILD_MATS = ['GRASS', 'GRASS_SPRING', 'GRASS_DUN', 'FOREST_FLOOR', 'SOIL', 'SAND',
  'GRAVEL', 'CLAY', 'STONE', 'BASALT', 'MOSS', 'SNOW', 'ICE', 'ICE_BLUE',
  'FLOWERS_WHITE', 'FLOWERS_GOLD', 'WOOD', 'BARK_BIRCH',
  'LEAF_PINE', 'LEAF_BROAD', 'LEAF_SPRING', 'LEAF_BLOSSOM', 'LEAF_WILLOW',
  'LEAF_EMBER', 'LEAF_GOLD', 'LEAF_SCARLET', 'LEAF_SPRUCE', 'LEAF_FROST',
  'BUSH_GREEN', 'BUSH_BRAMBLE', 'BRASS',
  'COPPER_ORE', 'IRON_ORE', 'GOLD_ORE', 'CRYSTAL', 'WATER', 'SPRING', 'MILKWATER'];
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
const HINT_BUILD = 'drag&nbsp;·&nbsp;paint&emsp;alt-drag&nbsp;·&nbsp;orbit&emsp;right-click&nbsp;·&nbsp;erase&emsp;alt-click&nbsp;·&nbsp;sample&emsp;ctrl+Z&nbsp;·&nbsp;undo<br>you shape only the parcels you hold (green)&nbsp;·&nbsp;✪ steward lifts the law&nbsp;·&nbsp;edits re-survey live';
const HINT_STEWARD = 'drag&nbsp;·&nbsp;paint&emsp;alt-drag&nbsp;·&nbsp;orbit&emsp;right-click&nbsp;·&nbsp;erase&emsp;alt-click&nbsp;·&nbsp;sample&emsp;ctrl+Z&nbsp;·&nbsp;undo<br>✪ steward&nbsp;·&nbsp;the whole district is yours to sculpt&emsp;edits re-survey live';
const HINT_WALK = 'WASD&nbsp;·&nbsp;walk&emsp;space&nbsp;·&nbsp;jump&emsp;shift&nbsp;·&nbsp;stride&emsp;mouse&nbsp;·&nbsp;look&emsp;click&nbsp;·&nbsp;survey the land ahead<br>Esc&nbsp;·&nbsp;release the mouse&emsp;Esc again (or ⚇)&nbsp;·&nbsp;back to the survey glass';

function setBuildMode(on) {
  if (on && walkMode) setWalkMode(false); // one pair of feet, one pair of hands
  buildMode = on;
  boxCorner = null;
  $('buildBtn').classList.toggle('active', on);
  $('tileset').classList.toggle('hidden', !on);
  $('hints').innerHTML = on ? (steward ? HINT_STEWARD : HINT_BUILD) : HINT_SURVEY;
  if (on) {
    $('card').classList.add('hidden');
    R.hoverMesh.visible = false;
    R.selectMesh.visible = false;
    R.showTenure(world, plots, claims);
    toast(steward ? 'Creator mode — steward: the district is yours to sculpt'
      : claims.size ? 'Creator mode — shape the parcels you hold'
      : 'Creator mode — claim a parcel first, or turn on ✪ steward');
  } else {
    R.ghost.visible = false;
    R.clearTenure();
    if (selectedIdx >= 0) { // resurface the deed, repriced if the land changed
      R.drapeTo(R.selectMesh, world, plots[selectedIdx],
        claims.has(selectedIdx) ? 0x8fae63 : plots[selectedIdx].buildable ? 0xd9a441 : 0xc4685a);
      showCard(selectedIdx);
    }
  }
}
function setSteward(on) {
  steward = on;
  $('stewardBtn').classList.toggle('on', on);
  if (buildMode) $('hints').innerHTML = on ? HINT_STEWARD : HINT_BUILD;
  toast(on ? 'Steward of the district — the tenure law is lifted'
    : 'Tenure law restored — you shape only the parcels you hold');
  persist();
}

/* ---------- persistence ---------- */
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ wallet, claims: [...claims], steward })); } catch {}
}

/* ---------- boot ---------- */
function boot() {
  R.init();
  updateCamera();
  const loadTxt = document.querySelector('#loader .t2');
  setTimeout(async () => {
    const t0 = performance.now();
    const genesis = SG.buildDistrict01();
    world = genesis.world; landmarks = genesis.landmarks; geo = genesis.geo;
    // replay the creator's saved edits on top of genesis before anything reads the world
    for (const [x, y, z, id] of loadEdits())
      if (world.inBounds(x, y, z) && y > 0) {
        world.set(x, y, z, id);
        edits.set(x + ',' + y + ',' + z, id);
      }
    survey = SG.surveyDistrict(world, landmarks, geo);
    plots = survey.plots;
    await R.buildWorld(world, f =>
      loadTxt.textContent = `RAISING THE FOUR WATCHES — CUBE BY CUBE · ${Math.round(f * 100)}%`);
    R.addLandmarks(landmarks, world);
    R.makeDrapes();
    R.makeGhost();
    buildTileset();
    const save = loadSave();
    if (save) {
      wallet = typeof save.wallet === 'number' ? save.wallet : 2500;
      claims = new Set(save.claims || []);
      claims.forEach(idx => { if (plots[idx]) beacons.set(idx, R.addBeacon(world, plots[idx])); });
      steward = !!save.steward; // restored silently — no toast at boot
      $('stewardBtn').classList.toggle('on', steward);
    }
    updateHUD();
    R.updateSun($('sunSlider').value / 100);
    SG.app = { // for tooling & tests
      world, landmarks, geo, survey, plots, claims,
      applyEdit, setBuildMode, setSteward, setWalkMode, claim, surveyAtCrosshair,
      get walker() { return walker; },
      setWalkLook: (y, p) => { yaw = y; pitch = p; },
    };
    console.log('district raised in', Math.round(performance.now() - t0), 'ms');
    requestAnimationFrame(() => requestAnimationFrame(() => $('loader').classList.add('off')));
  }, 80);

  const clock = new THREE.Clock();
  let lastT = 0;
  (function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const dt = Math.min(elapsed - lastT, 0.1);
    lastT = elapsed;
    if (!interacted && !walkMode) theta += 0.0006;
    if (world) {
      R.flushDirty(world);
      if (!walkMode) updateHover();
      R.tick(elapsed, walkMode ? 140 : radius);
    }
    if (walkMode && walker) {
      walker.step(dt, walkInput());
      R.camera.position.set(walker.x - world.sx / 2, walker.y + walker.EYE, walker.z - world.sz / 2);
      R.camera.rotation.set(pitch, yaw, 0);
    } else updateCamera();
    R.renderer.render(R.scene, R.camera);
  })();

  /* UI wiring */
  $('sunSlider').addEventListener('input', e => R.updateSun(e.target.value / 100));
  $('topUp').addEventListener('click', () => {
    wallet += 1000; updateHUD(); persist();
    toast('Simulated purchase — $9.99 pack → 1,000 ◆');
  });
  $('buildBtn').addEventListener('click', () => setBuildMode(!buildMode));
  $('walkBtn').addEventListener('click', () => setWalkMode(!walkMode));
  if (R.IS_TOUCH) $('walkBtn').style.display = 'none'; // needs a keyboard, for now
  $('stewardBtn').addEventListener('click', () => setSteward(!steward));
  $('undoBtn').addEventListener('click', undoEdit);
  $('revertBtn').addEventListener('click', () => {
    if (!edits.size) { toast('No edits to revert'); return; }
    if (!confirm('Revert every edit and restore the authored district?')) return;
    try { localStorage.removeItem(EDITS_KEY); } catch {}
    location.reload();
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    keys.add(e.key.toLowerCase());
    if (walkMode) {
      if (e.key === ' ') e.preventDefault();
      if (e.key === 'Escape' && !document.pointerLockElement) setWalkMode(false);
      if (e.key === 'b' || e.key === 'B') { setWalkMode(false); setBuildMode(true); }
      return;
    }
    if (e.key === 'b' || e.key === 'B') setBuildMode(!buildMode);
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoEdit(); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  addEventListener('contextmenu', e => e.preventDefault());
  document.body.addEventListener('pointerdown', e => {
    if (e.target === R.renderer.domElement) onDown(e);
  });
  document.body.addEventListener('pointermove', onMove);
  document.body.addEventListener('pointerup', onUp);
  document.body.addEventListener('pointercancel', onUp);
  addEventListener('wheel', e => {
    if (walkMode) return;
    interacted = true;
    radius = THREE.MathUtils.clamp(radius * (1 + e.deltaY * 0.0011), 54, 810);
  }, { passive: true });
}

boot();
})();
