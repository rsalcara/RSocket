import type { SignalKeyStoreWithTransaction } from '../Types';
import type { BinaryNode } from '../WABinary';
type TcTokenParams = {
    jid: string;
    baseContent?: BinaryNode[];
    authState: {
        keys: SignalKeyStoreWithTransaction;
    };
};
export declare function buildTcTokenFromJid({ authState, jid, baseContent }: TcTokenParams): Promise<BinaryNode[] | undefined>;
export {};
//# sourceMappingURL=tc-token-utils.d.ts.map