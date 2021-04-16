
import * as ed from '/lib/noble-ed25519-1.0.3.mjs';
import * as x25519 from '/lib/x25519.mjs';
import '/lib/es-first-aid.js';

export const sha256 = async bytes => {
    const buffer = await crypto.subtle.digest('SHA-256', firstAid.getCopyBuffer(bytes));
    return new Uint8Array(buffer);
};

const deriveKey = async (keyBytes, info) => {
    const rawKey = await crypto.subtle.importKey('raw', keyBytes, 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({
        name: 'HKDF',
        hash: 'SHA-256',
        info: firstAid.encodeString(info || '').buffer,
        salt: new ArrayBuffer(0)
    }, rawKey, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
};

/**
 * AES-GCM encryption.
 */
export class MessageEncrypter {
    constructor(keyString) {
        this.keyString = String(keyString);
        if ('' == this.keyString) {
            throw new TypeError('Key string cannot be empty');
        }
        this.keyPromise = deriveKey(firstAid.encodeString(this.keyString));
    }

    encryptMessage(message) {
        const dataBytes = firstAid.encodeJson(message);
        const key = await this.keyPromise;
        const iv = firstAid.randomFill(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, dataBytes);
        return {
            algo: 'AES-GCM',
            ciphertext: firstAid.encodeBase64(ciphertext),
            iv: firstAid.encodeBase64(iv),
        };
    }

    decryptMessage(dataObj) {
        if (!dataObj || 'AES-GCM' != dataObj.algo) {
            throw new TypeError('Unknown algorithm');
        }
        const key = await this.keyPromise;
        const iv = firstAid.decodeBase64(dataObj.iv);
        const ciphertext = firstAid.decodeBase64(dataObj.ciphertext);
        const resultBuffer = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, ciphertext);
        return firstAid.decodeJson(resultBuffer);
    }
}

const buildPublicKeyObject = async (buffer) => {
    const bytes = firstAid.toUint8Array(buffer);
    if (32 != bytes.length) {
        throw new TypeError('Invalid key length');
    }
    const fingerprint = await sha256(bytes);
    return {
        algo: 'ed25519-public-key',
        publicKey: firstAid.encodeBase64(bytes),
        fingerprint: firstAid.encodeHex(fingerprint),
    };
};

export class MessageSigner {
    static importFromLegacyEd25519(buffer) {
        const bytes = firstAid.toUint8Array(buffer);
        if (32 != bytes.length) {
            throw new TypeError('Invalid key length');
        }
        return {
            algo: 'ed25519-private-key',
            privateKey: firstAid.encodeBase64(bytes),
        };
    }

    constructor(obj) {
        if (!obj || 'ed25519-private-key' != obj.algo) {
            throw new TypeError('Invalid key');
        }
        const privateKey = firstAid.decodeBase64(obj.privateKey);
        if (32 != privateKey.length) {
            throw new TypeError('Invalid key length');
        }
        this.privateKey = privateKey;
    }

    async getPublicKey() {
        if (this.publicKey) {
            return this.publicKey;
        }
        const publicKey = await ed.getPublicKey(this.privateKey);
        this.publicKey = await buildPublicKeyObject(publicKey);
        return this.publicKey;
    }

    async signMessage(message) {
        const dataBytes = firstAid.encodeJson(message);
        const digest = await sha256(dataBytes);
        const signature = await ed.sign(digest, this.privateKey);
        const {publicKey} = await this.getPublicKey();
        return {
            algo: 'sign-ed25519',
            data: firstAid.encodeBase64(dataBytes),
            publicKey: publicKey,
            signature: firstAid.encodeBase64(signature),
        };
    }

    static async verifyMessage(dataObj) {
        //
    }
}
