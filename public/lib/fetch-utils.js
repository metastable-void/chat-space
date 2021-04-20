
/* This file can be loaded as either normal script or module script. */

globalThis.normalizeUrl = (pathOrUrl) => String(new URL(pathOrUrl, location.href));

/**
 * @extends Set<string>
 */
globalThis.URLSet = class URLSet extends Set {
    /**
     * @param {Iterable<string} urls URLs to add.
     */
    constructor(urls) {
        super([... urls].map((url) => normalizeUrl(url)));
    }

    add(url) {
        return super.add(normalizeUrl(url));
    }

    delete(url) {
        return super.delete(normalizeUrl(url));
    }

    has(url) {
        return super.has(normalizeUrl(url));
    }
};

globalThis.createFreshRequest = (req) => {
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

/**
 * fetch() with explicit error Response on network errors.
 * @param {RequestInfo} input 
 * @param {RequestInit?} init?
 * @returns 
 */
globalThis.rawFetch = async (input, init) => {
    try {
        return await fetch(input, init);
    } catch (e) {
        console.error('fetch error:', e);
        return Response.error();
    }
};
