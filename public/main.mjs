
import * as ed from '/noble-ed25519-1.0.3.mjs';
import * as x25519 from '/x25519.mjs';
import {toUint8Array} from '/buffer.mjs';

const LOCAL_STORAGE_PREFIX = 'menhera.chatspace';
const LOCAL_STORAGE_PRIVATE_KEY = `${LOCAL_STORAGE_PREFIX}.private_key`;
const LOCAL_STORAGE_USERNAME = `${LOCAL_STORAGE_PREFIX}.self.name`;
const LOCAL_STORAGE_VISIT_COUNT = `${LOCAL_STORAGE_PREFIX}.visit_count`;
const LOCAL_STORAGE_VISITED_ROOMS = `${LOCAL_STORAGE_PREFIX}.visited_rooms`;

const VISITED_ROOMS_LIST_LENGTH = 10;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).then(reg => {
        console.log('ServiceWorker registered:', reg);
    }).catch(e => {
        console.error('ServiceWorker registration failed:', e);
    });
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

const commentsContainer = document.querySelector('#comments');
const membersContainer = document.querySelector('#members');
const connectionStatus = document.querySelector('#connection');

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

/**
 * Convert Uint8Array to hex string.
 * @param bytes {Uint8Array}
 * @returns {string}
 */
const bytesToHex = (bytes) => Array.prototype.map.call(
    bytes,
    byte => (byte | 0x100).toString(0x10).slice(-2)
).join('');

/**
 * Convert hex string into Uint8Array.
 * @param hex {string}
 * @returns {Uint8Array}
 */
const hexToBytes = (hex) => {
    if ('string' != typeof hex) throw new TypeError('Not a string');
    if (hex.length & 1) throw new TypeError('Invalid length');
    if (hex.includes('.')) throw new TypeError('Invalid hex string');
    return new Uint8Array(function* () {
        for (let i = 0; i < (hex.length >>> 1); i++) {
            const byteHex = hex.substr(i << 1, 2).trim();
            if (byteHex.length != 2 || byteHex.includes('.')) {
                throw new TypeError('Invalid hex string');
            }
            const byte = Number('0x' + byteHex);
            if (isNaN(byte)) {
                throw new TypeError('Invalid hex string');
            }
            yield byte;
        }
    }());
};

const encodeBase64 = bytes => btoa(Array.prototype.map.call(
    bytes,
    byte => String.fromCharCode(byte)
).join(''));

const decodeBase64 = base64 => new Uint8Array(Array.prototype.map.call(
    atob(base64),
    byteStr => byteStr.charCodeAt(0)
));

const getFingerprint = async bytes => {
    const buffer = await crypto.subtle.digest('SHA-256', bytes.slice(0).buffer);
    return new Uint8Array(buffer);
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * 
 * @param obj {any}
 * @returns {Uint8Array}
 */
const encodeObject = obj => textEncoder.encode(JSON.stringify(obj));

/**
 * Decode object from bytes.
 * @param bytes {Uint8Array}
 * @returns {any}
 */
const decodeObject = bytes => JSON.parse(textDecoder.decode(bytes));

/**
 * Get 32-bit fingerprint representation (not much secure) of the given data.
 * @param bytes {Uint8Array}
 * @returns {string}
 */
const getShortFingerprint = bytes => bytesToHex(bytes.subarray(0, 4));

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
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, dataBytes);
    return {
        algo: 'AES-GCM',
        ciphertext: encodeBase64(new Uint8Array(ciphertext)),
        iv: encodeBase64(iv),
    };
};

const decrypt = async (dataObj, keyBytes) => {
    if ('AES-GCM' != dataObj.algo) {
        throw new TypeError('Unknown algorithm');
    }
    const key = await deriveKey(keyBytes);
    const iv = decodeBase64(dataObj.iv);
    const ciphertext = decodeBase64(dataObj.ciphertext);
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
        data: encodeBase64(data),
        publicKey: encodeBase64(publicKey),
        signature: encodeBase64(signature),
    };
};

const edVerify = async (dataObj) => {
    if ('sign-ed25519' != dataObj.algo) {
        throw new TypeError('Unknown algorithm');
    }
    const data = decodeBase64(dataObj.data);
    const digestBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const digest = new Uint8Array(digestBuffer);
    const publicKey = decodeBase64(dataObj.publicKey);
    const signature = decodeBase64(dataObj.signature);
    if (!ed.verify(signature, digest, publicKey)) {
        throw new TypeError('Broken signature!');
    }
    return data;
};

