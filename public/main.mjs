
import * as ed from '/lib/noble-ed25519-1.0.3.mjs';
import * as x25519 from '/lib/x25519.mjs';
import {toUint8Array} from '/lib/buffer.mjs';
import * as hexUtils from '/lib/hex.mjs';
import * as base64 from '/lib/base64.mjs';
import * as rand from '/lib/random.mjs';
import * as uuidUtils from '/lib/uuid.mjs';
import {Settings} from '/lib/Settings.mjs';
import * as utf8 from '/lib/utf8.mjs';
import {WindowBroadcast} from '/lib/WindowBroadcast.mjs';
import {Session} from '/lib/Session.mjs';
import '/components/chatspace-comment.mjs';
import '/components/chatspace-comment-container.mjs';

const VISITED_ROOMS_LIST_LENGTH = 10;
const HISTORY_BUFFER_LENGTH = 10;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).then(reg => {
        console.log('ServiceWorker registered:', reg);
    }).catch(e => {
        console.error('ServiceWorker registration failed:', e);
    });
}

if (location.pathname.endsWith('/index.html')) {
    const url = new URL(location.href);
    url.pathname = url.pathname.slice(0, -10);
    history.replaceState({}, '', String(url));
}

const broadcast = new WindowBroadcast('chatspace');
const settings = new Settings;
const session = new Session;

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

const userAgentBox = document.querySelector('#user-agent');
userAgentBox.textContent = navigator.userAgent;


const getFingerprint = async bytes => {
    const buffer = await crypto.subtle.digest('SHA-256', bytes.slice(0).buffer);
    return new Uint8Array(buffer);
};


/**
 * 
 * @param obj {any}
 * @returns {Uint8Array}
 */
const encodeObject = obj => utf8.encode(JSON.stringify(obj));

/**
 * Decode object from bytes.
 * @param bytes {Uint8Array}
 * @returns {any}
 */
const decodeObject = bytes => JSON.parse(utf8.decode(bytes));

/**
 * Get 32-bit fingerprint representation (not much secure) of the given data.
 * @param bytes {Uint8Array}
 * @returns {string}
 */
const getShortFingerprint = bytes => hexUtils.encode(bytes.subarray(0, 4));

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
    const iv = rand.fill(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, dataBytes);
    return {
        algo: 'AES-GCM',
        ciphertext: base64.encode(ciphertext),
        iv: base64.encode(iv),
    };
};

const decrypt = async (dataObj, keyBytes) => {
    if ('AES-GCM' != dataObj.algo) {
        throw new TypeError('Unknown algorithm');
    }
    const key = await deriveKey(keyBytes);
    const iv = base64.decode(dataObj.iv);
    const ciphertext = base64.decode(dataObj.ciphertext);
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
        data: base64.encode(data),
        publicKey: base64.encode(publicKey),
        signature: base64.encode(signature),
    };
};

const edVerify = async (dataObj) => {
    if ('sign-ed25519' != dataObj.algo) {
        throw new TypeError('Unknown algorithm');
    }
    const data = base64.decode(dataObj.data);
    const digestBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
    const digest = new Uint8Array(digestBuffer);
    const publicKey = base64.decode(dataObj.publicKey);
    const signature = base64.decode(dataObj.signature);
    if (!ed.verify(signature, digest, publicKey)) {
        throw new TypeError('Broken signature!');
    }
    return data;
};

const x25519Generate = () => {
    const seed = new Uint8Array(32);
    rand.fill(seed);
    const keyPair = x25519.generateKeyPair(seed);
    return {
        privateKey: new Uint8Array(keyPair.private.buffer, keyPair.private.byteOffset, keyPair.private.byteLength),
        publicKey: new Uint8Array(keyPair.public.buffer, keyPair.public.byteOffset, keyPair.public.byteLength),
    };
};

