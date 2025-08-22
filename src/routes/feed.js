import { Router } from 'express';
import { getRaceControl } from '../services/openf1.js';
import { makeCache } from '../lib/cache.js';
import { config } from '../config.js'

const cache = makeCache(100);
const router = Router();

router.get('/', async (req, res, next) => {
    try {
        const sessionKey = Number(req.query.session_key);
        if (!sessionKey) return res.status(400).json({ error: 'missing_session_key' });

        const key = `feed:${sessionKey}`;
        const hit = cache.get(key);
        if (hit) return res.json(hit);

        const raw = await getRaceControl(sessionKey);
        const feed = (raw ?? []).map(r => ({
            at: Date.parse(r.date ?? new Date().toISOString()),
            text: r.message ?? r.text,
            type: r.category ?? 'RC',
            driverNumber: r.druver_number,
            lap: r.lap_number ?? r.lap ?? undefined,
        })).sort((a, b) => b.at - a.at);

        cache.set(key, feed);
        setTimeout(() => cache.del(key), config.poll.live * 2);
        res.json(feed);
    } catch (e) { next(e); }
});

export default router; 