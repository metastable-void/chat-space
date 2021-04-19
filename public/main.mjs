
import * as ed from '/lib/noble-ed25519-1.0.3.mjs';
import * as x25519 from '/lib/x25519.mjs';
import {Settings} from '/lib/Settings.mjs';
import '/components/chatspace-comment.mjs';
import '/components/chatspace-comment-container.mjs';
import '/lib/es-first-aid.js';
import '/lib/Provisionality.mjs';

const VISITED_ROOMS_LIST_LENGTH = 10;
const HISTORY_BUFFER_LENGTH = 10;

/** @type {ServiceWorkerRegistration} */
let serviceWorkerRegistration;

/** @type {ServiceWorker} */
let activeServiceWorker;

let swClientId;

// watchdog
let scriptCompleted = false;
window.addEventListener('error', ev => {
    if (!scriptCompleted) {
        setTimeout(() => location.reload(), 10000);
    }
});

/** @param {ServiceWorker} sw */
const newServiceWorkerCallback = (sw) => {
    if (sw == activeServiceWorker) return;
    activeServiceWorker = sw;
    console.log('New ServiceWorker:', sw);
    sw.postMessage({
        command: 'client_hello',
        sessionId: menhera.session.id,
    });
};

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).then(reg => {
        console.log('ServiceWorker registered:', reg);
        serviceWorkerRegistration = reg;
    }).catch(e => {
        console.error('ServiceWorker registration failed:', e);
    });
    navigator.serviceWorker.ready.then(reg => {
        if (!reg.active) return;
        newServiceWorkerCallback(reg.active);
    });
    navigator.serviceWorker.addEventListener('controllerchange', ev => {
        if (!navigator.serviceWorker.controller) return;
        newServiceWorkerCallback(navigator.serviceWorker.controller);
    });
    navigator.serviceWorker.addEventListener('message', ev => {
        const data = ev.data || {};
        console.log('Message received from ServiceWorker:', ev.source);
        switch (data.command) {
            case 'sw_hello': {
                swClientId = data.clientId;
                console.log(`Learned: my clientId=${swClientId}`);
                console.log('Current ServiceWorker clients:', data.clients);
                break;
            }

            default: {
                console.warn('Unknown command received');
            }
        }
    });
}

if (location.pathname.endsWith('/index.html')) {
    const url = new URL(location.href);
    url.pathname = url.pathname.slice(0, -10);
    history.replaceState({}, '', String(url));
}

if (location.hash.slice(1) == '' && location.href.endsWith('#')) {
    const url = new URL(location.href);
    url.hash = '';
    history.replaceState({}, '', String(url));
}

const settings = new Settings;

menhera.client.state.addTopicReflector(menhera.session.getTopic('chatspace.legacy.saveFriends'), (data, metadata) => {
    let friends = settings.friends;
    if (!friends) return [];
    return Object.entries({
        friends: friends,
    });
});

if (!menhera.client.state.get('friends')) {
    menhera.session.getTopic('chatspace.legacy.saveFriends').dispatchMessage(null);
}

const textBox = document.querySelector('#text');

/**
 * @type {HTMLInputElement}
*/
const nameBox = document.querySelector('#name');

/**
 * @type {HTMLInputElement}
 * */
const tokenBox = document.querySelector('#token');

const identityBox = document.querySelector('#identity');

const randomButton = document.querySelector('#random');
const clearButton = document.querySelector('#clear');
const helpButton = document.querySelector('#help');
const helpCloseButton = document.querySelector('#help-close-button');
const settingsButton = document.querySelector('#settings-button');
const settingsCloseButton = document.querySelector('#settings-close-button')
const inviteAcceptButton = document.querySelector('#invite-accept-button');
const inviteIgnoreButton = document.querySelector('#invite-ignore-button');
const privateKeyRegenerateButton = document.querySelector('#private-key-regenerate-button');
const settingsReloadButton = document.querySelector('#settings-reload-button');
const askPersistenceButton = document.querySelector('#ask-persistence-button');
const drawerOpenButton = document.querySelector('#drawer-open-button');
const drawerCloseButton = document.querySelector('#drawer-close-button');
const drawerBackdrop = document.querySelector('#drawer-backdrop');

const connectionStatus = document.querySelector('#connection');
const mainBox = document.querySelector('#main');
const commentsBox = mainBox.appendChild(document.createElement('chatspace-comment-container'));

const overlayBox = document.querySelector('#overlay');
const helpBox = document.querySelector('#helpBox');
const tokenListContainer = document.querySelector('#token-list');
const settingsBox = document.querySelector('#settingsBox');
const inviteBox = document.querySelector('#inviteBox');
const invitePeerNameBox = document.querySelector('#invitePeerName');
const invitePeerFingerprintBox = document.querySelector('#invitePeerFingerprint');

