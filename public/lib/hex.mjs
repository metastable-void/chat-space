
import {toUint8Array} from './buffer.mjs';

/**
 * Convert Uint8Array to hex string.
 * @param bytes {Uint8Array}
 * @returns {string}
 */
export const encode = (bytes) => Array.prototype.map.call(
    toUint8Array(bytes),
    byte => (byte | 0x100).toString(0x10).slice(-2)
).join('');

/**
 * Convert hex string into Uint8Array.
 * @param hex {string}
 * @returns {Uint8Array}
 */
export const decode = (hex) => {
    if ('string' != typeof hex) throw new TypeError('Not a string');
    if (hex.length & 1) throw new TypeError('Invalid length');
    if (hex.includes('.')) throw new TypeError('Invalid hex string');
    return new Uint8Array(function* () {
        for (let i = 0; i < (hex.length >>> 1); i++) {
            const byteHex = hex.substr(i << 1, 2).trim();
            if (byteHex.length != 2) {
                throw new TypeError('Invalid hex string');
            }
            const byte = Number('0x' + byteHex);
            if (isNaN(byte)) {
                throw new TypeError('Invalid hex string');
            }
            yield byte;
        }
    }());
};