const x25519Generate = () => {
    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);
    const keyPair = x25519.generateKeyPair(seed);
    return {
        privateKey: new Uint8Array(keyPair.private.buffer, keyPair.private.byteOffset, keyPair.private.byteLength),
        publicKey: new Uint8Array(keyPair.public.buffer, keyPair.public.byteOffset, keyPair.public.byteLength),
    };
};

const bytesToUuid = (arr) => {
    const bytes = toUint8Array(arr).subarray(0, 16);
    if (16 != bytes.length) {
        throw new TypeError('Insufficient buffer length');
    }
    bytes[6] = bytes[6] & 0x0f ^ 0x40;
    bytes[8] = bytes[8] & 0x3f ^ 0x80;
    const hex = bytesToHex(bytes);
    return [
        hex.substr(0, 8),
        hex.substr(8, 4),
        hex.substr(12, 4),
        hex.substr(16, 4),
        hex.substr(20, 12),
    ].join('-');
};

const getUuid = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToUuid(bytes);
};

const getX25519SharedUuid = async (privateKey, publicKey) => {
    const sharedSecret = x25519.sharedKey(privateKey, publicKey);
    const seed = await getFingerprint(sharedSecret);
    return bytesToUuid(seed);
};

const getTime = () => +new Date;

const isLocalStorageAvailable = () => {
    try {
        const randomId = getUuid();
        localStorage.setItem(randomId, 'test');
        const availability = 'test' === localStorage.getItem(randomId);
        localStorage.removeItem(randomId);
        return availability;
    } catch (e) {
        return false;
    }
};

const getMyKeys = async () => {
    /** @type {Uint8Array} */
    let privateKey;

    /** @type {Uint8Array} */
    let publicKey;

    let fingerprint;
    try {
        const base64PrivateKey = localStorage.getItem(LOCAL_STORAGE_PRIVATE_KEY);
        if (!base64PrivateKey) throw void 0;
        privateKey = decodeBase64(base64PrivateKey);
        publicKey = await ed.getPublicKey(privateKey);
        fingerprint = await getFingerprint(publicKey);
        console.log('My pubkey restored');
    } catch (e) {
        console.log('Failed to restore pubkey, generating...');
        privateKey = ed.utils.randomPrivateKey();
        publicKey = await ed.getPublicKey(privateKey);
        fingerprint = await getFingerprint(publicKey);
        const base64PrivateKey = encodeBase64(privateKey);
        try {
            localStorage.setItem(LOCAL_STORAGE_PRIVATE_KEY, base64PrivateKey);
        } catch (e) {
            console.warn(e);
        }
    }
    const shortFingerprint = getShortFingerprint(fingerprint);
    return {privateKey, publicKey, fingerprint, shortFingerprint};
};

let myKeys;
const setMyKeys = async (base64PrivateKey) => {
    try {
        const privateKey = decodeBase64(String(base64PrivateKey).trim());
        if (32 != privateKey.length) throw void 0;
        const publicKey = await ed.getPublicKey(privateKey);
        const fingerprint = await getFingerprint(publicKey);
        const shortFingerprint = getShortFingerprint(fingerprint);
        myKeys = {privateKey, publicKey, fingerprint, shortFingerprint};
        try {
            localStorage.setItem(LOCAL_STORAGE_PRIVATE_KEY, base64PrivateKey);
        } catch (e) {
            console.warn(e);
        }
    } catch (e) {
        console.warn('Invalid private key: not set');
    }
};

const getVisitCount = () => {
    let count = 0;
    try {
        count = 0 | localStorage.getItem(LOCAL_STORAGE_VISIT_COUNT);
    } catch (e) {
        console.warn(e);
    }
    return count;
};

