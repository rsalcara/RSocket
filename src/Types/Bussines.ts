import { proto } from '../../WAProto'

/**
 * Day of week for business hours
 */
export type DayOfWeekBussines = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

/**
 * Business hours configuration for a specific day
 */
export type HoursDay =
	| { day: DayOfWeekBussines; mode: 'specific_hours'; openTimeInMinutes: string; closeTimeInMinutes: string }
	| { day: DayOfWeekBussines; mode: 'open_24h' | 'appointment_only' }

/**
 * Properties for updating business profile
 */
export type UpdateBussinesProfileProps = {
	address?: string
	websites?: string[]
	email?: string
	description?: string
	hours?: {
		timezone: string
		days: HoursDay[]
	}
}

/**
 * Quick reply action for business accounts
 */
export type QuickReplyAction = {
	/** Shortcut keyword for the quick reply */
	shortcut?: string
	/** Message content of the quick reply */
	message?: string
	/** Keywords that trigger this quick reply */
	keywords?: string[]
	/** Usage count */
	count?: number
	/** Whether this quick reply is deleted */
	deleted?: boolean
	/** Timestamp of the quick reply */
	timestamp?: string
}

/**
 * Interface for quick reply action from proto
 */
export type IQuickReplyAction = proto.SyncActionValue.IQuickReplyAction
