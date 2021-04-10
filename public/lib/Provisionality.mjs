
/**
 * Menhera Provisionality -- minimal Web frontend framework
 * Copyright (C) 2021 Menhera.org
 * https://github.com/menhera-org/Provisionality
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * @file
 */


import './es-first-aid.js';


const STORAGE_KEY_SESSION_ID = 'menhera.session_id';
const STORAGE_KEY_CLIENT_ID = 'menhera.client_id';
const STORAGE_KEY_BROADCAST = 'menhera.broadcast';
const SESSION_ID_GLOBAL = '00000000-0000-0000-0000-000000000000'; // Means client-global.
const STORAGE_PREFIX_SESSION = 'menhera.storage.by_session';


/**
 * 
 * @param callback {function}
 * @param args {any[]}
 */
const callAsync = (callback, ... args) => {
    Promise.resolve()
    .then(() => callback(... args))
    .catch(e => console.error(e));
};


let clientIdCache = null;

/**
 * 
 * @returns {string}
 */
const getClientId = () => {
    if (clientIdCache) return clientIdCache;
    try {
        const clientId = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
        if (!clientId) throw void 0;
        clientIdCache = clientId;
        return clientId;
    } catch (e) {}
    
    const clientId = firstAid.getRandomUuid();
    clientIdCache = clientId;
    try {
        localStorage.setItem(STORAGE_KEY_CLIENT_ID, clientId);
    } finally {
        return clientId;
    }
};

let sessionIdCache = null;

/**
 * 
 * @returns {string}
 */
const getSessionId = () => {
    if (sessionIdCache) return sessionIdCache;
    try {
        const sessionId = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
        if (!sessionId) throw void 0;
        sessionIdCache = sessionId;
        return sessionId;
    } catch (e) {}

    const sessionId = firstAid.getRandomUuid();
    sessionIdCache = sessionId;
    try {
        sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
    } finally {
        return sessionId;
    }
};

class CompatBroadcastChannel extends EventTarget {
    constructor(channelName) {
        super();

        if ('string' != typeof channelName) {
            throw new TypeError('Invalid channel name');
        }

        this.channelName = String(channelName).trim().toLowerCase();
        if (!this.channelName) {
            throw new TypeError('Empty channel name');
        }

        window.addEventListener('storage', ev => {
            if (null === ev.key) {
                console.log('The storage was cleared');
                return;
            }
            if (STORAGE_KEY_BROADCAST != ev.key) {
                return;
            }
            if (!ev.newValue) {
                return;
            }

            const {channelName, data} = JSON.parse(ev.newValue);
            if (channelName != this.channelName) {
                return;
            }
            const messageEvent = new MessageEvent('message', {
                data,
                origin: document.origin,
            });
            this.dispatchEvent(messageEvent);
        });
    }

    postMessage(data) {
        const value = JSON.stringify({
            channelName: this.channelName,
            data,
        });
        try {
            localStorage.setItem(STORAGE_KEY_BROADCAST, value);
        } finally {
            const {data} = JSON.parse(value);
            const messageEvent = new MessageEvent('message', {
                data,
                origin: document.origin,
            });
            this.dispatchEvent(messageEvent);
        }
    }
}

export class StorageImplementation {
    constructor(sessionId) {
        super();
        this.sessionId = String(sessionId || getSessionId()).toLowerCase();
        this.storageKey = `${STORAGE_PREFIX_SESSION}.${this.sessionId}`;
        this.cachedValues = {};
        this.storage = this.sessionId == SESSION_ID_GLOBAL ? localStorage : sessionStorage;
        this.broadcastChannel = new CompatBroadcastChannel(this.storageKey);
        this.observersMap = new Map;
    }

    getAll() {
        try {
            const json = this.storage.getItem(this.storageKey);
            if (!json) throw void 0;
            return JSON.parse(json) || {};
        } catch (e) {
            return this.cachedValues;
        }
    }

    /**
     * 
     * @param values {object?}
     */
    save(values) {
        const json = JSON.stringify(values || this.cachedValues);
        try {
            this.storage.setItem(this.storageKey, json);
        } finally {
            this.cachedValues = JSON.parse(json);
        }
    }

    has(key) {
        const stringKey = String(key).trim().toLowerCase();
        const values = this.getAll();
        return Object.getOwnPropertyNames(values).includes(stringKey);
    }

    get(key) {
        if (!this.has(key)) {
            return null;
        }
        const stringKey = String(key).trim().toLowerCase();
        const values = this.getAll();
        return values[stringKey];
    }

    set(key, value) {
        const stringKey = String(key).trim().toLowerCase();
        const values = this.getAll();
        if (!value) {
            delete values[stringKey];
        } else {
            values[stringKey] = value;
        }
        this.save(values);
        this.broadcastChannel.postMessage({key: stringKey});
    }

    addObserver(key, callback) {
        const stringKey = String(key).toLowerCase();
        if ('function' != typeof callback) {
            throw new TypeError('Not a function');
        }
        const listener = ({data}) => {
            const {key} = data;
            if (stringKey != key) return;
            callback(this.get(stringKey));
        };
        if (!this.observersMap.has(stringKey)) {
            this.observersMap.set(stringKey, new WeakMap);
        }
        this.observersMap.get(stringKey).set(callback, listener);
        this.broadcastChannel.addEventListener('message', listener);
        callAsync(() => callback(this.get(stringKey)));
    }

