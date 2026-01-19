import type { SignalDataSet, SignalDataTypeMap, SignalKeyStore } from '../Types';
import type { ILogger } from './logger';
/**
 * Manages pre-key operations with proper concurrency control
 *
 * This class handles pre-key operations (updates and deletions) with:
 * - Queue-based concurrency control (one operation at a time per key type)
 * - Validation of deletions to prevent orphaned references
 * - Support for both transactional and non-transactional operations
 */
export declare class PreKeyManager {
    private readonly store;
    private readonly logger;
    private readonly queues;
    constructor(store: SignalKeyStore, logger: ILogger);
    /**
     * Get or create a queue for a specific key type
     */
    private getQueue;
    /**
     * Process pre-key operations (updates and deletions)
     */
    processOperations(data: SignalDataSet, keyType: keyof SignalDataTypeMap, transactionCache: SignalDataSet, mutations: SignalDataSet, isInTransaction: boolean): Promise<void>;
    /**
     * Process deletions with validation
     */
    private processDeletions;
    /**
     * Validate and process pre-key deletions outside transactions
     */
    validateDeletions(data: SignalDataSet, keyType: keyof SignalDataTypeMap): Promise<void>;
}
//# sourceMappingURL=pre-key-manager.d.ts.map