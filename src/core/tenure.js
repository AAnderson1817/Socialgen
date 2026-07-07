/* Socialgen core — tenure: who may shape which cubes.
   The deed IS the edit permission. A parcel's columns may be sculpted only
   by the holder of its deed; the commons are held in trust and refuse
   everyone; bedrock is forever. Pure JS — the headless suite gates this
   law the same way it gates the world. */
(() => {
const SG = (globalThis.SG ||= {});

// canEdit(survey, claims, x, y, z) -> { ok, idx?, why? }
//   survey — the current survey (grid + plots), claims — Set of held plot idx
//   why ∈ 'bedrock' | 'open water' | 'commons' | 'no deed'
function canEdit(survey, claims, x, y, z) {
  if (y === 0) return { ok: false, why: 'bedrock' };
  const P = SG.PLOT, g = survey.grid;
  const cx = Math.floor(x / P), cz = Math.floor(z / P);
  if (cx < 0 || cx >= g || cz < 0 || cz >= g) return { ok: false, why: 'open water' };
  const idx = cz * g + cx;
  if (claims.has(idx)) return { ok: true, idx };
  const p = survey.plots[idx];
  return { ok: false, idx, why: p && p.commons ? 'commons' : 'no deed' };
}

// improvements(edits, plot) — the deed's ledger: how many cubes its holder
// has shaped, derived from the edit diff ("x,y,z" keys), so it survives
// reload and undo for free
function improvements(edits, plot) {
  const P = SG.PLOT;
  let n = 0;
  for (const k of edits.keys()) {
    const c1 = k.indexOf(','), c2 = k.indexOf(',', c1 + 1);
    const x = +k.slice(0, c1), z = +k.slice(c2 + 1);
    if (x >= plot.x0 && x < plot.x0 + P && z >= plot.z0 && z < plot.z0 + P) n++;
  }
  return n;
}

SG.canEdit = canEdit;
SG.improvements = improvements;
})();
