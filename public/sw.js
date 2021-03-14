
self.addEventListener('install', ev => {
    ev.waitUntil((async () => {
        console.log('sw: install');
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
        return await fetch(request);
    })(ev.request));
});
