
import '/lib/es-first-aid.js';

let navigation;

const getSearchRecord = (urlString) => {
    const url = new URL(urlString, location.href);
    const params = url.searchParams;
    params.sort();
    const record = Object.create(null);
    const keys = new Set(params.keys());
    for (const key of keys) {
        const value = params.get(key) || '';
        if ('' === value) continue;
        record[key] = value;
    }
    return record;
};

const setUrlState = (value) => {
    const url = new URL(value || location.href, location.href);
    if (url.origin != window.origin || 'null' == window.origin) {
        throw new Error('Not same-origin');
    }
    if (!url.hash) {
        url.hash = '';
    }
    const record = getSearchRecord(url);
    const params = new URLSearchParams(record);
    url.search = params.toString();
    const urlString = url.toString();
    
    if (location.href != urlString) {
        history.replaceState({}, '', urlString);
    }
};

export class Navigation extends EventTarget {
    constructor() {
        if (navigation) {
            return navigation;
        }

        super();
        navigation = this;
        setUrlState(location.href);
        window.addEventListener('hashchange', (ev) => {
            setUrlState(location.href);
            this.dispatchEvent(new Event('navigation'));
        });
        window.addEventListener('popstate', (ev) => {
            setUrlState(location.href);
            this.dispatchEvent(new Event('navigation'));
        });
        setTimeout(() => {
            this.dispatchEvent(new Event('navigation'));
        }, 0);
    }

    get hash() {
        return decodeURIComponent(location.hash.slice(1));
    }

    set hash(value) {
        const url = new URL(location.href);
        const hash = encodeURIComponent(value);
        if (!hash) {
            url.hash = '';
        } else {
            url.hash = '#' + hash;
        }
        setUrlState(url);
        this.dispatchEvent(new Event('navigation'));
    }

    getParams() {
        return getSearchRecord(location.href);
    }

    setParams(record) {
        const params = new URLSearchParams(record);
        const url = new URL(location.href);
        url.search = params.toString();
        setUrlState(url);
        this.dispatchEvent(new Event('navigation'));
    }
}
