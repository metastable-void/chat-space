
const shadowMap = new WeakMap;
class ChatspaceCommentElement extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});
        shadowMap.set(this, shadow);
        const template = document.querySelector('#template-chatspace-comment');
        shadow.append(template.content.cloneNode(true));
        const textElement = shadow.querySelector('#comment-text');
        textElement.dataset.caretOffset = '-1';
        const identityElement = shadow.querySelector('#comment-identity');
        identityElement.dataset.isFriend = '0';
    }

    renderText() {
        const shadow = shadowMap.get(this);
        const caretMark = shadow.querySelector('#comment-text-caret-mark');
        const textBefore = shadow.querySelector('#comment-text-before-caret');
        const textAfter = shadow.querySelector('#comment-text-after-caret');
        const text = this.text;
        const caretOffset = this.caretOffset;
        if (caretOffset < 0) {
            textAfter.textContent = '';
            textBefore.textContent = text;
            caretMark.hidden = true;
        } else {
            caretMark.hidden = false;
            textBefore.textContent = text.slice(0, caretOffset);
            textAfter.textContent = text.slice(caretOffset);
        }
    }

    get caretOffset() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-text');
        return 0 | element.dataset.caretOffset;
    }

    set caretOffset(offset) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-text');
        element.dataset.caretOffset = '' + (0 | offset);
        this.renderText();
    }

    get text() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-text');
        return element.dataset.text || '';
    }

    set text(str) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-text');
        element.dataset.text = str;
        this.renderText();
    }

    get userName() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-username');
        return element.textContent || '';
    }

    set userName(name) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-username');
        element.textContent = name;
    }

    get shortFingerprint() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-fingerprint');
        return element.textContent || '';
    }

    set shortFingerprint(str) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-fingerprint');
        element.textContent = str;
    }

    get fingerprint() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-fingerprint');
        return element.title || '';
    }

    set fingerprint(str) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-fingerprint');
        element.title = str;
    }

    get sessionId() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-fingerprint');
        return element.dataset.sessionId || '';
    }

    set sessionId(str) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-fingerprint');
        element.dataset.sessionId = str;
    }

    get inviteButton() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-invite-button');
        return element;
    }

    get friendButton() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-friend-button');
        return element;
    }

    get isFriend() {
        const shadow = shadowMap.get(this);
        const identityElement = shadow.querySelector('#comment-identity');
        return !!+identityElement.dataset.isFriend;
    }

    set isFriend(value) {
        const shadow = shadowMap.get(this);
        const identityElement = shadow.querySelector('#comment-identity');
        identityElement.dataset.isFriend = '' + (0 | (!!value));
    }
}

customElements.define('chatspace-comment', ChatspaceCommentElement);
