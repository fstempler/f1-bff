import Bottleneck from "bottleneck";
import pRetry from "p-retry";
import { config } from "../config.js";
import { getAccessToken, invalidateToken } from "../services/auth.js";

const limiter = new Bottleneck({
    minTime: Math.ceil(100 / config.limits.openf1MaxRps),
    maxConcurrent: 1
});

export async function  getJson(path, params = {}) {
    //Unite base + path
    const base = (config.openf1Base || 'https://api.openf1.org/v1').replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(base + p);
        
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    return limiter.schedule(() => 
        pRetry(async () => {
            let token = await getAccessToken();
            let res = await fetch(url, {
                method: 'GET',
                headers: { accept: 'application/json', Authorization: `Bearer ${token}` }
            });

            //If token expires during call
            if (res.status === 401) {
                invalidateToken();
                token = await getAccessToken();
                res = await fetch(url, {
                    method: 'GET',
                    headers: { accept: 'application/json', Authorization: `Bearer ${token}` }
                });
            }

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            return res.json();
        }, {retries: 3, minTimeout: 400, maxTimeout: 1500 })
    );
}