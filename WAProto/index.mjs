// ESM wrapper for CommonJS WAProto
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const $root = require('./index.js');

export const proto = $root.proto;
export default $root;