/** @type {HTMLInputElement} */
const privateKeyBox = document.querySelector('#private-key');

/** @type {HTMLInputElement} */
const myFingerprintBox = document.querySelector('#my-fingerprint');

/** @type {HTMLTextAreaElement} */
const userAgentBox = document.querySelector('#user-agent');
userAgentBox.value = navigator.userAgent;

const logotypeBox = document.querySelector('#logotype');

/** @type {HTMLInputElement} */
const storageUsageBox = document.querySelector('#storage-usage');
storageUsageBox.value = '-- %';

/** @type {HTMLInputElement} */
const notificationPermissionBox = document.querySelector('#notification-permission');
notificationPermissionBox.value = '--';

try {
    document.querySelector('#client-id').value = menhera.client.id;
    document.querySelector('#session-id').value = menhera.session.id;
} catch (e) {
    console.error(e);
}


menhera.session.state.addPropertyObserver('chatspace.drawer.shown', (drawerShown) => {
    if (drawerShown) {
        document.body.classList.remove('drawer-collapsed');
    } else {
        document.body.classList.add('drawer-collapsed');
    }
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.showDrawer'), (data, metadata) => {
    return Object.entries({
        'chatspace.drawer.shown': true,
    });
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.hideDrawer'), (data, metadata) => {
    return Object.entries({
        'chatspace.drawer.shown': false,
    });
});

drawerBackdrop.addEventListener('click', ev => {
    menhera.session.triggerTopic('chatspace.hideDrawer');
});

drawerCloseButton.addEventListener('click', ev => {
    menhera.session.triggerTopic('chatspace.hideDrawer');
});

drawerOpenButton.addEventListener('click', ev => {
    const drawerShown = menhera.session.state.get('chatspace.drawer.shown');
    if (drawerShown) {
        menhera.session.triggerTopic('chatspace.hideDrawer');
    } else {
        menhera.session.triggerTopic('chatspace.showDrawer');
    }
});

menhera.session.state.addPropertyObserver('chatspace.modal.shown', (shownModal) => {
    for (const box of overlayBox.children) {
        box.hidden = true;
    }
    switch (shownModal) {
        case 'help': {
            overlayBox.hidden = false;
            helpBox.hidden = false;
            break;
        }

        case 'settings': {
            overlayBox.hidden = false;
            settingsBox.hidden = false;
            break;
        }

        case 'invite': {
            overlayBox.hidden = false;
            inviteBox.hidden = false;
            break;
        }

        default: {
            overlayBox.hidden = true;
        }
    }
});

menhera.session.state.addPropertyObserver('chatspace.modal.invite.peer_fingerprint', (peerFingerprint) => {
    invitePeerFingerprintBox.title = peerFingerprint;
});

menhera.session.state.addPropertyObserver('chatspace.modal.invite.peer_short_fingerprint', (shortFingerprint) => {
    invitePeerFingerprintBox.textContent = shortFingerprint;
});

menhera.session.state.addPropertyObserver('chatspace.modal.invite.peer_name', (peerName) => {
    invitePeerNameBox.textContent = peerName;
});

menhera.session.state.addPropertyObserver('chatspace.modal.storagePercent', (storagePercent) => {
    if (!storagePercent) return;
    storageUsageBox.value = storagePercent + ' %';
});

menhera.session.state.addPropertyObserver('chatspace.modal.notificationPermission', (notificationPermission) => {
    if (!notificationPermission) return;
    notificationPermissionBox.value = notificationPermission;
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.showInvite'), (data, metadata) => {
    const {peerName, peerFingerprint, token} = data;
    const peerShortFingerprint = peerFingerprint.slice(0, 8);
    return Object.entries({
        'chatspace.modal.invite.peer_fingerprint': peerFingerprint,
        'chatspace.modal.invite.peer_short_fingerprint': peerShortFingerprint,
        'chatspace.modal.invite.peer_name': peerName,
        'chatspace.modal.invite.token': token,
        'chatspace.modal.shown': 'invite',
    });
});

menhera.session.getTopic('chatspace.acceptInvite').addListener((data, metadata) => {
    menhera.session.getTopic('chatspace.hideModals').dispatchMessage(null);
    menhera.session.getTopic('chatspace.openRoom').dispatchMessage({
        token: menhera.session.state.get('chatspace.modal.invite.token'),
    });
});

