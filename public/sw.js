
const ASSETS_CACHE = 'assets-v1';
const ASSETS = [
    '/',
    '/app.webmanifest', // en locale
    '/main.mjs',
    '/main.css',
    '/common.css',
    '/app-icon-192px.png',
    '/app-icon-256px.png',
    '/app-icon-512px.png',
    '/favicon-256px.png',
    '/fullsize-icon-256px.png',
    '/MaterialIcons-Regular.woff2',
    '/lib/Settings.mjs',
    '/lib/noble-ed25519-1.0.3.mjs',
    '/lib/x25519.mjs',
    '/lib/es-first-aid.js',
    '/lib/Provisionality.mjs',
    '/components/chatspace-comment.mjs',
    '/components/chatspace-comment.css',
    '/components/chatspace-comment-container.mjs',
    '/components/chatspace-comment-container.css',
].map(path => String(new URL(path, location.href)));

const CURRENT_CACHES = new Set([
    ASSETS_CACHE,
]);

const createFreshRequest = (req) => {
    const originalRequest = (req instanceof Request
        ? (
            req.mode == 'navigate'
            ? new Request(req.url, {
                mode: 'cors',
                credentials: 'same-origin',
            })
            : req
        )
        : new Request(req, {
            mode: 'cors',
            credentials: 'same-origin',
        })
    );

    return new Request(originalRequest, {
        mode: originalRequest.mode,
        credentials: originalRequest.credentials,
        cache: 'no-cache', // force revalidation
    });
};

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
                promises.push(cache.add(createFreshRequest(url)));
            }
        }

        await Promise.all(promises);
        return self.skipWaiting();
    })());
});

// cleanup of old cache
self.addEventListener('activate', ev => {
    ev.waitUntil((async () => {
        console.log('sw: activate');
        const keys = await caches.keys();
        await Promise.all(keys.map(async key => {
            if (!CURRENT_CACHES.has(key)) {
                console.log('Clearing unused cache:', key);
                return caches.delete(key);
            }
        }));
        await clients.claim();
    })());
});

self.addEventListener('fetch', ev => {
    ev.respondWith((async (request) => {
        const cache = await caches.open(ASSETS_CACHE);
        const match = await cache.match(request);
        const freshRequest = createFreshRequest(request);
        if (!match) {
            return await fetch(freshRequest);
        }
        try {
            const freshResponse = await fetch(freshRequest);
            if (!freshResponse.ok) {
                throw 'Non-2xx response';
            }
            await cache.put(freshRequest, freshResponse.clone());
            return freshResponse;
        } catch (e) {
            console.warn('sw: fetch error:', request.url, e);
            return match;
        }
    })(ev.request));
});

self.addEventListener('notificationclick', ev => {
    ev.waitUntil((async (notification) => {
        console.log('notificationclick', {
            title: notification.title,
            tag: notification.tag,
            body: notification.body,
            data: notification.data,
        });
        const data = notification.data || {};
        const url = data.url || '';
        const clients = await clients.matchAll({
            includeUncontrolled: true,
            type: 'window',
        });
        for (const client of clients) {
            if ((!url || url == client.url) && 'function' == typeof client.focus) {
                await client.focus();
                notification.close();
                break;
            }
        }
    })(ev.notification));
});
