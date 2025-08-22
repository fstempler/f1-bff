import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import metaRouter from './routes/meta.js';
import liveRouter from './routes/live.js';
import feedRouter from './routes/feed.js';
import sseRouter from './routes/sse.js';

const allow = process.env.FRONT_ORIGIN || true;

export function createApp() {
    const app = express();
    app.use(cors({ origin: allow }));
    app.use(express.json());
    app.use(morgan('tiny'));

    app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

    app.use('/meta', metaRouter);
    app.use('/live', liveRouter);
    app.use('/feed', feedRouter);
    app.use('/sse', sseRouter);

    //Error handler

    app.use((err, _req, res, _next) => {
        console.error(err);
        res.status(500).json({ error: 'internal_error', detail: err?.message });
    });

    return app;
}