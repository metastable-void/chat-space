
const createCaretMark = () => {
    const element = document.createElement('span');
    element.classList.add('caret-mark');
    return element;
};

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
        const container = shadow.querySelector('#comment-text');
        const text = this.text;
        const caretOffset = this.caretOffset;
        const regex = /(^|[^\p{L}\p{N}])(?:(#[-_.\p{L}\p{N}]+)|(https?:\/\/(?:[\p{L}\p{N}](?:[-\p{L}\p{N}]*[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[-\p{L}\p{N}]*[\p{L}\p{N}])?)*|\[[:0-9a-f]+\])(?::[0-9]{1,5})?(?:\/[-_!@$%&=+|~/.,\[\]:;\p{L}\p{N}]*)?(?:\?[-_!@$%&=+|~/.,\[\]:;?\p{L}\p{N}]*)?(?:#[-_!@$%&=+|~/.,\[\]:;?#\p{L}\p{N}]*)?))/gui;
        let index = 0;
        container.textContent = '';
        if (0 == caretOffset) {
            container.append(createCaretMark());
        }
        for (const match of text.matchAll(regex)) {
            const startIndex = match.index + String(match[1] || '').length;
            const endIndex = match.index + match[0].length;
            if (index < startIndex) {
                if (index < caretOffset && caretOffset < startIndex) {
                    container.append(text.slice(index, caretOffset));
                    container.append(createCaretMark());
                    container.append(text.slice(caretOffset, startIndex));
                } else {
                    container.append(text.slice(index, startIndex));
                }
            }
            if (caretOffset == startIndex) {
                container.append(createCaretMark());
            }
            let entityTextContainer;
            try {
                const anchor = document.createElement('a');
                anchor.classList.add('entity');
                if (match[2]) {
                    // hashtag
                    anchor.href = new URL(match[2], location.href).toString();
                    anchor.classList.add('hashtag');
                } else if (match[3]) {
                    // link
                    anchor.href = new URL(match[3]).toString();
                    anchor.rel = 'nofollow';
                    anchor.target = '_blank';
                    anchor.classList.add('external-link');
                } else {
                    throw 'this should not happen';
                }
                container.append(anchor);
                entityTextContainer = anchor;
            } catch (e) {
                entityTextContainer = container;
            } finally {
                if (startIndex < caretOffset && caretOffset < endIndex) {
                    entityTextContainer.append(text.slice(startIndex, caretOffset));
                    entityTextContainer.append(createCaretMark());
                    entityTextContainer.append(text.slice(caretOffset, endIndex));
                } else {
                    entityTextContainer.append(text.slice(startIndex, endIndex));
                }
            }
            if (endIndex == caretOffset) {
                container.append(createCaretMark());
            }
            index = endIndex;
        }
        if (index < caretOffset && caretOffset < text.length) {
            container.append(text.slice(index, caretOffset));
            container.append(createCaretMark());
            container.append(text.slice(caretOffset, text.length));
        } else {
            container.append(text.slice(index, text.length));
        }
        if (index < caretOffset && caretOffset == text.length) {
            container.append(createCaretMark());
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
        const caretOffset = 0 | offset;
        if (caretOffset !== this.caretOffset) {
            element.dataset.caretOffset = String(caretOffset);
            this.renderText();
        }
    }

    get text() {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-text');
        return String(element.dataset.text || '');
    }

    set text(str) {
        const shadow = shadowMap.get(this);
        const element = shadow.querySelector('#comment-text');
        const text = String(str || '');
        if (text !== this.text) {
            element.dataset.text = text;
            this.renderText();
        }
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
