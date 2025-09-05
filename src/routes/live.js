import { Router } from 'express';
import { getDrivers, getPosition, getLaps, getPit, getIntervals, getStints, getCarData, getStartingGrid, getSessionByKey } from '../services/openf1.js';
import { mergeLive } from '../services/adapters.js';


const router = Router();

const INIT_WINDOW_MS = Number(process.env.LIVE_INIT_WINDOWS_MS ?? 30000);
const FALLBACK_WINDOW_MS = Number(process.env.LIVE_FALLBACK_MS ?? 15*60*1000);

let sinceIso = null; 
let lastSessionKey = null; 

function parseWindow(s) {
    if (!s) return null;
    const m = /^(\d+)\s*(ms|s|m|h)?$/i.exec(String(s).trim());
    if (!m) return null;
    const n = +m[1], u = (m[2]||'ms').toLowerCase();
    return u==='h'? n*3600000 : u==='m'? n*60000 : u==='s'? n*1000 : n;
}

// returns [] if fetch fails
async function safe(promise, label) {
    try { return await promise; }
    catch (e) { console.warn(`[live] ${label} failed: ${e?.message || e}`); return []; }
}

router.get('/', async (req, res, next) => {
    try {
        const sessionKey = Number(req.query.session_key);
        if (!sessionKey) return res.status(400).json({ error: 'missing session_key'});

        const lite = String(req.query.lite ?? '').toLowerCase();
        const isLite = lite === '1' || lite === 'true';

        if (lastSessionKey !== sessionKey) {
            sinceIso = null;
            lastSessionKey = sessionKey;
        }

        // "LIVE" WINDOW - FIRST TRY
        const win = parseWindow(req.query.window) ?? INIT_WINDOW_MS;
        const fromIso = sinceIso ?? new Date(Date.now() - win).toISOString();

        let [drivers, pos, laps, pits, intervals, stints, carData, grid] = await Promise.all([
            safe(getDrivers(sessionKey), 'drivers'),
            safe(getPosition(sessionKey, fromIso), 'positions'),
            safe(getLaps(sessionKey, fromIso), 'laps'),
            safe(getPit(sessionKey, fromIso), 'pit'),
            isLite ? [] : safe(getIntervals(sessionKey, fromIso), 'intervals'),
            safe(getStints(sessionKey), 'stints'),
            isLite ? [] : safe(getCarData(sessionKey, fromIso), 'car_data'),
            safe(getStartingGrid(sessionKey), 'starting_grid'),
        ]);

        //IF NO POSITIONS, TRY "HISTORIC"
        if (!pos?.length) {
            const sess = await safe(getSessionByKey(sessionKey), 'session_by_key');
            const endIso = Array.isArray(sess) && sess[0]?.date_end ? new Date(sess[0].date_end).toISOString() : new Date().toISOString();
            const startIso = new Date(Date.parse(endIso) - FALLBACK_WINDOW_MS).toISOString();
            console.warn(`[live] positions empty in live window, retrying from ${startIso} to ${endIso}`);
            pos = await safe(getPosition(sessionKey, startIso, endIso), 'position_fallback');
            //To complete bring laps/pits
            if(!laps?.length) laps = await safe(getLaps(sessionKey, startIso), 'laps_fallback');
            if(!pits?.length) pits = await safe(getPit(sessionKey, startIso), 'pit_fallback');
        }

        const maxDate = maxIso(
            [...pos, ...laps, ...pits, ...intervals, ...carData]
            .map(x => x?.date || x?.date_start).filter(Boolean));
        if (maxDate) sinceIso = maxDate;

        const leaderBoard = mergeLive(
            drivers, pos, laps, pits, intervals, stints, carData, grid
        );

        //Current race leader lap
        const lapsCompleted = leaderBoard.length
            ? Math.max(...leaderBoard.map(r => r.lapsCompleted ?? 0))
            : undefined;

        //Avoid cache in endpoint "live"
        res.setHeader('Cache-Control', 'no-store');

        res.json({
            sessionKey,
            lapsCompleted,
            leaderBoard,
            timestamp: Date.now()
        });

    } catch (err) {
        next(err);
    }
});

function maxIso(isos) {
    let bestT = 0, best = null;
    for (const s of (isos || [])) {
        const t = Date.parse(s);
        if (Number.isFinite(t) && t > bestT) { 
            bestT = t; 
            best = new Date(t).toISOString(); 
        }
    }
    return best;
}

export default router;

