// src/routes/debug.js
import { Router } from 'express';
import { getPosition, getIntervals } from '../services/openf1.js';

const router = Router();

/** utils **/
function parseWindow(s) {
  if (!s) return null;
  const m = /^(\d+)\s*(ms|s|m|h)?$/i.exec(String(s).trim());
  if (!m) return null;
  const n = +m[1], u = (m[2] || 'ms').toLowerCase();
  return u === 'h' ? n * 3600000 : u === 'm' ? n * 60000 : u === 's' ? n * 1000 : n;
}
function fromWindowMs(ms = 300000) { // 5 min por defecto
  return new Date(Date.now() - Number(ms)).toISOString();
}

/** -----------------------
 *  /debug/position
 *  Devuelve cantidad y una muestra de /position para una ventana hacia atrás
 *  Params:
 *   - session_key (obligatorio)
 *   - ms (opcional, ej: 600000) o window (ej: 5m, 15m, 1h)
 * ----------------------- */
router.get('/position', async (req, res, next) => {
  try {
    const sessionKey = Number(req.query.session_key);
    if (!sessionKey) return res.status(400).json({ error: 'missing_session_key' });

    const win = parseWindow(req.query.window) ?? Number(req.query.ms ?? 300000);
    const fromIso = fromWindowMs(win);

    let pos = await getPosition(sessionKey, fromIso);
    //Fallback: checks for 30 min span
    if (!pos?.length) {
        const fromIsoWide = fromWindowMs(30 * 60 * 1000);
        pos = await getPosition(sessionKey, fromIsoWide);
    }
    res.json({ sessionKey, fromIso, count: pos.length, sample: pos.slice(0, 5) });
  } catch (e) { next(e); }
});

/** helpers para intervals → posiciones estimadas **/
function parseGapRaw(x) {
  if (x == null) return { laps: 0, ms: 0 }; // líder
  if (typeof x === 'string' && x.toUpperCase().includes('LAP')) {
    const m = /(\d+)/.exec(x);
    return { laps: Number(m?.[1] || 1), ms: 0 };
  }
  const sec = Number(x);
  return Number.isFinite(sec)
    ? { laps: 0, ms: Math.round(sec * 1000) }
    : { laps: 0, ms: Number.MAX_SAFE_INTEGER };
}
function buildPositionsFromIntervals(intervals) {
  const latest = {};
  for (const iv of intervals || []) {
    const k = Number(iv.driver_number);
    const t = Date.parse(iv.date);
    if (!Number.isFinite(t)) continue;
    if (!latest[k] || t > latest[k]._t) latest[k] = { ...iv, _t: t };
  }
  const arr = Object.values(latest).map(iv => {
    const g = parseGapRaw(iv.gap_to_leader);
    return { driver_number: Number(iv.driver_number), laps: g.laps, gapMs: g.ms, date: iv.date };
  });
  // orden lógico: menos vueltas perdidas primero, luego menor gap
  arr.sort((a, b) => (a.laps - b.laps) || (a.gapMs - b.gapMs) || (a.driver_number - b.driver_number));
  return arr.map((x, i) => ({
    driver_number: x.driver_number,
    position: i + 1,
    date: x.date || new Date().toISOString()
  }));
}

/** -----------------------
 *  /debug/intervals
 *  Devuelve:
 *   - cantidad y muestra cruda de /intervals
 *   - "positionsFromIntervals": orden estimado usando el último interval por piloto
 *  Params:
 *   - session_key (obligatorio)
 *   - ms o window (igual que /debug/position)
 * ----------------------- */
router.get('/intervals', async (req, res, next) => {
  try {
    const sessionKey = Number(req.query.session_key);
    if (!sessionKey) return res.status(400).json({ error: 'missing_session_key' });

    const win = parseWindow(req.query.window) ?? Number(req.query.ms ?? 300000);
    const fromIso = fromWindowMs(win);

    const intervals = await getIntervals(sessionKey, fromIso);
    const estimated = buildPositionsFromIntervals(intervals);

    res.json({
      sessionKey,
      fromIso,
      intervalsCount: intervals.length,
      intervalsSample: intervals.slice(0, 5),
      positionsFromIntervals: estimated.slice(0, 20) // top 20 para ver rápido
    });
  } catch (e) { next(e); }
});

export default router;
