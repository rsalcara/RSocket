import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeBusinessSocket } from './business.js';
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    // If the user hasn't provided their own history sync function,
    // let's create a default one that respects the syncFullHistory flag.
    if (config.shouldSyncHistoryMessage === undefined) {
        newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory;
    }
    return makeBusinessSocket(newConfig);
};
export default makeWASocket;
//# sourceMappingURL=index.js.map