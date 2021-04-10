
const removeNewlines = (str) => String(str || '').split('\n').join('').split('\r').join('');

const statesMap = new WeakMap;
class ChatspaceCommentContainerElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        const template = document.querySelector('#template-chatspace-comment-container');
        this.shadowRoot.append(template.content.cloneNode(true));
        statesMap.set(this, new Map);
    }

    update(data) {
        if ('object' != typeof data || !data) {
            throw new TypeError('Invalid data');
        }
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
        commentBox.userName = name || 'Anonymous';
        commentBox.caretOffset = caretOffset;
        commentBox.text = text;
        if (text) {
            commentBox.slot = 'active';
        } else if ('' == name || !isActive) {
            commentBox.slot = '';
        } else {
            commentBox.slot = 'idle';
        }
    }
}

customElements.define('chatspace-comment-container', ChatspaceCommentContainerElement);
