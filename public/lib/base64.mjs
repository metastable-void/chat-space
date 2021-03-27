
import {toUint8Array} from './buffer.mjs';

/**
 * Encode bytes into a base64 string.
 * @param bytes {Uint8Array}
 * @returns {string} Base64 string.
 */
export const encode = bytes => btoa(Array.prototype.map.call(
    toUint8Array(bytes),
    byte => String.fromCharCode(byte)
).join(''));

/**
 * Decode a base64-encoded string into Uint8Array.
 * @param base64 {string} Base64-encoded string.
 * @returns {Uint8Array} bytes.
 */
export const decode = base64 => new Uint8Array(Array.prototype.map.call(
    atob(base64),
    byteStr => byteStr.charCodeAt(0)
));
