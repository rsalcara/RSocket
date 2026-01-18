import { SignalAuthState } from '../Types';
import { SignalRepository } from '../Types/Signal';
import { PnFromLIDUSyncFn } from '../Types/Socket';
import { ILogger } from '../Utils/logger';
export declare function makeLibSignalRepository(auth: SignalAuthState, logger?: ILogger, pnFromLIDUSync?: PnFromLIDUSyncFn): SignalRepository;