menhera.client.state.addTopicReflector(menhera.session.getTopic('chatspace.askPersistence'), async (data, metadata) => {
    if (!navigator.storage || 'function' != typeof navigator.storage.persist) {
        console.warn('Persistent storage not supported');
        return [];
    }

    let persisted = false;
    try {
        if (await navigator.storage.persisted()) {
            persisted = true;
            console.log('Persistent storage already granted');
        } else {
            persisted = await navigator.storage.persist();
            if (persisted) {
                console.log('Persistent storage just granted');
            }
        }
    } catch (e) {}
    
    if (!persisted) {
        console.log('Persistent storage not available');
    }

    return Object.entries({
        'persistenceDenied': !persisted,
    });
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.hideModals'), async (data, metadata) => {
    if (!menhera.client.state.get('persistenceDenied')) {
        menhera.session.triggerTopic('chatspace.askPersistence');
    }

    menhera.session.triggerTopic('chatspace.requestNotification');
    
    return Object.entries({
        'chatspace.modal.shown': null,
    });
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.showHelp'), (data, metadata) => {
    return Object.entries({
        'chatspace.modal.shown': 'help',
    });
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.showSettings'), (data, metadata) => {
    return Object.entries({
        'chatspace.modal.shown': 'settings',
    });
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.updatePermissionStats'), async (data, metadata) => {
    let storagePercent = '--';
    let notificationPermission = 'Disabled';
    try {
        const estimate = await navigator.storage.estimate();
        storagePercent = (estimate.usage / estimate.quota).toFixed(2);
    } catch (e) {}
    try {
        if (Notification.permission == 'granted') {
            notificationPermission = 'Enabled';
        } else if (Notification.permission == 'denied') {
            notificationPermission = 'Denied';
        }
    } catch (e) {}
    return Object.entries({
        'chatspace.modal.notificationPermission': notificationPermission,
        'chatspace.modal.storagePercent': storagePercent,
    });
});

menhera.session.getTopic('chatspace.requestNotification').addListener(async (data, metadata) => {
    if (!window.Notification) {
        console.warn('Notification not supported');
    } else if (Notification.permission == 'granted') {
        console.log('Notification already granted');
    } else if (Notification.permission == 'denied') {
        console.log('Notification already denied by user');
    } else {
        const permission = await Notification.requestPermission();
        if (permission == 'granted') {
            const notification = new Notification('Notification enabled!', {
                body: 'You are in full control of which notification is shown.',
                requireInteraction: false,
            });
        } else if (permission == 'denied') {
            console.log('Notification just denied by user');
        }
    }
});

setInterval(() => menhera.session.triggerTopic('chatspace.updatePermissionStats'), 3000);

inviteAcceptButton.addEventListener('click', ev => {
    menhera.session.getTopic('chatspace.acceptInvite').dispatchMessage(null);
});

askPersistenceButton.addEventListener('click', ev => menhera.session.triggerTopic('chatspace.askPersistence'));


const getFingerprint = async bytes => {
    const buffer = await crypto.subtle.digest('SHA-256', bytes.slice(0).buffer);
    return new Uint8Array(buffer);
};


/**
 * 
 * @param obj {any}
 * @returns {Uint8Array}
 */
const encodeObject = obj => firstAid.encodeString(JSON.stringify(obj));

/**
 * Decode object from bytes.
 * @param bytes {Uint8Array}
 * @returns {any}
 */
const decodeObject = bytes => JSON.parse(firstAid.decodeString(bytes));

/**
 * Get 32-bit fingerprint representation (not much secure) of the given data.
 * @param bytes {Uint8Array}
 * @returns {string}
 */
const getShortFingerprint = bytes => firstAid.encodeHex(bytes.subarray(0, 4));

const deriveKey = async (keyBytes) => {
    const rawKey = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({
        name: 'HKDF',
        hash: 'SHA-256',
        info: new ArrayBuffer(0),
        salt: new ArrayBuffer(0)
    }, rawKey, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
};

const encrypt = async (dataBytes, keyBytes) => {
    const key = await deriveKey(keyBytes);
    const iv = firstAid.randomFill(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, dataBytes);
    return {
        algo: 'AES-GCM',
        ciphertext: firstAid.encodeBase64(ciphertext),
        iv: firstAid.encodeBase64(iv),
    };
};

const decrypt = async (dataObj, keyBytes) => {
    if ('AES-GCM' != dataObj.algo) {
        throw new TypeError('Unknown algorithm');
    }
    const key = await deriveKey(keyBytes);
    const iv = firstAid.decodeBase64(dataObj.iv);
    const ciphertext = firstAid.decodeBase64(dataObj.ciphertext);
    const resultBuffer = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, ciphertext);
    return new Uint8Array(resultBuffer);
};

