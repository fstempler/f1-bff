import { Router } from 'express';
import { getDrivers, getPosition, getLaps, getPit, getIntervals, getStints, getCarData, getStartingGrid } from '../services/openf1.js';
import { mergeLive } from '../services/adapters.js';

const router = Router();

let sinceIso = null; 
let lastSessionKey = null; 

// returns [] if fetch fails
async function safe(promise, label) {
    try { return await promise; }
    catch (e) { console.warn(`[live] ${label} failed: ${e?.message || e}`); return []; }
}

router.get('/', async (req, res, next) => {
    try {
        const sessionKey = Number(req.query.session_key);
        if (!sessionKey) return res.status(400).json({ error: 'missing session_key'});

        if (lastSessionKey !== sessionKey) {
            sinceIso = null;
            lastSessionKey = sessionKey;
        }

        const [drivers, pos, laps, pits, intervals, stints, carData, grid] = await Promise.all([
            safe(getDrivers(sessionKey), 'drivers'),
            safe(getPosition(sessionKey, sinceIso), 'positions'),
            safe(getLaps(sessionKey, sinceIso), 'laps'),
            safe(getPit(sessionKey, sinceIso), 'pit'),
            isLite ? [] : safe(getIntervals(sessionKey, sinceIso), 'intervals'),
            safe(getStints(sessionKey), 'stints'),
            isLite ? [] : safe(getCarData(sessionKey, sinceIso), 'car_data'),
            safe(getStartingGrid(sessionKey), 'starting_grid'),
        ]);

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
    for (const s of isos) {
        const t = Date.parse(s);
        if (Number.isFinite(t) && t > bestT) { 
            bestT = d; 
            best = new Date(d).toISOString(); 
        }
    }
    return best;
}

export default router;

