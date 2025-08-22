import { Router } from 'express';
import { getCurrentSession, getDrivers, getSessionByKey } from '../services/openf1.js';
import { adaptSessionMeta } from '../services/adapters.js';
import { makeCache } from '../lib/cache.js';
import { config } from '../config.js';

const cache = makeCache(50);
const router = Router();
let lastGoodMeta = null;

async function safe(promise, label) {
    try { return await promise; }
    catch (e) { console.watn(`[meta] ${label} failed: ${e.message || e}`); return null; }
}

router.get('/', async (req, res, next) => {
    try {
        const overrideKey = req.query.session_key ? Number(req.query.session_key) : null;
        const yearParam = req.query.year ? Number(req.query.year) : new Date().getUTCFullYear();

        let session = null;

        if (overrideKey) {
            const arr = await safe(getSessionByKey(overrideKey), 'session_by_key');
            session = Array.isArray(arr) && arr[0] ? arr[0] : { session_key: overrideKey };
        } else {
            session = await safe(getCurrentSession(yearParam), 'current_session');
            if (!session) session = await safe(getCurrentSession(yearParam - 1), 'current_session_prev');
        }

        if (!session) {
            if (lastGoodMeta) {
                res.setHeader('Cache-Control', 'no-store');
                return res.json(lastGoodMeta);
            }
            return res.status(503).json({ error: 'meta_enavailable' });
        }

        const drivers = await safe(getDrivers(Number(session.session_key)), 'drivers') || [];
        const meta = adaptSessionMeta(session, drivers);
        lastGoodMeta = meta;

        res.setHeader('Cache-Control', 'no-store');
        res.json(meta);
    } catch (err) { next(err); }

});

export default router;