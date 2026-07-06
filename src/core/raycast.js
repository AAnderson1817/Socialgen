/* Socialgen core — DDA voxel raycast (Amanatides & Woo).
   Exact grid traversal from any origin/direction: returns the first non-air
   cube, the face it was entered through, and the last empty cell before it.
   This replaces mesh raycasting for picking — no proxy geometry needed.
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT } = SG;

// origin/dir are in grid space (cube (x,y,z) spans [x,x+1)). dir need not be normalized.
function raycast(world, ox, oy, oz, dx, dy, dz, maxDist = 1000) {
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return null;
  dx /= len; dy /= len; dz /= len;

  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tdZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmX = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdX) : Infinity;
  let tmY = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdY) : Infinity;
  let tmZ = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdZ) : Infinity;

  let t = 0, face = null, px = x, py = y, pz = z;
  for (let i = 0; i < 4096; i++) {
    if (world.inBounds(x, y, z)) {
      const id = world.get(x, y, z);
      if (id !== MAT.AIR)
        return { x, y, z, id, t, face, prev: { x: px, y: py, z: pz } };
    }
    px = x; py = y; pz = z;
    if (tmX < tmY && tmX < tmZ) { x += stepX; t = tmX; tmX += tdX; face = stepX > 0 ? '-x' : '+x'; }
    else if (tmY < tmZ)         { y += stepY; t = tmY; tmY += tdY; face = stepY > 0 ? '-y' : '+y'; }
    else                        { z += stepZ; t = tmZ; tmZ += tdZ; face = stepZ > 0 ? '-z' : '+z'; }
    if (t > maxDist) return null;
    // once past the world on all axes with no re-entry possible, bail early
    if ((x < 0 && stepX < 0) || (x >= world.sx && stepX > 0)) if ((y < 0 && stepY < 0) || (y >= world.sy && stepY > 0) || (z < 0 && stepZ < 0) || (z >= world.sz && stepZ > 0)) return null;
  }
  return null;
}

SG.raycast = raycast;
})();
