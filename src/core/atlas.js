/* Socialgen core — the atlas: the district drawn from its own cubes.
   A top-down RGBA render (one pixel per column) built from the palette's
   top colors with height relief and inked seams — pure JS, deterministic,
   headless-testable. The app layer blits it to a canvas; the certificate
   crops it. Also the deep-link grammar for sharing a deed. */
(() => {
const SG = (globalThis.SG ||= {});

// atlasColors(world, geo?) -> { w, h, rgba: Uint8ClampedArray (w*h*4) }
// column color = top visible cube's colorTop; open water reads as water
// even over a carved bed; height shades the relief; seams ink faintly.
function atlasColors(world, geo) {
  const { sx, sz } = world;
  const rgba = new Uint8ClampedArray(sx * sz * 4);
  for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
    const i = z * sx + x;
    const hTop = world.heightAt(x, z);
    let id = world.get(x, hTop, z);
    let e = SG.PALETTE[id];
    if (!e || id === SG.MAT.AIR) { e = SG.PALETTE[SG.MAT.WATER]; }
    let c = e.colorTop;
    let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    // relief: high country lifts, the deeps sink (sea floor reads darker)
    const k = e.fluid ? 0.62 + Math.max(hTop - SG.SEA, -8) * 0.012
      : 0.72 + (hTop - SG.SEA) * 0.011;
    r *= k; g *= k; b *= k;
    // the seams are drawn on the map, as they are drawn on the land
    if (geo && geo.seamDist && geo.seamDist[i] < 1.2 && !e.fluid) { r *= 0.55; g *= 0.55; b *= 0.55; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
  }
  return { w: sx, h: sz, rgba };
}

// deep links: '#p=07·22' names a plot; the middot is the survey's own
// notation. parse accepts middot, dot, or comma (typed links happen).
const pad2 = n => String(n).padStart(2, '0');
function plotLink(cx, cz) { return '#p=' + pad2(cx) + '·' + pad2(cz); }
function parsePlotLink(hash, grid) {
  const m = /^#?p=(\d{1,2})[·.,](\d{1,2})$/.exec(decodeURIComponent(hash || '').trim());
  if (!m) return null;
  const cx = +m[1], cz = +m[2];
  if (!(cx >= 0 && cz >= 0 && (!grid || (cx < grid && cz < grid)))) return null;
  return { cx, cz };
}

SG.atlasColors = atlasColors;
SG.plotLink = plotLink;
SG.parsePlotLink = parsePlotLink;
})();