const getLastVisitedRooms = async () => {
    // intentionally async for future expansion
    try {
        const rooms = JSON.parse(localStorage.getItem(LOCAL_STORAGE_VISITED_ROOMS));
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
    try {
        const rooms = new Set(await getLastVisitedRooms());
        rooms.delete(token);
        rooms.add(token);
        localStorage.setItem(LOCAL_STORAGE_VISITED_ROOMS, JSON.stringify([... rooms].slice(- VISITED_ROOMS_LIST_LENGTH)));
    } catch (e) {}
};

try {
    const prevCount = getVisitCount();
    localStorage.setItem(LOCAL_STORAGE_VISIT_COUNT, String(prevCount + 1));
    console.log (`Visited ${prevCount} time(s) before.`);
} catch (e) {
    console.warn(e);
}

getMyKeys().then(keys => {
    myKeys = keys;
    const fingerprint = bytesToHex(keys.fingerprint);
    identityBox.title = fingerprint;
    identityBox.textContent = fingerprint.substr(0, 8);
    myFingerprintBox.value = fingerprint;
    privateKeyBox.value = encodeBase64(myKeys.privateKey);
});

const localStorageAvailability = isLocalStorageAvailable();
if (!localStorageAvailability) {
    console.warn('LocalStorage not available');
}

let lastUpdate = 0;

let wsUrl;

const setWsUrl = (channel) => {
    const url = new URL('/ws/' + encodeURIComponent(channel || ''), location.href);
    url.protocol = 'https:' == location.protocol ? 'wss:' : 'ws:';
    wsUrl = String(url);
};

try {
    const name = localStorage.getItem(LOCAL_STORAGE_USERNAME);
    if (!name) throw void 0;
    console.log('Name restored.');
    nameBox.value = name;
} catch (e) {
    console.log('Name not restored.');
}

const saveUsername = () => {
    try {
        localStorage.setItem(LOCAL_STORAGE_USERNAME, nameBox.value);
    } catch (e) {
        console.warn('Failed to save your name:', e);
    }
};

const openRandomRoom = () => {
    console.log('openRandomRoom');
    const token = getUuid();
    location.hash = `#${token}`;
};

/**
 * @type {WebSocket?}
 * */
let ws;

const getToken = () => decodeURIComponent(location.hash.slice(1)).trim();

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
    return textEncoder.encode(`channel_key_${token}`);
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

let previousText = '';
const sendUpdate = (force) => {
    if (textBox.textContent.includes('\n')) {
        textBox.textContent = textBox.textContent.split('\n').join('').split('\r').join('');
    }
    const text = textBox.textContent.trim();
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
    const name = nameBox.value.trim();
    const offset = getCaretOffset();
    if (previousText == '') return;
    lastUpdate = getTime();
    previousText = '';
    sendCommand('text_cleared', {
        text: '',
        name,
        caretOffset: offset,
    });
};

// outgoing offers
const keyExchangeStates = new Map;

/**
 * Invite a user to a new shared secret room.
 * @param peerFingerprint {string} Hex SHA-256 fingerprint.
 */
const inviteToRoom = (peerFingerprint) => {
    const {privateKey, publicKey} = x25519Generate();
    keyExchangeStates.set(peerFingerprint, {
        privateKey,
        publicKey,
    });
    sendCommand('room_invite', {
        name: getMyName(),
        peerFingerprint,
        publicKey: encodeBase64(publicKey),
    });
};

let textMap = Object.create(null);

const getOnlineCount = () => Reflect.ownKeys(textMap).filter(fingerprint => textMap[fingerprint].isActive).length;
const getOnlineTotalCount = () => Reflect.ownKeys(textMap).length;

let lastFlash = 0;
const flash = globalThis.flash = () => {
    const time = getTime();
    if (time - lastFlash < 5000) return;
    lastFlash = time;
    console.log('flashing the screen...');
    document.body.classList.add('flash');
    setTimeout(() => {
        document.body.classList.remove('flash');
    }, 100);
};

let isThereComment = false;
const renderText = () => {
    connectionStatus.dataset.onlineCount = getOnlineCount();
    commentsContainer.textContent = '';
    membersContainer.textContent = '';
    let commentCount = 0;
    for (const fingerprint of Reflect.ownKeys(textMap)) {
        if ('string' != typeof fingerprint) continue;
        const state = textMap[fingerprint];
        if (!state) continue;
        const text = (state.text || '').split('\n').join('').split('\r').join('');
        const name = state.name || '';
        const isActive = !!state.isActive;
        if ('' === text && ('' === name || !isActive)) {
            continue;
        }
        const commentBox = document.createElement('div');
        commentBox.classList.add('commentBox');
        commentBox.dataset.fingerprint = fingerprint;
        commentBox.dataset.name = name || 'Anonymous';
        commentBox.dataset.shortId = fingerprint.substr(0, 8);
        commentBox.title = fingerprint;
        commentBox.dataset.caretOffset = state.caretOffset;
        const controlBox = document.createElement('div');
        controlBox.classList.add('commentControls');
        commentBox.append(controlBox);
        const inviteButton = document.createElement('button');
        inviteButton.classList.add('material-icons');
        inviteButton.title = 'Chat privately';
        inviteButton.append('mail');
        inviteButton.addEventListener('click', ev => inviteToRoom(fingerprint));
        controlBox.append(inviteButton);
        if (state.caretOffset < 0) {
            if (text) {
                commentBox.append(text);
            }
        } else {
            const beforeText = text.substring(0, state.caretOffset);
            const afterText = text.substring(state.caretOffset);
            if (beforeText) {
                commentBox.append(beforeText);
            }
            const caretMark = document.createElement('span');
            caretMark.classList.add('caretMark');
            commentBox.append(caretMark);
            if (afterText) {
                commentBox.append(afterText);
            }
        }
        if (text) {
            if (!isThereComment && commentCount < 1 && !isTextBoxFocused()) {
                flash();
            }
            commentCount++;
            commentsContainer.prepend(commentBox);
        } else {
            membersContainer.prepend(commentBox);
        }
    }

    isThereComment = commentCount > 0;
};

const hideModals = () => {
    overlayBox.hidden = true;
    for (const box of overlayBox.children) {
        box.hidden = true;
    }
};

let inviteAcceptHandler = () => void 0;
const showRoomInvite = (peerFingerprint, peerName, token) => {
    console.log(`Room invite received from ${peerName} (@${peerFingerprint})`);
    hideModals();
    invitePeerFingerprintBox.title = peerFingerprint;
    invitePeerFingerprintBox.textContent = peerFingerprint.slice(0, 8);
    invitePeerNameBox.textContent = peerName;
    overlayBox.hidden = false;
    inviteBox.hidden = false;
    inviteAcceptHandler = () => {
        inviteAcceptHandler = () => void 0;
        location.hash = '#' + token;
    };
};

const processMessage = async ev => {
    //
    try {
        if ('string' != typeof ev.data) {
            throw 'Invalid data type';
        }

        const signedObj = JSON.parse(ev.data);
        const encrypted = await edVerify(signedObj);
        const publicKey = decodeBase64(signedObj.publicKey);
        const fingerprint = bytesToHex(await getFingerprint(publicKey));
        const encryptedObj = decodeObject(encrypted);
        const channelKey = getChannelKey();
        const dataBytes = await decrypt(encryptedObj, channelKey);

        const data = decodeObject(dataBytes);
        if ('object' != typeof data || !data) throw 'Invalid data';
        if ('number' != typeof data.time) throw 'Invalid time';
        if ('string' != typeof data.command) throw 'Invalid command';
        
        const text = 'string' == typeof data.text ? data.text : '';
        const caretOffset = 'number' == typeof data.caretOffset ? data.caretOffset : -1;
        const name = data.name || '';
        switch (data.command) {
            case 'text_updated': {
                textMap[fingerprint] = {
                    text,
                    name,
                    receivedTime: getTime(),
                    isActive: data.isActive,
                    caretOffset,
                };
                renderText();
                break;
            }
            case 'text_cleared': {
                setTimeout(() => {
                    textMap[fingerprint] = {
                        text,
                        receivedTime: getTime(),
                        name,
                        isActive: data.isActive,
                        caretOffset,
                    };
                    renderText();
                }, 1000);
                break;
            }
            case 'room_invite': {
                if (!myKeys) {
                    console.error('My keys unavailable yet!');
                    break;
                }
                const myFingerprint = bytesToHex(myKeys.fingerprint);
                if (myFingerprint != data.peerFingerprint) break;
                console.log('Key exchange received');
                const {privateKey, publicKey} = x25519Generate();
                sendCommand('room_invite_reply', {
                    name: getMyName(),
                    peerFingerprint: fingerprint,
                    publicKey: encodeBase64(publicKey),
                });
                const token = await getX25519SharedUuid(privateKey, decodeBase64(data.publicKey));
                showRoomInvite(fingerprint, name, token);
                break;
            }
            case 'room_invite_reply': {
                if (!myKeys) {
                    console.error('My keys unavailable yet!');
                    break;
                }
                const myFingerprint = bytesToHex(myKeys.fingerprint);
                if (myFingerprint != data.peerFingerprint) break;
                if (!keyExchangeStates.has(fingerprint)) {
                    console.warn('Unknown key exchange reply');
                    break;
                }
                const state = keyExchangeStates.get(fingerprint);
                const token = await getX25519SharedUuid(state.privateKey, decodeBase64(data.publicKey));
                showRoomInvite(fingerprint, name, token);
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

const openSocket = (force) => {
    if (!ws || ws.readyState == WebSocket.CLOSED || ws.readyState == WebSocket.CLOSING || force) {
        if (ws && ws.readyState == WebSocket.OPEN) {
            ws.close();
        }

        ws = new WebSocket(String(wsUrl));

        textMap = Object.create(null);
        console.log('textMap:', textMap);
        renderText();
        
        ws.addEventListener('open', ev => {
            console.log('ws: open');
            updateStatus();
        });
        ws.addEventListener('close', ev => {
            console.log('ws: close');
            updateStatus();
        });

        ws.addEventListener('message', ev => {
            if (ev.target.readyState != WebSocket.OPEN) return;
            processMessage(ev).catch(e => {
                console.error(e);
            });
        });
    }
};

const getChannelName = async (token) => {
    const tokenBuffer = textEncoder.encode(token).buffer;
    const digestBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    return bytesToHex(new Uint8Array(digestBuffer));
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

let helpShown = false;

const hideHelp = () => {
    if (!helpShown) return;
    helpShown = false;
    console.log('hiding help...');
    overlayBox.hidden = true;
    helpBox.hidden = true;
};

const hideSettings = () => {
    if (settingsBox.hidden) return;
    console.log('hiding settings...');
    overlayBox.hidden = true;
    settingsBox.hidden = true;
};

const showHelp = () => {
    if (helpShown) return;
    helpShown = true;
    console.log('showing help...');
    hideSettings();
    hideModals();
    overlayBox.hidden = false;
    helpBox.hidden = false;
};

const showSettings = () => {
    if (!settingsBox.hidden) return;
    console.log('showing settings...');
    hideHelp();
    hideModals();
    overlayBox.hidden = false;
    settingsBox.hidden = false;
};

const updateTokenList = async () => {
    const rooms = await getLastVisitedRooms();
    tokenListContainer.textContent = '';
    for (const token of rooms) {
        const option = document.createElement('option');
        option.append('#' + token);
        option.value = token;
        tokenListContainer.prepend(option);
    }
    const option = document.createElement('option');
    option.append('(public)');
    option.value = '';
    tokenListContainer.prepend(option);
};

nameBox.addEventListener('change', ev => {
    saveUsername();
});

tokenBox.addEventListener('change', ev => {
    const token = tokenBox.value.trim();
    if (token) {
        location.hash = `#${encodeURIComponent(token)}`;
    } else {
        location.hash = '';
    }
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
    if (!helpShown) {
        ev.stopPropagation();
        showHelp();
    }
});

helpBox.addEventListener('click', ev => {
    ev.stopPropagation();
});

settingsButton.addEventListener('click', ev => {
    if (settingsBox.hidden) {
        ev.stopPropagation();
        showSettings();
    }
});

settingsBox.addEventListener('click', ev => {
    ev.stopPropagation();
});

document.body.addEventListener('click', ev => {
    hideHelp();
    hideSettings();
    hideModals();
});

helpCloseButton.addEventListener('click', ev => {
    hideHelp();
});

inviteAcceptButton.addEventListener('click', ev => {
    hideModals();
    inviteAcceptHandler();
});

inviteIgnoreButton.addEventListener('click', ev => {
    hideModals();
    inviteAcceptHandler = () => void 0;
});

inviteBox.addEventListener('click', ev => {
    ev.stopPropagation();
});

settingsCloseButton.addEventListener('click', ev => {
    hideSettings();
});

window.addEventListener('pageshow', ev => {
    console.log('pageshow');
    saveUsername();
    readHash().catch(e => {
        console.error(e);
    });
});

window.addEventListener('storage', ev => {
    if (LOCAL_STORAGE_VISITED_ROOMS == ev.key) {
        updateTokenList().catch(e => {
            console.error(e);
        });
    } else if (LOCAL_STORAGE_PRIVATE_KEY == ev.key) {
        privateKeyBox.value = encodeBase64(myKeys.privateKey);
    }
});

privateKeyBox.addEventListener('change', ev => {
    setMyKeys(privateKeyBox.value);
});

updateTokenList().catch(e => {
    console.error(e);
});

setInterval(() => {
    const currentTime = getTime();
    if (currentTime - lastUpdate > 3000) {
        sendUpdate(true);
    }
    for (const fingerprint of Reflect.ownKeys(textMap)) {
        if (!textMap[fingerprint]) {
            delete textMap[fingerprint];
            continue;
        }
        const state = textMap[fingerprint];
        if (currentTime - state.receivedTime > 10000) {
            delete textMap[fingerprint];
            continue;
        }
    }

    renderText();
}, 4000);

if (getVisitCount() < 2) {
    showHelp();
}

if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
