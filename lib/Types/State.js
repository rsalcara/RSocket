"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncState = void 0;
/**
 * Sync state machine for better sync handling
 * Used to track the synchronization progress during connection
 */
var SyncState;
(function (SyncState) {
    /** Initial state - connection is being established */
    SyncState["Connecting"] = "Connecting";
    /** Connection open, waiting for initial sync notification */
    SyncState["AwaitingInitialSync"] = "AwaitingInitialSync";
    /** Actively syncing app state */
    SyncState["Syncing"] = "Syncing";
    /** Sync complete, fully online */
    SyncState["Online"] = "Online";
})(SyncState || (exports.SyncState = SyncState = {}));
