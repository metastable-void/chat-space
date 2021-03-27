
import {toUint8Array} from './buffer.mjs';

let nodeCrypto;
const cryptoPromise = new Promise((res) => {
    import('crypto').then(c => {
        nodeCrypto = c;
        res(c);
    }).catch(e => {
        res(void 0);
        // ignore errors
    });
});


/**
 * Not-for-cryptography random bytes.
 * @param {ArrayBuffer|TypedArray} buffer Buffer to fill with random values.
 * @returns {Uint8Array} Buffer filled with random bytes.
 */
 export const fillInsecure = (buffer) => {
    const bytes = toUint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (Math.random() * 256) & 255;
    }
    return bytes;
};

/**
 * Secure random bytes.
 * @param {ArrayBuffer|TypedArray} buffer Buffer to fill with random values.
 * @returns {Uint8Array} Buffer filled with random bytes.
 */
export const fill = (buffer) => {
    const bytes = toUint8Array(buffer);
    if ('object' == typeof crypto && crypto && 'function' == typeof crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else if (nodeCrypto && 'function' == typeof nodeCrypto.randomFillSync) {
        nodeCrypto.randomFillSync(bytes);
    } else {
        throw new Error('No secure randomness source available');
    }
    return bytes;
};
