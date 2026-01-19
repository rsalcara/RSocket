import { proto } from '../../WAProto';
import { Chat, Contact, LIDMapping } from '../Types';
export declare const downloadHistory: (msg: proto.Message.IHistorySyncNotification, options: RequestInit) => Promise<proto.HistorySync>;
export declare const processHistoryMessage: (item: proto.IHistorySync) => {
    chats: Chat[];
    contacts: Contact[];
    messages: proto.IWebMessageInfo[];
    syncType: proto.HistorySync.HistorySyncType;
    progress: number | null | undefined;
    lidPnMappings: LIDMapping[];
};
export declare const downloadAndProcessHistorySyncNotification: (msg: proto.Message.IHistorySyncNotification, options: RequestInit) => Promise<{
    chats: Chat[];
    contacts: Contact[];
    messages: proto.IWebMessageInfo[];
    syncType: proto.HistorySync.HistorySyncType;
    progress: number | null | undefined;
    lidPnMappings: LIDMapping[];
}>;
export declare const getHistoryMsg: (message: proto.IMessage) => proto.Message.IHistorySyncNotification | null | undefined;
//# sourceMappingURL=history.d.ts.map