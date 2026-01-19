"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStructuredLogger = exports.adaptedLog = exports.legacyLoggerAdapter = exports.setStructuredLogger = exports.getStructuredLogger = exports.useStructuredLogs = exports.getBaileysLogLevel = exports.createBaileysLogger = void 0;
__exportStar(require("./generics"), exports);
__exportStar(require("./decode-wa-message"), exports);
__exportStar(require("./messages"), exports);
__exportStar(require("./messages-media"), exports);
__exportStar(require("./validate-connection"), exports);
__exportStar(require("./crypto"), exports);
__exportStar(require("./signal"), exports);
__exportStar(require("./noise-handler"), exports);
__exportStar(require("./history"), exports);
__exportStar(require("./history-debug"), exports);
__exportStar(require("./chat-utils"), exports);
__exportStar(require("./lt-hash"), exports);
__exportStar(require("./auth-utils"), exports);
__exportStar(require("./baileys-event-stream"), exports);
__exportStar(require("./use-multi-file-auth-state"), exports);
__exportStar(require("./link-preview"), exports);
__exportStar(require("./event-buffer"), exports);
__exportStar(require("./process-message"), exports);
__exportStar(require("./circuit-breaker"), exports);
__exportStar(require("./baileys-logger"), exports);
__exportStar(require("./retry-utils"), exports);
__exportStar(require("./trace-context"), exports);
__exportStar(require("./jid-utils"), exports);
__exportStar(require("./prometheus-metrics"), exports);
__exportStar(require("./message-retry-manager"), exports);
// Structured logger and adapter - explicit exports to avoid conflicts
var structured_logger_1 = require("./structured-logger");
Object.defineProperty(exports, "createBaileysLogger", { enumerable: true, get: function () { return structured_logger_1.createBaileysLogger; } });
Object.defineProperty(exports, "getBaileysLogLevel", { enumerable: true, get: function () { return structured_logger_1.getBaileysLogLevel; } });
var logger_adapter_1 = require("./logger-adapter");
Object.defineProperty(exports, "useStructuredLogs", { enumerable: true, get: function () { return logger_adapter_1.useStructuredLogs; } });
Object.defineProperty(exports, "getStructuredLogger", { enumerable: true, get: function () { return logger_adapter_1.getStructuredLogger; } });
Object.defineProperty(exports, "setStructuredLogger", { enumerable: true, get: function () { return logger_adapter_1.setStructuredLogger; } });
Object.defineProperty(exports, "legacyLoggerAdapter", { enumerable: true, get: function () { return logger_adapter_1.legacyLoggerAdapter; } });
Object.defineProperty(exports, "adaptedLog", { enumerable: true, get: function () { return logger_adapter_1.adaptedLog; } });
Object.defineProperty(exports, "isStructuredLogger", { enumerable: true, get: function () { return logger_adapter_1.isStructuredLogger; } });
//# sourceMappingURL=index.js.map