const edSign = async (data, privateKey) => {
    const digestBuffer = await crypto.subtle.digest('SHA-256', data.slice(0).buffer);
    const digest = new Uint8Array(digestBuffer);
    const signature = await ed.sign(digest, privateKey);
    const publicKey = await ed.getPublicKey(privateKey);
    return {
        algo: 'sign-ed25519',
        data: firstAid.encodeBase64(data),
        publicKey: firstAid.encodeBase64(publicKey),
        signature: firstAid.encodeBase64(signature),
    };
};

const edVerify = async (dataObj) => {
    if ('sign-ed25519' != dataObj.algo) {
        throw new TypeError('Unknown algorithm');
    }
    const data = firstAid.decodeBase64(dataObj.data);
    const digestBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const digest = new Uint8Array(digestBuffer);
    const publicKey = firstAid.decodeBase64(dataObj.publicKey);
    const signature = firstAid.decodeBase64(dataObj.signature);
    if (!await ed.verify(signature, digest, publicKey)) {
        throw new TypeError('Broken signature!');
    }
    return data;
};

const x25519Generate = () => {
    const seed = new Uint8Array(32);
    firstAid.randomFill(seed);
    const keyPair = x25519.generateKeyPair(seed);
    return {
        privateKey: new Uint8Array(keyPair.private.buffer, keyPair.private.byteOffset, keyPair.private.byteLength),
        publicKey: new Uint8Array(keyPair.public.buffer, keyPair.public.byteOffset, keyPair.public.byteLength),
    };
};

const getX25519SharedUuid = async (privateKey, publicKey) => {
    const sharedSecret = x25519.sharedKey(privateKey, publicKey);
    const seed = await getFingerprint(sharedSecret);
    return firstAid.getUuidFromBytes(seed);
};

const getTime = () => +new Date;

const getToken = () => decodeURIComponent(location.hash.slice(1));
const setToken = (token) => {
    const hash = encodeURIComponent(token);
    if (!hash && '' != location.hash) {
        location.hash = '';
    } else if (location.hash.slice(1) != hash) {
        location.hash = '#' + hash;
    }
};

menhera.session.getTopic('chatspace.openRoom').addListener((data, metadata) => {
    const {token} = data;
    setToken(token);
});

const getMyKeys = async () => {
    /** @type {Uint8Array} */
    let privateKey;

    /** @type {Uint8Array} */
    let publicKey;

    let fingerprint;
    try {
        const base64PrivateKey = settings.privateKey;
        if (!base64PrivateKey) throw void 0;
        privateKey = firstAid.decodeBase64(base64PrivateKey);
        publicKey = await ed.getPublicKey(privateKey);
        fingerprint = await getFingerprint(publicKey);
        console.log('My pubkey restored');
    } catch (e) {
        console.log('Failed to restore pubkey, generating...');
        privateKey = ed.utils.randomPrivateKey();
        publicKey = await ed.getPublicKey(privateKey);
        fingerprint = await getFingerprint(publicKey);
        const base64PrivateKey = firstAid.encodeBase64(privateKey);
        settings.privateKey = base64PrivateKey;
    }
    const shortFingerprint = getShortFingerprint(fingerprint);
    return {privateKey, publicKey, fingerprint, shortFingerprint};
};

let myKeys;
const setMyKeys = async (base64PrivateKey) => {
    try {
        const privateKey = firstAid.decodeBase64(String(base64PrivateKey).trim());
        if (32 != privateKey.length) throw void 0;
        const publicKey = await ed.getPublicKey(privateKey);
        const fingerprint = await getFingerprint(publicKey);
        const shortFingerprint = getShortFingerprint(fingerprint);
        myKeys = {privateKey, publicKey, fingerprint, shortFingerprint};
        settings.privateKey = base64PrivateKey;
        const hexFingerprint = firstAid.encodeHex(fingerprint);
        myFingerprintBox.value = hexFingerprint;
        identityBox.title = hexFingerprint;
        identityBox.textContent = hexFingerprint.substr(0, 8);
    } catch (e) {
        console.warn('Invalid private key: not set');
    }
};

const getVisitCount = () => {
    let count = 0;
    try {
        count = 0 | settings.visitCount;
    } catch (e) {
        console.warn(e);
    }
    return count;
};

const getLastVisitedRooms = async () => {
    // intentionally async for future expansion
    try {
        const rooms = settings.visitedRooms;
        if (!Array.isArray(rooms)) {
            throw void 0;
        }
        return rooms.map(room => String(room));
    } catch (e) {
        return [];
    }
};

const addVisitedRoom = async (token) => {
    if (!token) return;
    const rooms = new Set(await getLastVisitedRooms());
    rooms.delete(token);
    rooms.add(token);
    settings.visitedRooms = [... rooms].slice(- VISITED_ROOMS_LIST_LENGTH);
};

