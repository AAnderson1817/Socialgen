/* Socialgen core — chunked voxel world.
   One byte per cube, column-contiguous layout: idx = (z*sx + x)*sy + y.
   Columns are the unit of ownership (a plot is an 8×8 bundle of columns),
   so keeping each column contiguous makes surveys and RLE serialization fast.
   Pure JS — no THREE. */
(() => {
const SG = (globalThis.SG ||= {});
const { MAT, PALETTE } = SG;

class World {
  constructor(sx, sy, sz) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.data = new Uint8Array(sx * sy * sz);
  }
  inBounds(x, y, z) {
    return x >= 0 && x < this.sx && y >= 0 && y < this.sy && z >= 0 && z < this.sz;
  }
  idx(x, y, z) { return (z * this.sx + x) * this.sy + y; }
  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return MAT.AIR;
    return this.data[(z * this.sx + x) * this.sy + y];
  }
  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.data[(z * this.sx + x) * this.sy + y] = id;
  }
  // Topmost non-air cube in a column, or -1.
  heightAt(x, z) {
    if (x < 0 || x >= this.sx || z < 0 || z >= this.sz) return -1;
    const base = (z * this.sx + x) * this.sy;
    for (let y = this.sy - 1; y >= 0; y--) if (this.data[base + y] !== MAT.AIR) return y;
    return -1;
  }
  // Topmost GROUND cube (skips fluids and canopy/trunks) — what a survey stands on.
  surfaceAt(x, z) {
    if (x < 0 || x >= this.sx || z < 0 || z >= this.sz) return -1;
    const base = (z * this.sx + x) * this.sy;
    for (let y = this.sy - 1; y >= 0; y--) {
      const e = PALETTE[this.data[base + y]];
      if (e.ground) return y;
    }
    return -1;
  }
  fill(x0, y0, z0, x1, y1, z1, id) {
    for (let z = Math.max(0, z0); z <= Math.min(this.sz - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(this.sx - 1, x1); x++) {
        const base = (z * this.sx + x) * this.sy;
        for (let y = Math.max(0, y0); y <= Math.min(this.sy - 1, y1); y++)
          this.data[base + y] = id;
      }
  }
  // Count cubes of each material inside a column box (survey: buried resources).
  countInBox(x0, z0, x1, z1, counts) {
    counts ||= new Uint32Array(PALETTE.length);
    for (let z = Math.max(0, z0); z <= Math.min(this.sz - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(this.sx - 1, x1); x++) {
        const base = (z * this.sx + x) * this.sy;
        for (let y = 0; y < this.sy; y++) counts[this.data[base + y]]++;
      }
    return counts;
  }
  // FNV-1a over the raw bytes — determinism checks in tests.
  checksum() {
    let h = 0x811c9dc5;
    const d = this.data;
    for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  // RLE serialization: 'SGW1' + dims (uint16le ×3) + (count uint16le, id uint8) runs.
  serialize() {
    const out = [0x53, 0x47, 0x57, 0x31,
      this.sx & 255, this.sx >> 8, this.sy & 255, this.sy >> 8, this.sz & 255, this.sz >> 8];
    const d = this.data;
    let run = 1;
    for (let i = 1; i <= d.length; i++) {
      if (i < d.length && d[i] === d[i - 1] && run < 0xffff) { run++; continue; }
      out.push(run & 255, run >> 8, d[i - 1]);
      run = 1;
    }
    return new Uint8Array(out);
  }
  static deserialize(buf) {
    if (buf[0] !== 0x53 || buf[1] !== 0x47 || buf[2] !== 0x57 || buf[3] !== 0x31)
      throw new Error('not an SGW1 world');
    const sx = buf[4] | (buf[5] << 8), sy = buf[6] | (buf[7] << 8), sz = buf[8] | (buf[9] << 8);
    const w = new World(sx, sy, sz);
    let p = 10, i = 0;
    while (p < buf.length) {
      const run = buf[p] | (buf[p + 1] << 8), id = buf[p + 2];
      w.data.fill(id, i, i + run);
      i += run; p += 3;
    }
    if (i !== w.data.length) throw new Error('SGW1 truncated');
    return w;
  }
}

SG.World = World;
})();
