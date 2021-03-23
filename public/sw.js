
const ASSETS_CACHE = 'assets-v1';
const ASSETS = [
    '/',
    '/app.webmanifest', // en locale
    '/main.mjs',
    '/main.css',
    '/app-icon-256px.png',
    '/favicon-256px.png',
    '/fullsize-icon-256px.png',
    '/MaterialIcons-Regular.woff2',
    '/buffer.mjs',
    '/noble-ed25519-1.0.3.mjs',
    '/x25519.mjs',
];

self.addEventListener('install', ev => {
    ev.waitUntil((async () => {
        console.log('sw: install');
        const cache = await caches.open(ASSETS_CACHE);
        await cache.addAll(ASSETS);
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
            await cache.put(request, freshResponse);
            return freshResponse;
        } catch (e) {
            console.warn('sw: fetch error:', e);
            return match;
        }
    })(ev.request));
});
