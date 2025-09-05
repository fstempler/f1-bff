import { Router } from "express";
import { getPosition } from "../services/openf1.js";

const r = Router();
r.get('/position', async (req, res, next) => {
    try {
        const k = Number(req.query.session_key);
        const w = Number(req.query.ms ?? 300000);
        const from = new Date(Date.now() - w).toISOString();
        const pos = await getPosition(k, from);
        res.json({ count: pos.length, sample: pos.slice(0, 3) });
    } catch (e) { next(e); }
});

export default r;