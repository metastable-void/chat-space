
const shadowMap = new WeakMap;
class ChatspaceCommentElement extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({mode: 'open'});
        shadowMap.set(this, shadow);
        const style = document.createElement('style');
        style.textContent = `

@import url(/common.css);

:host {
    display: grid;
    margin: 0;
    margin-block-end: 1em;
    /*border: solid .125rem var(--theme-border-color);*/
    background-color: var(--theme-input-background-color);
    box-shadow: 0 0 .25rem var(--theme-shadow-color);
    grid-template-columns: 1fr max-content;
}

#comment-main {
    padding: .5em;
    overflow-wrap: break-word;
    grid-column: 1;
}

#comment-text {
    white-space: pre-wrap;
    -moz-user-select: text;
    -webkit-user-select: text;
    user-select: text;
}

#comment-identity, #comment-text {
    display: inline;
}

#comment-menu {
    display: grid;
    align-content: space-around;
    grid-column: 2;
    margin: 0;
    padding: 0;
    margin-inline-end: .5em;
}

#comment-menu > button {
    display: block;
    appearance: none;
    outline: none;
    border: none;
    border-radius: 0;
    margin: 0;
    padding: 0;
    cursor: pointer;
    color: inherit;
    background-color: transparent;
    text-align: center;
    line-height: initial;
    font-size: 1em !important;
    opacity: .5;
}

#comment-menu > button:hover, #comment-menu > button:active {
    opacity: 1;
}

#comment-username, #comment-fingerprint {
    display: inline;
    color: var(--theme-label-text-color);
}

#comment-fingerprint::before {
    content: ' @';
}

#comment-fingerprint::after {
    content: ': ';
}

#comment-text-caret-mark:not([hidden]) {
    display: inline-block;
    inline-size: .125rem;
    overflow: hidden;
    text-indent: -10em;
    background-color: var(--theme-accent-color);
    color: transparent;
    vertical-align: text-top;
}

#comment-text-caret-mark::before {
    content: '*';
}
        
        `;
        shadow.append(style);
        const template = document.querySelector('#template-chatspace-comment');
        shadow.append(template.content.cloneNode(true));
        const textElement = shadow.querySelector('#comment-text');
        textElement.dataset.caretOffset = '-1';
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
}

customElements.define('chatspace-comment', ChatspaceCommentElement);