try {
    const prevCount = getVisitCount();
    settings.visitCount = prevCount + 1;
    console.log (`Visited ${prevCount} time(s) before.`);
} catch (e) {
    console.warn(e);
}

getMyKeys().then(keys => {
    myKeys = keys;
    const fingerprint = firstAid.encodeHex(keys.fingerprint);
    identityBox.title = fingerprint;
    identityBox.textContent = fingerprint.substr(0, 8);
    myFingerprintBox.value = fingerprint;
    privateKeyBox.value = firstAid.encodeBase64(myKeys.privateKey);
});

let lastUpdate = 0;

let wsUrl;

const setWsUrl = (channel) => {
    const url = new URL('/ws/' + encodeURIComponent(channel || ''), location.href);
    url.protocol = 'https:' == location.protocol ? 'wss:' : 'ws:';
    wsUrl = String(url);
};

try {
    const name = settings.userName;
    if (!name) throw void 0;
    console.log('Name restored.');
    nameBox.value = name;
} catch (e) {
    console.log('Name not restored.');
}

const saveUsername = () => {
    try {
        settings.userName = nameBox.value;
    } catch (e) {
        console.warn('Failed to save your name:', e);
    }
};

const openRandomRoom = () => {
    console.log('openRandomRoom');
    const token = firstAid.getRandomUuid();
    setToken(token);
};

/**
 * @type {WebSocket?}
 * */
let ws;

const showReadyState = readyState => {
    switch (readyState) {
        case WebSocket.CONNECTING:
            return 'CONNECTING';
        case WebSocket.OPEN:
            return 'OPEN';
        case WebSocket.CLOSING:
            return 'CLOSING';
        case WebSocket.CLOSED:
            return 'CLOSED';
        default:
            return 'UNKNOWN';
    }
};

const updateStatus = () => {
    const status = showReadyState(ws.readyState);
    console.log('readyState:', status);
    connectionStatus.dataset.status = status;
    connectionStatus.title = status;
};

const getChannelKey = () => {
    const token = getToken();
    return firstAid.encodeString(`channel_key_${token}`);
};

const sendMessage = data => {
    if (ws.readyState == WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        return true;
    } else {
        return false;
    }
};

const sendCommand = (command, data) => {
    data.command = command;
    data.time = getTime();
    data.isActive = !document.hidden;
    data.sessionId = menhera.session.id;
    const bytes = encodeObject(data);
    const channelKey = getChannelKey();

    (async () => {
        try {
            const encryptedObj = await encrypt(bytes, channelKey);
            const encrypted = encodeObject(encryptedObj);
            if (!myKeys) {
                throw new Error('My keys not found');
            }
            const signedObj = await edSign(encrypted, myKeys.privateKey);
            sendMessage(signedObj);
        } catch (e) {
            console.error(e);
        }
    })().catch(e => {
        console.error(e);
    });
};

const isTextBoxFocused = () => document.activeElement == textBox;

const getCaretOffset = () => {
    if (!isTextBoxFocused()) {
        return -1;
    }
    const selection = document.getSelection();

    /** @type {Node} */
    let node = selection.focusNode;

    let offset = selection.focusOffset;
    while (true) {
        if (node.isSameNode(textBox)) {
            break;
        }
        while (true) {
            const prevNode = node.previousSibling;
            if (!prevNode) {
                break;
            }
            node = prevNode;
            if (node.nodeType == document.COMMENT_NODE) {
                continue;
            }
            if (node.textContent !== null) {
                offset += node.textContent.length;
            }
        }
        
        node = node.parentElement;
        if (!node) {
            offset = -1;
            break;
        }
    }
    return offset;
};

const getMyName = () => nameBox.value.trim();

const historyBuffer = [];
let previousText = '';
const sendUpdate = (force) => {
    if (textBox.textContent.includes('\n')) {
        textBox.textContent = textBox.textContent.split('\n').join('').split('\r').join('');
    }
    const text = textBox.textContent;
    if ('' === text) {
        // make sure placeholder is shown
        textBox.textContent = '';
    }
    const name = getMyName();
    if (text == previousText && !force) return;
    previousText = text;
    lastUpdate = getTime();
    const offset = getCaretOffset();

    if (text.length < 1) {
        sendCommand('text_cleared', {
            text: '',
            name,
            caretOffset: offset,
        });
    } else {
        sendCommand('text_updated', {
            text,
            name,
            caretOffset: offset,
        });
    }
};

