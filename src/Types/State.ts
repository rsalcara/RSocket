import { Boom } from '@hapi/boom'
import type { Contact } from './Contact'

export type WAConnectionState = 'open' | 'connecting' | 'close'

/**
 * Sync state machine for better sync handling
 * Used to track the synchronization progress during connection
 */
export enum SyncState {
	/** Initial state - connection is being established */
	Connecting = 'Connecting',
	/** Connection open, waiting for initial sync notification */
	AwaitingInitialSync = 'AwaitingInitialSync',
	/** Actively syncing app state */
	Syncing = 'Syncing',
	/** Sync complete, fully online */
	Online = 'Online'
}

export type ConnectionState = {
	/** connection is now open, connecting or closed */
	connection: WAConnectionState
	/** the error that caused the connection to close */
	lastDisconnect?: {
		error: Boom | Error | undefined
		date: Date
	}
	/** is this a new login */
	isNewLogin?: boolean
	/** the current QR code */
	qr?: string
	/** has the device received all pending notifications while it was offline */
	receivedPendingNotifications?: boolean
	/** legacy connection options */
	legacy?: {
		phoneConnected: boolean
		user?: Contact
	}
	/**
	 * if the client is shown as an active, online client.
	 * If this is false, the primary phone and other devices will receive notifs
	 * */
	isOnline?: boolean
}
