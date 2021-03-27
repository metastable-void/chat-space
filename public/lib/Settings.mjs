
const LOCAL_STORAGE_PREFIX = 'menhera.chatspace.';
const LOCAL_STORAGE_PRIVATE_KEY = `${LOCAL_STORAGE_PREFIX}.private_key`;
const LOCAL_STORAGE_USERNAME = `${LOCAL_STORAGE_PREFIX}.self.name`;
const LOCAL_STORAGE_VISIT_COUNT = `${LOCAL_STORAGE_PREFIX}.visit_count`;
const LOCAL_STORAGE_VISITED_ROOMS = `${LOCAL_STORAGE_PREFIX}.visited_rooms`;

const legacyMap = {
    'privateKey': 'private_key',
    'userName': 'self.name',
    'visitCount': 'visit_count',
    'visitedRooms': 'visited_rooms',
};

const inverseLegacyMap = {};
for (const key of Reflect.ownKeys(legacyMap)) {
    inverseLegacyMap[legacyMap[key]] = key;
}

const isLocalStorageAvailable = () => {
    try {
        const randomId = uuidUtils.random();
        localStorage.setItem(randomId, 'test');
        const availability = 'test' === localStorage.getItem(randomId);
        localStorage.removeItem(randomId);
        return availability;
    } catch (e) {
        return false;
    }
};

export class Settings extends EventTarget {
    constructor() {
        super();
        try {
            if (!isLocalStorageAvailable()) {
                console.warn('LocalStorage is not available.');
            } else {
                console.log(`LocalStorage has ${localStorage.length} key(s).`);
            }
        } catch (e) {}

        window.addEventListener('storage', ev => {
            if (!ev.key) return;
            if (!ev.key.startsWith(LOCAL_STORAGE_PREFIX)) return;
            let key = ev.key.slice(LOCAL_STORAGE_PREFIX.length).toLowerCase();
            if (key in inverseLegacyMap) key = inverseLegacyMap[key];
            ev = new StorageEvent('settingschange');
            ev.initStorageEvent('settingschange', false, false, key);
            this.dispatchEvent(ev);
        });

        return new Proxy(this, {
            get(target, key) {
                if (key in target) {
                    return target[key];
                }
                return target.get(key);
            },

            set(target, key, value) {
                if (key in target) {
                    return false;
                }
                target.set(key, value);
                return true;
            },

            has(target, key) {
                return target.has(key);
            },
        });
    }

    static getLocalStorageKey(key) {
        const stringKey = (key in legacyMap) ? String(legacyMap[key]) : String(key);
        return LOCAL_STORAGE_PREFIX + stringKey.toLowerCase();
    }

    set(key, value) {
        const storageKey = Settings.getLocalStorageKey(key);
        try {
            const rawValue = JSON.stringify(value);
            localStorage.setItem(storageKey, rawValue);
            return true;
        } catch (e) {
            return false;
        }
    }

    get(key) {
        const storageKey = Settings.getLocalStorageKey(key);
        const rawValue = localStorage.getItem(storageKey) || '';
        if (!rawValue) {
            return void 0;
        }
        try {
            return JSON.parse(rawValue);
        } catch (e) {
            console.warn(`Settings data failed to parse as JSON for key '${key}':`, e);
            try {
                localStorage.setItem(storageKey, JSON.stringify(rawValue));
            } catch (e) {}
            return rawValue;
        }
    }

    has(key) {
        const storageKey = Settings.getLocalStorageKey(key);
        try {
            const rawValue = localStorage.getItem(storageKey) || '';
            if (!rawValue) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }
}
