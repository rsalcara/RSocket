import makeWASocket, { makeWASocketAsync, clearWaVersionCache, getCachedWaVersion } from './Socket';
export * from '../WAProto';
export * from './Utils';
export * from './Types';
export * from './Defaults';
export * from './WABinary';
export * from './WAM';
export * from './WAUSync';
export type WASocket = ReturnType<typeof makeWASocket>;
export type WASocketAsync = Awaited<ReturnType<typeof makeWASocketAsync>>;
export { makeWASocket, makeWASocketAsync, clearWaVersionCache, getCachedWaVersion };
export default makeWASocket;
//# sourceMappingURL=index.d.ts.map