import { Router } from 'express';
import { getCurrentSession, getDrivers } from '../services/openf1.js';
import { adaptSessionMeta } from '../services/adapters.js';
import { makeCache } from '../lib/cache.js';
import { config } from '../config.js';

const cache = makeCache(50);
const router = Router();

router.get('/', async (_req, res, next) => {
    try {
        const key = 'meta:current';
        const hit = cache.get(key);
        if (hit) return res.json(hit);

        const session = await getCurrentSession();
        if (!session) return res.status(404).json({ error: 'no_session' });

        const drivers = await getDrivers(Number(session.session_key));
        const meta = adaptSessionMeta(session, drivers);

        cache.set(key, meta);
        setTimeout(() => cache.del(key), config.poll.meta);
        res.json(meta);
    } catch (e) { next(e); }

});

export default router;