"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Defaults_1 = require("../Defaults");
const business_1 = require("./business");
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...Defaults_1.DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    // If the user hasn't provided their own history sync function,
    // let's create a default one that respects the syncFullHistory flag.
    if (config.shouldSyncHistoryMessage === undefined) {
        newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory;
    }
    return (0, business_1.makeBusinessSocket)(newConfig);
};
exports.default = makeWASocket;
//# sourceMappingURL=index.js.map