const commit = () => {
    textBox.textContent = '';
    const name = getMyName();
    const offset = getCaretOffset();
    if (previousText == '') return;
    lastUpdate = getTime();
    historyBuffer.push(previousText);
    while (historyBuffer.length > HISTORY_BUFFER_LENGTH) {
        historyBuffer.shift();
    }
    previousText = '';
    sendCommand('text_cleared', {
        text: '',
        name,
        caretOffset: offset,
    });
};

const historyBack = () => {
    if (historyBuffer.length < 1) return;
    const text = historyBuffer.pop();
    textBox.textContent = text;
    const name = getMyName();
    const offset = getCaretOffset();
    previousText = text;
    sendCommand('text_updated', {
        text,
        name,
        caretOffset: offset,
    });
};

// outgoing offers
const keyExchangeStates = new Map;

menhera.session.getTopic('chatspace.inviteToRoom').addListener((data, metadata) => {
    const {peerFingerprint, sessionId} = data;
    const {privateKey, publicKey} = x25519Generate();
    keyExchangeStates.set(peerFingerprint, {
        privateKey,
        publicKey,
    });
    sendCommand('room_invite', {
        name: getMyName(),
        peerFingerprint,
        peerSessionId: sessionId,
        publicKey: firstAid.encodeBase64(publicKey),
    });
});

menhera.client.state.addTopicReflector(menhera.session.getTopic('chatspace.makeFriends'), (data, metadata) => {
    const {fingerprint, name} = data;
    const friends = menhera.client.state.get('friends') || {};
    if (fingerprint in friends) {
        delete friends[fingerprint];
    } else {
        friends[fingerprint] = name;
    }
    return Object.entries({
        friends,
    });
});

let textMap = Object.create(null);

const getOnlineCount = () => Reflect.ownKeys(textMap).filter(fingerprint => textMap[fingerprint].isActive).length;
const getOnlineTotalCount = () => Reflect.ownKeys(textMap).length;

const getHash = () => {
    const hash = location.hash.slice(1);
    if (!hash) {
        return '(public)';
    } else {
        return '#' + hash;
    }
};

let lastFlash = 0;
menhera.session.getTopic('chatspace.flash').addListener(async (data, metadata) => {
    const time = getTime();
    if (time - lastFlash < 5000) return;
    lastFlash = time;
    console.log('flashing the screen...');
    const {shortFingerprint, name} = data;
    if (document.hidden && window.Notification && Notification.permission == 'granted' && serviceWorkerRegistration) {
        try {
            await serviceWorkerRegistration.showNotification('New message', {
                body: `${name} (@${shortFingerprint}) on ${getHash()}`,
                tag: 'new_message',
                requireInteraction: true,
                data: {
                    roomToken: getToken(),
                    url: location.href,
                },
            });
        } catch (e) {
            console.error(e);
        }
    }
    document.body.classList.add('flash');
    setTimeout(() => {
        document.body.classList.remove('flash');
    }, 100);
});

menhera.session.state.addTopicReflector(menhera.session.getTopic('chatspace.updateOnlineCount'), (data, metadata) => {
    const {onlineCount} = data;
    return Object.entries({
        onlineCount,
    });
});

menhera.session.state.addPropertyObserver('onlineCount', (onlineCount) => {
    connectionStatus.dataset.onlineCount = 0 | onlineCount;
});


const textClearTimers = Object.create(null);