const getX25519SharedUuid = async (privateKey, publicKey) => {
    const sharedSecret = x25519.sharedKey(privateKey, publicKey);
    const seed = await getFingerprint(sharedSecret);
    return uuidUtils.fromBytes(seed);
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

const getMyKeys = async () => {
    /** @type {Uint8Array} */
    let privateKey;

    /** @type {Uint8Array} */
    let publicKey;

    let fingerprint;
    try {
        const base64PrivateKey = settings.privateKey;
        if (!base64PrivateKey) throw void 0;
        privateKey = base64.decode(base64PrivateKey);
        publicKey = await ed.getPublicKey(privateKey);
        fingerprint = await getFingerprint(publicKey);
        console.log('My pubkey restored');
    } catch (e) {
        console.log('Failed to restore pubkey, generating...');
        privateKey = ed.utils.randomPrivateKey();
        publicKey = await ed.getPublicKey(privateKey);
        fingerprint = await getFingerprint(publicKey);
        const base64PrivateKey = base64.encode(privateKey);
        settings.privateKey = base64PrivateKey;
    }
    const shortFingerprint = getShortFingerprint(fingerprint);
    return {privateKey, publicKey, fingerprint, shortFingerprint};
};

let myKeys;
const setMyKeys = async (base64PrivateKey) => {
    try {
        const privateKey = base64.decode(String(base64PrivateKey).trim());
        if (32 != privateKey.length) throw void 0;
        const publicKey = await ed.getPublicKey(privateKey);
        const fingerprint = await getFingerprint(publicKey);
        const shortFingerprint = getShortFingerprint(fingerprint);
        myKeys = {privateKey, publicKey, fingerprint, shortFingerprint};
        settings.privateKey = base64PrivateKey;
        const hexFingerprint = hexUtils.encode(fingerprint);
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
    const fingerprint = hexUtils.encode(keys.fingerprint);
    identityBox.title = fingerprint;
    identityBox.textContent = fingerprint.substr(0, 8);
    myFingerprintBox.value = fingerprint;
    privateKeyBox.value = base64.encode(myKeys.privateKey);
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
    const token = uuidUtils.random();
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
    return utf8.encode(`channel_key_${token}`);
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
    data.sessionId = session.id;
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

/**
 * Invite a user to a new shared secret room.
 * @param peerFingerprint {string} Hex SHA-256 fingerprint.
 */
const inviteToRoom = (peerFingerprint, sessionId) => {
    const {privateKey, publicKey} = x25519Generate();
    keyExchangeStates.set(peerFingerprint, {
        privateKey,
        publicKey,
    });
    sendCommand('room_invite', {
        name: getMyName(),
        peerFingerprint,
        peerSessionId: sessionId,
        publicKey: base64.encode(publicKey),
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



let renderingPaused = false;
globalThis.pauseRendering = () => {
    renderingPaused = true;
};

globalThis.resumeRendering = () => {
    renderingPaused = false;
    renderText();
};

let isThereComment = false;
const renderText = () => {
    if (renderingPaused) return;
    connectionStatus.dataset.onlineCount = getOnlineCount();
    commentsContainer.textContent = '';
    membersContainer.textContent = '';
    let commentCount = 0;
    for (const cacheKey of Reflect.ownKeys(textMap)) {
        const state = textMap[cacheKey];
        if (!state) continue;
        const fingerprint = state.fingerprint;
        if ('string' != typeof fingerprint) continue;
        const sessionId = state.sessionId;
        if ('string' != typeof sessionId) continue;
        const text = (state.text || '').split('\n').join('').split('\r').join('');
        const name = state.name || '';
        const isActive = !!state.isActive;
        if ('' === text && ('' === name || !isActive)) {
            continue;
        }
        const commentBox = document.createElement('chatspace-comment');
        commentBox.fingerprint = fingerprint;
        commentBox.shortFingerprint = fingerprint.substr(0, 8);
        commentBox.sessionId = sessionId;
        commentBox.userName = name || 'Anonymous';
        commentBox.caretOffset = state.caretOffset;
        commentBox.text = text;

        commentBox.inviteButton.addEventListener('click', ev => inviteToRoom(fingerprint, sessionId));

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
        setToken(token);
    };
};

const textClearTimers = Object.create(null);

const processMessage = async ev => {
    //
    try {
        if ('string' != typeof ev.data) {
            throw 'Invalid data type';
        }

        const signedObj = JSON.parse(ev.data);
        const encrypted = await edVerify(signedObj);
        const publicKey = base64.decode(signedObj.publicKey);
        const fingerprint = hexUtils.encode(await getFingerprint(publicKey));
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
        const name = data.name || '';
        switch (data.command) {
            case 'text_updated': {
                if (cacheKey in textClearTimers) {
                    try {
                        clearTimeout(textClearTimers[cacheKey]);
                    } catch (e) {}
                    delete textClearTimers[cacheKey];
                }
                textMap[cacheKey] = {
                    fingerprint,
                    sessionId,
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
                if (cacheKey in textClearTimers) {
                    break;
                }
                textClearTimers[cacheKey] = setTimeout(() => {
                    delete textClearTimers[cacheKey];
                    textMap[cacheKey] = {
                        fingerprint,
                        sessionId,
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
                const myFingerprint = hexUtils.encode(myKeys.fingerprint);
                if (myFingerprint != data.peerFingerprint) break;
                if (session.id != data.peerSessionId) break;
                console.log('Key exchange received');
                const {privateKey, publicKey} = x25519Generate();
                sendCommand('room_invite_reply', {
                    name: getMyName(),
                    peerFingerprint: fingerprint,
                    peerSessionId: sessionId,
                    publicKey: base64.encode(publicKey),
                });
                const token = await getX25519SharedUuid(privateKey, base64.decode(data.publicKey));
                showRoomInvite(fingerprint, name, token);
                break;
            }
            case 'room_invite_reply': {
                if (!myKeys) {
                    console.error('My keys unavailable yet!');
                    break;
                }
                const myFingerprint = hexUtils.encode(myKeys.fingerprint);
                if (myFingerprint != data.peerFingerprint) break;
                if (session.id != data.peerSessionId) break;
                if (!keyExchangeStates.has(fingerprint)) {
                    console.warn('Unknown key exchange reply');
                    break;
                }
                const state = keyExchangeStates.get(fingerprint);
                const token = await getX25519SharedUuid(state.privateKey, base64.decode(data.publicKey));
                hideModals();
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
    textMap = Object.create(null);
    renderText();
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
    const tokenBuffer = utf8.encode(token).buffer;
    const digestBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    return hexUtils.encode(new Uint8Array(digestBuffer));
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
    setToken(token);
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

settings.addEventListener('settingschange', ev => {
    switch (ev.key) {
        case 'visitedRooms': {
            updateTokenList().catch(e => {
                console.error(e);
            });
            break;
        }
        case 'privateKey': {
            privateKeyBox.value = base64.encode(myKeys.privateKey);
        }
    }
});

privateKeyBox.addEventListener('change', ev => {
    setMyKeys(privateKeyBox.value);
});

privateKeyRegenerateButton.addEventListener('click', ev => {
    privateKeyBox.value = base64.encode(ed.utils.randomPrivateKey());
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