    removeObserver(key, callback) {
        const stringKey = String(key).toLowerCase();
        if ('function' != typeof callback) {
            throw new TypeError('Not a function');
        }
        if (!this.observersMap.has(stringKey)) {
            return;
        }
        if (!this.observersMap.get(stringKey).has(callback)) {
            return;
        }
        const listener = this.observersMap.get(stringKey).get(callback);
        this.broadcastChannel.removeEventListener('message', listener);
    }
}

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

    postMessage(data, targetSession) {
        const sessionId = getSessionId();
        const clientId = getClientId();
        const metadata = {
            clientId,
            sessionId,
            createdTime: +new Date,
            origin: document.origin,
        };
        const value = JSON.stringify({metadata, data});
        storageEventTarget.setItem(this.storageKey, value);
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
 * @typedef {({clientId: string, sessionId: string, topicName: string, createdTime: number, origin: string})} TopicMetadata
 */

const topicBroadcasts = new CompatBroadcastChannel('menhera.topics');

const topicListenerMap = new WeakMap;
export class Topic {
    /**
     * 
     * @param topicName {string}
     * @param sessionId {string?} Client-broadcast if omitted
     */
    constructor(topicName, sessionId) {
        if ('string' != typeof topicName) {
            throw new TypeError('Invalid topic name');
        }
        this.topicName = String(topicName).trim().toLowerCase();
        if (!this.topicName) {
            throw new TypeError('Empty topic name');
        }
        this.sessionId = String(sessionId || SESSION_ID_GLOBAL);
    }

    /**
     * 
     * @param listener {(data: *, metadata: TopicMetadata) => Promise<void>}
     */
    addListener(listener) {
        if ('function' != typeof listener) {
            throw new TypeError('Not a function');
        }
        const realListener = (ev) => {
            const {sessionId, topicName, metadata, data} = ev.data;
            if (sessionId != this.sessionId) return;
            if (topicName != this.topicName) return;
            listener(data, metadata);
        };
        topicListenerMap.set(listener, realListener);
        topicBroadcasts.addEventListener('message', realListener);
    }

    /**
     * 
     * @param listener {(data: *, metadata: TopicMetadata) => Promise<void>}
     */
    removeListener(listener) {
        if ('function' != typeof listener) {
            throw new TypeError('Not a function');
        }
        if (!topicListenerMap.has(listener)) return;
        topicBroadcasts.removeEventListener('message', topicListenerMap.get(listener));
    }

    /**
     * 
     * @param data {*}
     */
    dispatchMessage(data) {
        const sessionId = getSessionId();
        const clientId = getClientId();
        const metadata = {
            clientId,
            sessionId,
            topicName: this.topicName,
            createdTime: +new Date,
            origin: document.origin,
        };
        topicBroadcasts.postMessage({
            sessionId: this.sessionId,
            topicName: this.topicName,
            metadata,
            data,
        });
    }
}

const stateImplementationMap = new WeakMap;
export class State {
    /**
     * 
     * @param implementation {StorageImplementation?}
     */
    constructor(implementation) {
        if (!implementation) {
            implementation = new StorageImplementation;
        }
        stateImplementationMap.set(this, implementation);
    }

    get(propertyName) {
        const implementation = stateImplementationMap.get(this);
        return implementation.get(propertyName);
    }

    addPropertyObserver(propertyName, callback) {
        const implementation = stateImplementationMap.get(this);
        implementation.addObserver(propertyName, callback);
    }

    removePropertyObserver(propertyName, callback) {
        const implementation = stateImplementationMap.get(this);
        implementation.removeObserver(propertyName, callback);
    }

    /**
     * Add a Reflector from a Topic.
     * @param topic {Topic}
     * @param topicReflector {(data: *, metadata: TopicMetadata) => Promise<Map<string, *>>}
     */
    addTopicReflector(topic, topicReflector) {
        if ('function' != typeof topicReflector) {
            throw new TypeError('Not a function');
        }
        const implementation = stateImplementationMap.get(this);
        topic.addListener(async (data, metadata) => {
            const change = new Map((await topicReflector(data, metadata)) || []);
            for (const [propertyName, newValue] of change) {
                implementation.set(propertyName, newValue);
            }
        });
    }
}

export class Session {
    constructor(sessionId) {
        this.id = String(sessionId || getSessionId());
        const storageImplementation = new StorageImplementation(this.id);
        this.state = new State(storageImplementation);
    }

    getTopic(topicName) {
        return new Topic(topicName, this.id);
    }
}

export class Client {
    constructor() {
        this.id = getClientId();
        const storageImplementation = new StorageImplementation(SESSION_ID_GLOBAL);
        this.state = new State(storageImplementation);
    }

    getTopic(topicName) {
        return new Topic(topicName, SESSION_ID_GLOBAL);
    }
}

globalThis.menhera = {
    sessionId: getSessionId(),
    clientId: getClientId(),
    session: new Session,
    client: new Client,
};