const processMessage = async ev => {
    //
    try {
        if ('string' != typeof ev.data) {
            throw 'Invalid data type';
        }

        const signedObj = JSON.parse(ev.data);
        const encrypted = await edVerify(signedObj);
        const publicKey = firstAid.decodeBase64(signedObj.publicKey);
        const fingerprint = firstAid.encodeHex(await getFingerprint(publicKey));
        const encryptedObj = decodeObject(encrypted);
        const channelKey = getChannelKey();
        const dataBytes = await decrypt(encryptedObj, channelKey);

        const data = decodeObject(dataBytes);
        if ('object' != typeof data || !data) throw 'Invalid data';
        if ('number' != typeof data.time) throw 'Invalid time';
        if ('string' != typeof data.command) throw 'Invalid command';
        
        const text = 'string' == typeof data.text ? data.text : '';
        const caretOffset = 'number' == typeof data.caretOffset ? data.caretOffset : -1;
        const sessionId = 'string' == typeof data.sessionId ? data.sessionId : '';
        const cacheKey = `${fingerprint}_${sessionId}`;
        const name = String(data.name || '').slice(0, 30);
        switch (data.command) {
            case 'text_updated': {
                if (cacheKey in textClearTimers) {
                    try {
                        clearTimeout(textClearTimers[cacheKey]);
                    } catch (e) {}
                    delete textClearTimers[cacheKey];
                }
                commentsBox.update({
                    fingerprint,
                    sessionId,
                    text,
                    name,
                    receivedTime: getTime(),
                    isActive: data.isActive,
                    caretOffset,
                });
                break;
            }
            case 'text_cleared': {
                if (cacheKey in textClearTimers) {
                    break;
                }
                const cachedToken = getToken();
                textClearTimers[cacheKey] = setTimeout(() => {
                    delete textClearTimers[cacheKey];
                    if (getToken() != cachedToken) return;
                    commentsBox.update({
                        fingerprint,
                        sessionId,
                        text,
                        name,
                        receivedTime: getTime(),
                        isActive: data.isActive,
                        caretOffset,
                    });
                }, 1000);
                break;
            }
            case 'room_invite': {
                if (!myKeys) {
                    console.error('My keys unavailable yet!');
                    break;
                }
                const myFingerprint = firstAid.encodeHex(myKeys.fingerprint);
                if (myFingerprint != data.peerFingerprint) break;
                if (menhera.session.id != data.peerSessionId) break;
                console.log('Key exchange received');
                const {privateKey, publicKey} = x25519Generate();
                sendCommand('room_invite_reply', {
                    name: getMyName(),
                    peerFingerprint: fingerprint,
                    peerSessionId: sessionId,
                    publicKey: firstAid.encodeBase64(publicKey),
                });
                const token = await getX25519SharedUuid(privateKey, firstAid.decodeBase64(data.publicKey));
                menhera.session.getTopic('chatspace.showInvite').dispatchMessage({
                    peerFingerprint: fingerprint,
                    peerName: name,
                    token,
                });
                break;
            }
            case 'room_invite_reply': {
                if (!myKeys) {
                    console.error('My keys unavailable yet!');
                    break;
                }
                const myFingerprint = firstAid.encodeHex(myKeys.fingerprint);
                if (myFingerprint != data.peerFingerprint) break;
                if (menhera.session.id != data.peerSessionId) break;
                if (!keyExchangeStates.has(fingerprint)) {
                    console.warn('Unknown key exchange reply');
                    break;
                }
                const state = keyExchangeStates.get(fingerprint);
                const token = await getX25519SharedUuid(state.privateKey, firstAid.decodeBase64(data.publicKey));
                menhera.session.getTopic('chatspace.hideModals').dispatchMessage(null);
                setToken(token);
                break;
            }
            default: {
                console.warn('Unknown command');
            }
        }
    } catch (e) {
        console.error('Protocol violation:', e);
    }
};

const resetText = () => {
    commentsBox.clear();
};

const openSocket = (force) => {
    if (!ws || ws.readyState == WebSocket.CLOSED || ws.readyState == WebSocket.CLOSING || force) {
        if (ws && ws.readyState == WebSocket.OPEN) {
            ws.close();
        }

        ws = new WebSocket(String(wsUrl));

        resetText();
        
        ws.addEventListener('open', ev => {
            console.log('ws: open');
            resetText();
            updateStatus();
        });
        ws.addEventListener('close', ev => {
            console.log('ws: close');
            updateStatus();
            setTimeout(() => {
                if (document.hidden || !navigator.onLine) return;
                console.log('Trying reconnection...');
                openSocket();
            }, 50);
        });

        ws.addEventListener('message', ev => {
            if (ev.target.readyState != WebSocket.OPEN) return;
            if (ws != ev.target) return;
            processMessage(ev).catch(e => {
                console.error(e);
            });
        });
    }
};

const getChannelName = async (token) => {
    const tokenBuffer = firstAid.encodeString(token).buffer;
    const digestBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    return firstAid.encodeHex(new Uint8Array(digestBuffer));
};

const readHash = async () => {
    const token = getToken();
    tokenBox.value = token;
    document.title = token ? `Chatspace #${token}` : 'Chatspace (public)';
    console.log('Opening room:', token);
    const channel = await getChannelName(token);
    setWsUrl(channel);
    openSocket(true);
    await addVisitedRoom(token);
};

const updateTokenList = async () => {
    const rooms = await getLastVisitedRooms();
    tokenListContainer.textContent = '';
    for (const token of rooms) {
        const option = document.createElement('button');
        option.append('Room #' + token.split('-')[0]);
        option.value = token;
        tokenListContainer.prepend(option);
    }
    const option = document.createElement('button');
    option.append('(public)');
    option.value = '';
    tokenListContainer.prepend(option);
};

nameBox.addEventListener('change', ev => {
    saveUsername();
});

tokenBox.addEventListener('change', ev => {
    const token = tokenBox.value.trim();
    setToken(token);
});

logotypeBox.addEventListener('click', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    setToken('');
});

