import { Router } from 'express';
import { getPosition } from '../services/openf1.js';

const router = Router();

/** GET /sse?topics=v1/location,v1/laps */
router.get('/', async (req, res) => {
    const topics = String(req.query.topics || 'v1/locations,v1/laps,v1/race_control')
    .split(',').map(s => s.trim()).filter(Boolean);

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alve'
    });
    res.flushHeaders?.();

    const unsubs = [];
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
        for (const t of topics) {
            const un = await subscribe(t, (topic, data) => {
                //Messages include _id and _key as mention in doc
                send(topic.replace(/\//g,'_'), { topic, data, ts: Date.now() });
            });
            unsubs.push(un);
        }
    } catch (e) {
        send('error', { message: e.message });
    }

    req.on('close', () => { unsubs.forEach(u => u()); res.end(); });
});

export default router;