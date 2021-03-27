
const ASSETS_CACHE = 'assets-v1';
const ASSETS = [
    '/',
    '/app.webmanifest', // en locale
    '/main.mjs',
    '/main.css',
    '/common.css',
    '/chatspace-comment.css',
    '/app-icon-192px.png',
    '/app-icon-256px.png',
    '/app-icon-512px.png',
    '/favicon-256px.png',
    '/fullsize-icon-256px.png',
    '/MaterialIcons-Regular.woff2',
    '/lib/buffer.mjs',
    '/lib/hex.mjs',
    '/lib/base64.mjs',
    '/lib/Settings.mjs',
    '/lib/WindowBroadcast.mjs',
    '/lib/random.mjs',
    '/lib/uuid.mjs',
    '/lib/utf8.mjs',
    '/lib/Session.mjs',
    '/lib/noble-ed25519-1.0.3.mjs',
    '/lib/x25519.mjs',
].map(path => String(new URL(path, location.href)));

self.addEventListener('install', ev => {
    ev.waitUntil((async () => {
        console.log('sw: install');
        const cache = await caches.open(ASSETS_CACHE);
        const keys = await cache.keys();
        const cachedUrls = new Set;
        const promises = [];

        for (const req of keys) {
            cachedUrls.add(req.url);
            if (!ASSETS.includes(req.url)) {
                promises.push(cache.delete(req));
            }
        }

        for (const url of ASSETS) {
            if (!cachedUrls.has(url)) {
                promises.push(cache.add(url));
            }
        }

        await Promise.all(promises);
    })());
});

// cleanup of old cache
self.addEventListener('activate', ev => {
    ev.waitUntil((async () => {
        console.log('sw: activate');
    })());
});

self.addEventListener('fetch', ev => {
    ev.respondWith((async (request) => {
        const cache = await caches.open(ASSETS_CACHE);
        const match = await cache.match(request);
        if (!match) {
            return await fetch(request);
        }
        try {
            const freshResponse = await fetch(request);
            if (!freshResponse.ok) {
                throw 'Non-2xx response';
            }
            await cache.put(request, freshResponse.clone());
            return freshResponse;
        } catch (e) {
            console.warn('sw: fetch error:', request.url, e);
            return match;
        }
    })(ev.request));
});