window.addEventListener('hashchange', ev => {
    console.log('hashchange');
    readHash().catch(e => {
        console.error(e);
    });
});

randomButton.addEventListener('click', ev => {
    openRandomRoom();
});

textBox.addEventListener('input', ev => {
    sendUpdate();
});

textBox.addEventListener('keydown', ev => {
    if (ev.keyCode == 13) {
        // ENTER
        ev.preventDefault();
        commit();
    } else if (ev.keyCode == 38) {
        // ARROW UP
        ev.preventDefault();
        historyBack();
    }
});

nameBox.addEventListener('keydown', ev => {
    if (ev.keyCode == 13) {
        setTimeout(() => {
            textBox.focus();
        }, 50);
    }
});

let blurTimeout;
textBox.addEventListener('blur', ev => {
    if (!blurTimeout) {
        blurTimeout = setTimeout(() => {
            blurTimeout = void 0;
            commit();
        }, 15000);
    }
});

clearButton.addEventListener('click', ev => {
    commit();
    textBox.focus();
});

textBox.addEventListener('focus', ev => {
    if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = void 0;
    }
});

nameBox.addEventListener('change', ev => {
    if ('' === nameBox.value.trim()) {
        // make sure placeholder is shown
        nameBox.value = '';
    }
});

document.addEventListener('visibilitychange', ev => {
    if (!document.hidden) {
        console.log('Page is now visible!');
        openSocket();
    }
});

connectionStatus.addEventListener('click', ev => {
    console.log('Reconnect if not connected');
    openSocket();
});

helpButton.addEventListener('click', ev => {
    ev.stopPropagation();
    menhera.session.getTopic('chatspace.showHelp').dispatchMessage(null);
});

helpBox.addEventListener('click', ev => {
    ev.stopPropagation();
});

settingsButton.addEventListener('click', ev => {
    ev.stopPropagation();
    menhera.session.getTopic('chatspace.showSettings').dispatchMessage(null);
});

settingsBox.addEventListener('click', ev => {
    ev.stopPropagation();
});

document.body.addEventListener('click', ev => {
    menhera.session.triggerTopic('chatspace.hideModals');
});

helpCloseButton.addEventListener('click', ev => {
    menhera.session.getTopic('chatspace.hideModals').dispatchMessage(null);
});

inviteIgnoreButton.addEventListener('click', ev => {
    menhera.session.getTopic('chatspace.hideModals').dispatchMessage(null);
});

inviteBox.addEventListener('click', ev => {
    ev.stopPropagation();
});

settingsCloseButton.addEventListener('click', ev => {
    menhera.session.getTopic('chatspace.hideModals').dispatchMessage(null);
});

window.addEventListener('pageshow', ev => {
    console.log('pageshow');
    saveUsername();
    readHash().catch(e => {
        console.error(e);
    });
});

settings.addEventListener('settingschange', ev => {
    switch (ev.key) {
        case 'visitedRooms': {
            updateTokenList().catch(e => {
                console.error(e);
            });
            break;
        }
        case 'privateKey': {
            privateKeyBox.value = firstAid.encodeBase64(myKeys.privateKey);
        }
    }
});

privateKeyBox.addEventListener('change', ev => {
    setMyKeys(privateKeyBox.value);
});

privateKeyRegenerateButton.addEventListener('click', ev => {
    privateKeyBox.value = firstAid.encodeBase64(ed.utils.randomPrivateKey());
    setMyKeys(privateKeyBox.value);
});

updateTokenList().catch(e => {
    console.error(e);
});

settingsReloadButton.addEventListener('click', ev => {
    location.reload();
});

setInterval(() => {
    const currentTime = getTime();
    if (currentTime - lastUpdate > 3000) {
        sendUpdate(true);
    }
}, 4000);

if (getVisitCount() < 2) {
    menhera.session.getTopic('chatspace.showHelp').dispatchMessage(null);
}

if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}

window.addEventListener('online', ev => {
    document.documentElement.dataset.onlineStatus = 'ONLINE';
    console.log('Becoming online, reconnecting...');
    openSocket();
});

window.addEventListener('offline', ev => {
    document.documentElement.dataset.onlineStatus = 'OFFLINE';
    console.log('Becoming offline');
});

if ('boolean' == typeof navigator.onLine) {
    if (navigator.onLine) {
        document.documentElement.dataset.onlineStatus = 'ONLINE';
    } else {
        document.documentElement.dataset.onlineStatus = 'OFFLINE';
    }
} else {
    document.documentElement.dataset.onlineStatus = 'UNKNOWN';
}

console.log('Online status:', document.documentElement.dataset.onlineStatus);

scriptCompleted = true;
