/* Socialgen core — the walker: first-person physics against the voxel grid.
   Pure JS, no THREE, no DOM — the same cubes that price the deeds carry
   your weight. AABB player, axis-separated collision, one-cube auto-step
   (the land is terraced; touring it must not need a jump key), gravity,
   and honest water: you wade slow and swim up.

   Coordinates are WORLD grid space ([0..sx), y up); the app layer maps
   feet+eye to the scene camera. */
(() => {
const SG = (globalThis.SG ||= {});

const HW = 0.3;        // half-width of the player's box
const HEIGHT = 1.7;    // feet to crown, in cubes
const EYE = 1.55;      // feet to eye
const GRAV = 24;       // cubes/s²
const JUMP = 8.6;      // clears one cube with room to spare, never two
const STEP = 1.1;      // auto-step ceiling — a single terrace, no more
const SWIM = 3.4;      // upward swim speed while jump is held in water
const TERMINAL = 38, TERMINAL_W = 3.6;

function createWalker(world, x, z) {
  const { sx, sy, sz } = world;
  const solid = (cx, cy, cz) => {
    if (cy < 0) return true;                     // below the world is bedrock's bedrock
    if (cy >= sy) return false;
    if (cx < 0 || cx >= sx || cz < 0 || cz >= sz) return true; // the district has edges
    return SG.OPAQUE[world.get(cx, cy, cz)] === 1;
  };
  const fluidAt = (cx, cy, cz) => {
    if (cy < 0 || cy >= sy || cx < 0 || cx >= sx || cz < 0 || cz >= sz) return false;
    return SG.FLUID[world.get(cx, cy, cz)] === 1;
  };
  // does the player box at feet (px,py,pz) overlap any solid cube?
  const boxHits = (px, py, pz) => {
    const x0 = Math.floor(px - HW), x1 = Math.floor(px + HW);
    const z0 = Math.floor(pz - HW), z1 = Math.floor(pz + HW);
    const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT);
    for (let cy = y0; cy <= y1; cy++)
      for (let cz = z0; cz <= z1; cz++)
        for (let cx = x0; cx <= x1; cx++)
          if (solid(cx, cy, cz)) return true;
    return false;
  };

  const w = {
    x, z, y: world.surfaceAt(Math.floor(x), Math.floor(z)) + 1.01,
    vy: 0, onGround: false, inFluid: false, headFluid: false,
    EYE, HEIGHT,
  };

  // move one axis, clamp against the first solid, report whether we hit
  const moveAxis = (axis, d) => {
    if (d === 0) return false;
    w[axis] += d;
    if (!boxHits(w.x, w.y, w.z)) return false;
    // clamped: back off to the cube face (ε keeps the box out of the wall)
    if (axis === 'y') {
      w.y = d < 0 ? Math.floor(w.y) + 1 + 1e-4 : Math.floor(w.y + HEIGHT) - HEIGHT - 1e-4;
    } else {
      w[axis] = d > 0 ? Math.floor(w[axis] + HW) - HW - 1e-4 : Math.floor(w[axis] - HW) + 1 + HW + 1e-4;
    }
    // a deep clamp can still overlap on diagonal entry — nudge back fully
    if (boxHits(w.x, w.y, w.z)) w[axis] -= d;
    return true;
  };

  // horizontal move with the auto-step: when a grounded walker is blocked
  // by exactly one terrace, lift to its top and take the move again
  const moveHoriz = (axis, d) => {
    if (!moveAxis(axis, d)) return;              // moved free — done
    if (!w.onGround || w.inFluid) return;
    const lift = Math.floor(w.y) + 1 + 1e-3 - w.y;
    if (lift <= 0 || lift > STEP) return;
    if (boxHits(w.x, w.y + lift, w.z)) return;   // no headroom on the terrace
    w.y += lift;
    if (moveAxis(axis, d)) w.y -= lift;          // still a wall up there — stay down
  };

  w.step = (dt, input = {}) => {
    // fixed-ish substeps keep tunnel-through and stair-skips impossible
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-6) {
      const h = Math.min(remaining, 1 / 60);
      remaining -= h;

      const fx = Math.floor(w.x), fz = Math.floor(w.z);
      w.inFluid = fluidAt(fx, Math.floor(w.y + 0.2), fz) || fluidAt(fx, Math.floor(w.y + 0.9), fz);
      w.headFluid = fluidAt(fx, Math.floor(w.y + 1.45), fz);

      // vertical
      if (input.jump && w.onGround && !w.inFluid) { w.vy = JUMP; w.onGround = false; }
      if (w.inFluid) {
        w.vy = input.jump ? SWIM : Math.max(w.vy - GRAV * 0.32 * h, -TERMINAL_W);
      } else {
        w.vy = Math.max(w.vy - GRAV * h, -TERMINAL);
      }
      const hitY = moveAxis('y', w.vy * h);
      if (hitY) {
        if (w.vy < 0) w.onGround = true;
        w.vy = 0;
      } else if (w.vy !== 0) w.onGround = false;

      // horizontal (wading halves your stride)
      const k = w.inFluid ? 0.5 : 1;
      moveHoriz('x', (input.vx || 0) * k * h);
      moveHoriz('z', (input.vz || 0) * k * h);

      // the district has edges; the walker stays on it
      w.x = Math.min(Math.max(w.x, HW + 0.01), sx - HW - 0.01);
      w.z = Math.min(Math.max(w.z, HW + 0.01), sz - HW - 0.01);
    }
    return w;
  };

  // relocate (spawning at a plot, teleporting a tour): feet on the surface,
  // nudged up out of any trunk or canopy that stands there
  w.place = (px, pz) => {
    w.x = px; w.z = pz;
    w.y = Math.max(world.surfaceAt(Math.floor(px), Math.floor(pz)), SG.SEA) + 1.01;
    for (let k = 0; k < 30 && boxHits(w.x, w.y, w.z); k++) w.y += 1;
    w.vy = 0; w.onGround = false;
  };
  w.place(x, z);

  return w;
}

SG.createWalker = createWalker;
})();
