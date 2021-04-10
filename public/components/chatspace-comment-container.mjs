
const removeNewlines = (str) => String(str || '').split('\n').join('').split('\r').join('');

const statesMap = new WeakMap;
class ChatspaceCommentContainerElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        const template = document.querySelector('#template-chatspace-comment-container');
        this.shadowRoot.append(template.content.cloneNode(true));
        const states = new Map;
        statesMap.set(this, states);
        setInterval(() => {
            const currentTime = +new Date;
            for (const [cacheKey, commentBox] of states) {
                if (currentTime - commentBox.receivedTime > 10000) {
                    states.delete(cacheKey);
                    this.removeChild(commentBox);
                }
            }
            menhera.session.getTopic('chatspace.updateOnlineCount').dispatchMessage({
                onlineCount: this.onlineCount,
            });
        }, 1000);
    }

    clear() {
        const states = statesMap.get(this);
        states.clear();
        this.textContent = '';
        menhera.session.getTopic('chatspace.updateOnlineCount').dispatchMessage({
            onlineCount: this.onlineCount,
        });
    }

    get onlineCount() {
        return this.children.length;
    }

    update(data) {
        if ('object' != typeof data || !data) {
            throw new TypeError('Invalid data');
        }
        const friends = menhera.client.state.get('friends');
        const fingerprint = data.fingerprint || '';
        const sessionId = data.sessionId || '';
        const isActive = !!data.isActive;
        const name = removeNewlines(data.name).trim();
        const text = removeNewlines(data.text);
        const caretOffset = data.caretOffset | 0;
        if (!fingerprint) {
            throw new TypeError('Invalid fingerprint');
        }
        const cacheKey = `${fingerprint}_${sessionId}`;
        const states = statesMap.get(this);
        if (!states.has(cacheKey)) {
            const commentBox = document.createElement('chatspace-comment');
            commentBox.fingerprint = fingerprint;
            commentBox.shortFingerprint = fingerprint.substr(0, 8);
            commentBox.sessionId = sessionId;
            states.set(cacheKey, commentBox);
            this.append(commentBox);
        }
        const commentBox = states.get(cacheKey);
        commentBox.receivedTime = +new Date;
        commentBox.isFriend = fingerprint in friends;
        commentBox.userName = name || 'Anonymous';
        commentBox.caretOffset = caretOffset;
        commentBox.text = text;

        commentBox.inviteButton.addEventListener('click', ev => menhera.session.getTopic('chatspace.inviteToRoom').dispatchMessage({
            peerFingerprint: fingerprint,
            sessionId,
        }));
        commentBox.friendButton.addEventListener('click', ev => menhera.session.getTopic('chatspace.makeFriends').dispatchMessage({
            fingerprint,
            name,
        }));

        if (text) {
            if (this.querySelectorAll('[slot="active"]').length < 1) {
                menhera.session.getTopic('chatspace.flash').dispatchMessage(null);
            }
            commentBox.slot = 'active';
        } else if ('' == name || !isActive) {
            commentBox.slot = '';
        } else {
            commentBox.slot = 'idle';
        }
        menhera.session.getTopic('chatspace.updateOnlineCount').dispatchMessage({
            onlineCount: this.onlineCount,
        });
    }
}

customElements.define('chatspace-comment-container', ChatspaceCommentContainerElement);
