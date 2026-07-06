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
    if (moved < 7 && Date.now() - downTime < 600 && e.button === 0) pickPlot(e.clientX, e.clientY);
  }
  if (pointers.size < 2) pinchDist = 0;
}

/* ---------- picking: exact voxel DDA, no proxy meshes ---------- */
const raycaster = new THREE.Raycaster();
function plotFromScreen(px, py) {
  raycaster.setFromCamera(new THREE.Vector2((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1), R.camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const hit = SG.raycast(world, o.x + world.sx / 2, o.y, o.z + world.sz / 2, d.x, d.y, d.z, 1200);
  if (!hit) return -1;
  const cx = Math.floor(hit.x / SG.PLOT), cz = Math.floor(hit.z / SG.PLOT);
  if (cx < 0 || cx >= survey.grid || cz < 0 || cz >= survey.grid) return -1;
  return cz * survey.grid + cx;
}
function hoverPlot() {
  if (!needRay || R.IS_TOUCH || !world) return;
  needRay = false;
  if (radius > 320) { R.hoverMesh.visible = false; return; }
  const px = (lastNDC.x + 1) / 2 * innerWidth, py = (1 - lastNDC.y) / 2 * innerHeight;
  const idx = plotFromScreen(px, py);
  if (idx < 0 || idx === selectedIdx) { R.hoverMesh.visible = false; return; }
  const p = plots[idx];
  R.drapeTo(R.hoverMesh, world, p,
    claims.has(idx) ? 0x8fae63 : p.buildable ? 0xd9a441 : 0xc4685a);
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
    survey = SG.surveyDistrict(world, landmarks);
    plots = survey.plots;
    R.buildWorld(world);
    R.addLandmarks(landmarks, world);
    R.makeDrapes();
    const save = loadSave();
    if (save) {
      wallet = typeof save.wallet === 'number' ? save.wallet : 2500;
      claims = new Set(save.claims || []);
      claims.forEach(idx => { if (plots[idx]) beacons.set(idx, R.addBeacon(world, plots[idx])); });
    }
    updateHUD();
    R.updateSun($('sunSlider').value / 100);
    SG.app = { world, landmarks, survey, plots, claims }; // for tooling & tests
    console.log('district raised in', Math.round(performance.now() - t0), 'ms');
    requestAnimationFrame(() => requestAnimationFrame(() => $('loader').classList.add('off')));
  }, 80);

  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    if (!interacted) theta += 0.0006;
    if (world) { hoverPlot(); R.tick(clock.getElapsedTime(), radius); }
    updateCamera();
    R.renderer.render(R.scene, R.camera);
  })();

  /* UI wiring */
  $('sunSlider').addEventListener('input', e => R.updateSun(e.target.value / 100));
  $('topUp').addEventListener('click', () => {
    wallet += 1000; updateHUD(); persist();
    toast('Simulated purchase — $9.99 pack → 1,000 ◆');
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
