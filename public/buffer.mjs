
export const TypedArray = Reflect.getPrototypeOf(Uint8Array);

export const toUint8Array = (buffer) => {
    let bytes;
    if (buffer instanceof ArrayBuffer) {
        bytes = new Uint8Array(buffer);
    } else if (buffer instanceof TypedArray) {
        bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
        throw new TypeError('Not a buffer');
    }
    return bytes;
};
