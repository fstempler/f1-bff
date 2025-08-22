import { LRUCache } from 'lru-cache';

export function makeCache(max = 100) {
    const c = new LRUCache({ max });

    return {
        get: (key) => c.get(key)?.value,
        set: (key, value) => c.set(key, { value, ts: Date.now() }),
        has: (key) => c.has(key),
        del: (key) => c.delete(key),
        clear: () => c.clear()
    };
}