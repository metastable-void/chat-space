
const BROADCAST_LOCAL_STORAGE_PREFIX = 'menhera.broadcast.';

const getBroadcastKey = (channelName) => BROADCAST_LOCAL_STORAGE_PREFIX + String(channelName).trim().toLowerCase();

const storageEventTarget = new class extends EventTarget {
    constructor() {
        super();
        window.addEventListener('storage', ev => {
            if (null === ev.key) {
                console.log('The storage was cleared');
                return;
            }
            if (!ev.newValue) {
                return;
            }
            this.dispatchEvent(ev);
        });
    }

    setItem(key, text) {
        const value = String(text);
        try {
            localStorage.setItem(key, text);
        } catch (e) {}
        const ev = new StorageEvent('storage');
        ev.initStorageEvent('storage', false, false, key, null, value, location.href, localStorage);
        this.dispatchEvent(ev);
    }
};

/**
 * Cross-platform BroadcastChannel for Window. (Not for workers)
 */
export class WindowBroadcast extends EventTarget {
    constructor(channelName) {
        super();
        Reflect.defineProperty(this, 'channelName', {value: String(channelName).trim().toLowerCase()});
        const key = getBroadcastKey(this.channelName);
        storageEventTarget.addEventListener('storage', ev => {
            if (key != ev.key) return;
            try {
                const data = JSON.parse(ev.newValue);
                const ev = new MessageEvent('message', {
                    data,
                    origin: document.origin,
                });
                this.dispatchEvent(ev);
            } catch (e) {
                console.warn(e);
            }
        });
    }

    postMessage(data) {
        try {
            const key = getBroadcastKey(this.channelName);
            const value = JSON.stringify(data);
            storageEventTarget.setItem(key, value);
        } catch (e) {
            console.warn(e);
        }
    }
}
