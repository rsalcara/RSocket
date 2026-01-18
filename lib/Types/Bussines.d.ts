import { proto } from '../../WAProto';
/**
 * Quick reply action for business accounts
 */
export type QuickReplyAction = {
    /** Shortcut keyword for the quick reply */
    shortcut?: string;
    /** Message content of the quick reply */
    message?: string;
    /** Keywords that trigger this quick reply */
    keywords?: string[];
    /** Usage count */
    count?: number;
    /** Whether this quick reply is deleted */
    deleted?: boolean;
    /** Timestamp of the quick reply */
    timestamp?: string;
};
/**
 * Interface for quick reply action from proto
 */
export type IQuickReplyAction = proto.SyncActionValue.IQuickReplyAction;
