
const textEncoder = new TextEncoder;
const textDecoder = new TextDecoder;

export const encode = str => textEncoder.encode(str);
export const decode = bytes => textDecoder.decode(bytes);
