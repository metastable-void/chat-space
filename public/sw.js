
importScripts('/lib/fetch-utils.js');

const ASSETS_CACHE = 'assets-v1';
const ASSETS = new URLSet([
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
    '/lib/components-utils.mjs',
    '/lib/fetch-utils.js',
    '/components/chatspace-toast.mjs',
    '/components/chatspace-toast.css',
    '/components/chatspace-comment.mjs',
    '/components/chatspace-comment.css',
    '/components/chatspace-comment-container.mjs',
    '/components/chatspace-comment-container.css',
]);

const CURRENT_CACHES = new Set([
    ASSETS_CACHE,
]);

self.addEventListener('install', ev => {
    ev.waitUntil((async () => {
        console.log('sw: install');
        const cache = await caches.open(ASSETS_CACHE);
        const keys = await cache.keys();
        const cachedUrls = new Set;
        const promises = [];

        for (const req of keys) {
            if (!ASSETS.has(req.url)) {
                promises.push(cache.delete(req));
            } else {
                cachedUrls.add(req.url);
            }
        }

        for (const url of ASSETS) {
            if (!cachedUrls.has(url)) {
                const req = createFreshRequest(url);
                promises.push(rawFetch(req).then((res) => {
                    return cache.put(req, res);
                }));
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
                console.log('sw: Clearing unused cache:', key);
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
            if (!match.ok) {
                console.error('sw: Request failed, but we do not have a valid cached response:', request.url, e);
            } else {
                console.warn('sw: fetch error:', request.url, e);
            }
            return match;
        }
    })(ev.request));
});

self.addEventListener('notificationclick', ev => {
    ev.waitUntil((async (notification) => {
        console.log('sw: notificationclick', {
            title: notification.title,
            tag: notification.tag,
            body: notification.body,
            data: notification.data,
        });
        const data = notification.data || {};
        const url = data.url || '';
        const windowClients = await clients.matchAll({
            includeUncontrolled: true,
            type: 'window',
        });
        for (const client of windowClients) {
            if ((!url || url == client.url) && 'function' == typeof client.focus) {
                await client.focus();
                notification.close();
                break;
            }
        }
    })(ev.notification));
});

self.addEventListener('message', ev => void ev.waitUntil((async () => {
    console.log('sw: message received:', ev.data);
    const data = ev.data || {};
    switch (data.command) {
        case 'client_hello': {
            console.log(`sw: client(${ev.source.id}) = session(${data.sessionId})`);
            
            const workers = [];
            const sharedWorkers = [];
            const windows = [];

            try {
                const allClients = await clients.matchAll({
                    includeUncontrolled: true,
                    type: 'all',
                });
                
                for (const client of allClients) {
                    const clientData = {
                        id: client.id,
                        url: client.url,
                        type: client.type,
                    };
                    if (client.type == 'window') {
                        windows.push(clientData);
                    } else if (client.type == 'worker') {
                        workers.push(clientData);
                    } else if (client.type == 'sharedworker') {
                        sharedWorkers.push(clientData);
                    }
                }
            } catch (e) {}
            
            ev.source.postMessage({
                command: 'sw_hello',
                clientId: ev.source.id,
                clients: {
                    windows,
                    workers,
                    sharedWorkers,
                },
            });
            break;
        }

        default: {
            console.warn('sw: Unknown command received');
        }
    }
})()));
