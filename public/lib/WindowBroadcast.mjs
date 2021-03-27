
const LOCAL_STORAGE_PREFIX = 'menhera.broadcast.';

const getKey = (channelName) => LOCAL_STORAGE_PREFIX + String(channelName).trim().toLowerCase();

const eventTarget = new class extends EventTarget {
    constructor() {
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

    fireSelf(key, value) {
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
        Reflect.defineProperty(this, 'channelName', {value: String(channelName)});
        const key = getKey(this.channelName);
        eventTarget.addEventListener('storage', ev => {
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
            const key = getKey(this.channelName);
            const value = JSON.stringify(data);
            eventTarget.fireSelf(key, value);
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(e);
        }
    }
}
