
import {parseTemplates} from '/lib/components-utils.mjs';

/** @type {HTMLTemplateElement} */
const template = parseTemplates(String.raw`
<template>
<link rel="stylesheet" href="/components/chatspace-toast.css"/>
<button id="action">Dismiss</button>
<div id="text"></div>
</template>
`)[0];

class ChatspaceToastElement extends HTMLElement {
    constructor(text, actionText) {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.append(template.content.cloneNode(true));
        this.text = text || '';
        if (actionText) {
            this.actionButton.textContent = actionText;
        }
    }

    get actionButton() {
        return this.shadowRoot.querySelector('button');
    }

    get text() {
        const textElement = this.shadowRoot.querySelector('#text');
        return textElement.textContent;
    }

    set text(value) {
        const textElement = this.shadowRoot.querySelector('#text');
        textElement.textContent = value;
    }

    get actionText() {
        return this.actionButton.textContent;
    }

    set actionText(value) {
        this.actionButton.textContent = value;
    }
}

customElements.define('chatspace-toast', ChatspaceToastElement);
