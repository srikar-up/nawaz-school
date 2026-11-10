/**
 * UTF-8-only stand-in for iconv-lite.
 *
 * Express 4 pulls in body-parser, which pulls in iconv-lite, whose CommonJS
 * stream shim does not load in the Workers runtime. The API only ever accepts
 * JSON/UTF-8, so a tiny decoder is enough - and it keeps Express bootable on
 * Workers without patching node_modules.
 */
export function encodingExists(encoding) {
  return /^utf-?8$/i.test(String(encoding || 'utf8'));
}

export function getDecoder(encoding) {
  if (!encodingExists(encoding)) {
    throw new Error(`Encoding not recognized: '${encoding}'`);
  }
  const textDecoder = new TextDecoder('utf-8');
  return {
    write(chunk) {
      return textDecoder.decode(chunk, { stream: true });
    },
    end() {
      return textDecoder.decode();
    },
  };
}

export function decode(buffer, encoding = 'utf8') {
  if (!encodingExists(encoding)) {
    throw new Error(`Encoding not recognized: '${encoding}'`);
  }
  return new TextDecoder('utf-8').decode(buffer);
}

export function encode(text) {
  return new TextEncoder().encode(String(text));
}

export default { encodingExists, getDecoder, decode, encode };
