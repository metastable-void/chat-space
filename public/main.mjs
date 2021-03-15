
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

/**
 * @type {HTMLInputElement}
 */
const identityBox = document.querySelector('#identity');

const randomButton = document.querySelector('#random');
const clearButton = document.querySelector('#clear');

const commentsContainer = document.querySelector('#comments');
const membersContainer = document.querySelector('#members');
const connectionStatus = document.querySelector('#connection');

const getUuid = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = bytes[6] & 0x0f ^ 0x40;
    bytes[8] = bytes[8] & 0x3f ^ 0x80;
    const hex = Array.prototype.map.call(
        bytes,
        byte => ((byte | 0x100).toString(0x10)).slice(-2)
    ).join('');
    return [
        hex.substr(0, 8),
        hex.substr(8, 4),
        hex.substr(12, 4),
        hex.substr(16, 4),
        hex.substr(20, 12),
    ].join('-');
};

const getTime = () => +new Date;

const getMyUuid = () => {
    try {
        const uuid = sessionStorage.getItem('menhera.chatspace.self.id');
        if (!uuid) {
            throw void 0;
        }
        return uuid;
    } catch (e) {
        const uuid = getUuid();
        sessionStorage.setItem('menhera.chatspace.self.id', uuid);
        return uuid;
    }
};

const UUID = getMyUuid();
const SHORT_ID = UUID.split('-')[0];
const PING_TIMEOUT = 30000;
let lastUpdate = 0;
textBox.dataset.uuid = UUID;
textBox.dataset.shortId = SHORT_ID;
identityBox.value = UUID;

let wsUrl;

const setWsUrl = (channel) => {
    const url = new URL('/ws/' + encodeURIComponent(channel || ''), location.href);
    url.protocol = 'https:' == location.protocol ? 'wss:' : 'ws:';
    wsUrl = String(url);
};

try {
    const name = localStorage.getItem('menhera.chatspace.self.name');
    if (!name) throw void 0;
    console.log('Name restored.');
    nameBox.value = name;
} catch (e) {
    console.log('Name not restored.');
}

const saveUsername = () => {
    try {
        localStorage.setItem('menhera.chatspace.self.name', nameBox.value);
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
    connectionStatus.textContent = ws.readyState == WebSocket.OPEN ? `Online` : 'Offline';
    connectionStatus.dataset.status = status;
};

const sendMessage = data => {
    if (ws.readyState == WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        return true;
    } else {
        return false;
    }
};

let previousText = '';
const sendUpdate = (force) => {
    const text = textBox.textContent.trim();
    const name = nameBox.value.trim();
    if (text == previousText && !force) return;
    previousText = text;
    lastUpdate = getTime();
    if (text.length < 1) {
        sendMessage({
            uuid: UUID,
            command: 'text_cleared',
            text: '',
            time: getTime(),
            name,
            isActive: !document.hidden,
        });
    } else {
        sendMessage({
            uuid: UUID,
            command: 'text_updated',
            text,
            time: getTime(),
            name,
            isActive: !document.hidden,
        });
    }
};

const commit = () => {
    textBox.textContent = '';
    const name = nameBox.value.trim();
    if (previousText == '') return;
    lastUpdate = getTime();
    previousText = '';
    sendMessage({
        uuid: UUID,
        command: 'text_cleared',
        text: '',
        time: getTime(),
        name,
        isActive: !document.hidden,
    });
};

let textMap = Object.create(null);

const getOnlineCount = () => Reflect.ownKeys(textMap).length;

const renderText = () => {
    connectionStatus.dataset.onlineCount = getOnlineCount();
    commentsContainer.textContent = '';
    membersContainer.textContent = '';
    for (const uuid of Reflect.ownKeys(textMap)) {
        if ('string' != typeof uuid) continue;
        const state = textMap[uuid];
        if (!state) continue;
        const text = state.text;
        const name = state.name || '';
        const isActive = !!state.isActive;
        if ('' === text && ('' === name || !isActive)) {
            continue;
        }
        const commentBox = document.createElement('div');
        commentBox.classList.add('commentBox');
        commentBox.dataset.uuid = uuid;
        commentBox.dataset.name = name || 'Anonymous';
        commentBox.dataset.shortId = uuid.split('-')[0];
        commentBox.title = uuid;
        commentBox.append(text);
        if (text) {
            commentsContainer.prepend(commentBox);
        } else {
            membersContainer.prepend(commentBox);
        }
    }
};

const processMessage = ev => {
    //
    try {
        if ('string' != typeof ev.data) {
            throw 'Invalid data type';
        }

        const data = JSON.parse(ev.data);
        if ('object' != typeof data || !data) throw 'Invalid data';
        if ('string' != typeof data.uuid) throw 'Invalid UUID';
        if ('number' != typeof data.time) throw 'Invalid time';
        if ('string' != typeof data.command) throw 'Invalid command';
        
        const text = 'string' == typeof data.text ? data.text : '';
        const name = data.name || '';
        switch (data.command) {
            case 'text_updated': {
                textMap[data.uuid] = {
                    text,
                    name,
                    receivedTime: getTime(),
                    isActive: data.isActive,
                };
                renderText();
                break;
            }
            case 'text_cleared': {
                setTimeout(() => {
                    textMap[data.uuid] = {
                        text,
                        receivedTime: getTime(),
                        name,
                        isActive: data.isActive,
                    };
                    renderText();
                }, 1000);
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
    if (!ws || ws.readyState == WebSocket.CLOSED || force) {
        if (ws && ws.readyState == WebSocket.OPEN) {
            ws.close();
        }

        ws = new WebSocket(String(wsUrl));

        textMap = Object.create(null);
        renderText();
        
        ws.addEventListener('open', ev => {
            console.log('ws: open');
            updateStatus();
        });
        ws.addEventListener('close', ev => {
            console.log('ws: close');
            updateStatus();
        });

        ws.addEventListener('message', processMessage);
    }
};

const readHash = () => {
    const token = decodeURIComponent(location.hash.slice(1)).trim();
    tokenBox.value = token;
    document.title = token ? `Chatspace #${token}` : 'Chatspace (root)';
    console.log('Opening room:', token);
    const channel = ''; // TODO: derive channel name from token
    setWsUrl(channel);
    openSocket(true);
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
    readHash();
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
});

identityBox.addEventListener('focus', ev => {
    identityBox.select();
});

textBox.addEventListener('focus', ev => {
    if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = void 0;
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

window.addEventListener('pageshow', ev => {
    console.log('pageshow');
    saveUsername();
    readHash();
});

setInterval(() => {
    const currentTime = getTime();
    if (currentTime - lastUpdate > 3000) {
        sendUpdate(true);
    }
    for (const uuid of Reflect.ownKeys(textMap)) {
        if (!textMap[uuid]) {
            delete textMap[uuid];
            continue;
        }
        const state = textMap[uuid];
        if (currentTime - state.receivedTime > 10000) {
            delete textMap[uuid];
            continue;
        }
    }

    renderText();
}, 4000);
