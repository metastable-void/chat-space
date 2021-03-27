
import * as rand from './random.mjs';
import * as hexUtils from './hex.mjs';
import {toUint8Array} from '/lib/buffer.mjs';


export const fromBytes = (arr) => {
    const bytes = toUint8Array(arr).subarray(0, 16);
    if (16 != bytes.length) {
        throw new TypeError('Insufficient buffer length');
    }
    bytes[6] = bytes[6] & 0x0f ^ 0x40;
    bytes[8] = bytes[8] & 0x3f ^ 0x80;
    const hex = hexUtils.encode(bytes);
    return [
        hex.substr(0, 8),
        hex.substr(8, 4),
        hex.substr(12, 4),
        hex.substr(16, 4),
        hex.substr(20, 12),
    ].join('-');
};

export const random = (insecure) => {
    const bytes = new Uint8Array(16);
    if (insecure) {
        rand.fillInsecure(bytes);
    } else {
        rand.fill(bytes);
    }
    return fromBytes(bytes);
};

export const validate = uuid => !!String(uuid).match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
);
