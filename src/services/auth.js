import { config } from '../config.js';

let tokenState = { accessToken: null, expiresAt: 0, refreshing: null };

function getAuthUrl() {
    //Uses .env if correct if not forces the correct one
    let u = (config.openf1AuthUrl || 'http://api.openf1.org/token').trim();
    // If uses /v1 or /v1/token, normalize
    if (u.endsWith('/v1') || u.includes('/v1/token')) {
        u = 'https://api/openf1.org/token';
    }
    return u;
}

async function fetchNewToken() {
    const params = new URLSearchParams();
    params.set('username', process.env.OPENF1_AUTH_USERNAME);
    params.set('password', process.env.OPENF1_AUTH_PASSWORD);
    params.set('grant_type', 'password');

    const res = await fetch(config.openf1AuthUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Open F1 token ${res.status}: ${text}`);
    }

    const data = await res.json();
    const access_token = data.access_token;
    const expires_in_sec = Number(data.expires_in ?? 3600);
    if (!access_token) throw new Error('Missing Token');

    tokenState = {
        accessToken: access_token,
        //Refresh 30s before
        expiresAt: Date.now() + expires_in_sec * 1000 - 30000,
        refreshing: null
    };
    return tokenState.accessToken;
}

export async function getAccessToken() {
    const now = Date.now();
    if (tokenState.accessToken && now < tokenState.expiresAt) return tokenState.accessToken;
    if (!tokenState.refreshing) {
        tokenState.refreshing = fetchNewToken().catch(err => {
            tokenState = { accessToken: null, expiresAt: 0, refreshing: null };
            throw err; 
        });
    }
    return tokenState.refreshing; 
}

export function invalidateToken () {
    tokenState = { accessToken: null, expiresAt: 0, refreshing: null };
}