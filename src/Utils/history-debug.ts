import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { proto } from '../../WAProto'
import type { LIDMapping } from '../Types'
import type { ILogger } from './logger'

/**
 * History sync debug configuration
 */
export interface HistorySyncDebugConfig {
	/** Enable debug logging for history sync */
	enabled: boolean
	/** Directory to save debug files (default: /tmp/baileys-debug) */
	outputDir?: string
	/** Save full payload to JSON files */
	saveToFile?: boolean
	/** Log to console via logger */
	logToConsole?: boolean
	/** Include full conversations in logs (can be large) */
	includeConversations?: boolean
	/** Include full messages in logs (can be very large) */
	includeMessages?: boolean
}

/**
 * Default debug configuration
 */
export const DEFAULT_HISTORY_DEBUG_CONFIG: HistorySyncDebugConfig = {
	enabled: false,
	outputDir: '/tmp/baileys-debug',
	saveToFile: true,
	logToConsole: true,
	includeConversations: false,
	includeMessages: false
}

/**
 * History sync debug data structure
 */
export interface HistorySyncDebugData {
	timestamp: number
	syncType: proto.HistorySync.HistorySyncType | null | undefined
	syncTypeName: string
	progress: number | null | undefined

	// LID-PN mappings (PR #2268)
	hasPhoneNumberMappings: boolean
	phoneNumberMappingsCount: number
	phoneNumberMappings: LIDMapping[]

	// Conversations summary
	conversationsCount: number
	conversationIds?: string[]

	// Messages summary
	messagesCount: number

	// Contacts summary
	contactsCount: number

	// Push names
	pushnamesCount: number

	// Full payload (optional, can be very large)
	fullPayload?: proto.IHistorySync
}

/**
 * Get human-readable sync type name
 */
const getSyncTypeName = (syncType: proto.HistorySync.HistorySyncType | null | undefined): string => {
	if (syncType === null || syncType === undefined) return 'UNKNOWN'

	const names: Record<number, string> = {
		[proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP]: 'INITIAL_BOOTSTRAP',
		[proto.HistorySync.HistorySyncType.INITIAL_STATUS_V3]: 'INITIAL_STATUS_V3',
		[proto.HistorySync.HistorySyncType.FULL]: 'FULL',
		[proto.HistorySync.HistorySyncType.RECENT]: 'RECENT',
		[proto.HistorySync.HistorySyncType.PUSH_NAME]: 'PUSH_NAME',
		[proto.HistorySync.HistorySyncType.NON_BLOCKING_DATA]: 'NON_BLOCKING_DATA',
		[proto.HistorySync.HistorySyncType.ON_DEMAND]: 'ON_DEMAND'
	}

	return names[syncType] || `UNKNOWN_${syncType}`
}

/**
 * Extract debug data from history sync payload
 */
export const extractHistorySyncDebugData = (
	historySync: proto.IHistorySync,
	lidPnMappings: LIDMapping[],
	config: HistorySyncDebugConfig = DEFAULT_HISTORY_DEBUG_CONFIG
): HistorySyncDebugData => {
	const conversations = historySync.conversations || []
	const pushnames = historySync.pushnames || []

	// Count total messages across all conversations
	let messagesCount = 0
	for (const conv of conversations) {
		messagesCount += conv.messages?.length || 0
	}

	const debugData: HistorySyncDebugData = {
		timestamp: Date.now(),
		syncType: historySync.syncType,
		syncTypeName: getSyncTypeName(historySync.syncType),
		progress: historySync.progress,

		// LID-PN mappings
		hasPhoneNumberMappings: lidPnMappings.length > 0,
		phoneNumberMappingsCount: lidPnMappings.length,
		phoneNumberMappings: lidPnMappings,

		// Conversations
		conversationsCount: conversations.length,

		// Messages
		messagesCount,

		// Contacts (extracted from conversations)
		contactsCount: conversations.length,

		// Push names
		pushnamesCount: pushnames.length
	}

	// Include conversation IDs if requested
	if (config.includeConversations) {
		debugData.conversationIds = conversations.map(c => c.id || 'unknown')
	}

	// Include full payload if requested (WARNING: can be very large)
	if (config.includeMessages) {
		debugData.fullPayload = historySync
	}

	return debugData
}

/**
 * Log history sync debug data
 */
export const logHistorySyncDebug = (
	debugData: HistorySyncDebugData,
	logger?: ILogger,
	config: HistorySyncDebugConfig = DEFAULT_HISTORY_DEBUG_CONFIG
): string | undefined => {
	if (!config.enabled) return undefined

	let savedFilePath: string | undefined

	// Log to console via logger
	if (config.logToConsole && logger) {
		const logData = {
			syncType: debugData.syncTypeName,
			progress: debugData.progress,
			lidMappings: {
				found: debugData.hasPhoneNumberMappings,
				count: debugData.phoneNumberMappingsCount,
				samples: debugData.phoneNumberMappings.slice(0, 3).map(m => ({
					pn: m.pn.replace(/\d{4,}/, '***'),  // Mask phone numbers
					lid: m.lid.substring(0, 10) + '...'
				}))
			},
			conversations: debugData.conversationsCount,
			messages: debugData.messagesCount,
			pushnames: debugData.pushnamesCount
		}

		logger.info(logData, '📊 History Sync Debug')

		// Log each LID-PN mapping at debug level
		if (debugData.phoneNumberMappingsCount > 0) {
			logger.debug(
				{ mappings: debugData.phoneNumberMappings },
				`📱 Found ${debugData.phoneNumberMappingsCount} LID-PN mappings in history sync`
			)
		}
	}

	// Save to file
	if (config.saveToFile) {
		const outputDir = config.outputDir || '/tmp/baileys-debug'

		// Ensure directory exists
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true })
		}

		const filename = `history-sync-${debugData.syncTypeName}-${debugData.timestamp}.json`
		savedFilePath = join(outputDir, filename)

		try {
			writeFileSync(savedFilePath, JSON.stringify(debugData, null, 2))
			logger?.info({ path: savedFilePath }, '📁 History sync debug saved to file')
		} catch (err) {
			logger?.warn({ err, path: savedFilePath }, 'Failed to save history sync debug file')
		}
	}

	return savedFilePath
}

/**
 * Create a history sync debug logger instance
 */
export const createHistorySyncDebugger = (
	config: Partial<HistorySyncDebugConfig> = {},
	logger?: ILogger
) => {
	const mergedConfig: HistorySyncDebugConfig = {
		...DEFAULT_HISTORY_DEBUG_CONFIG,
		...config
	}

	return {
		config: mergedConfig,

		/**
		 * Log history sync data
		 */
		log: (historySync: proto.IHistorySync, lidPnMappings: LIDMapping[]) => {
			if (!mergedConfig.enabled) return undefined

			const debugData = extractHistorySyncDebugData(historySync, lidPnMappings, mergedConfig)
			return logHistorySyncDebug(debugData, logger, mergedConfig)
		},

		/**
		 * Enable debug logging
		 */
		enable: () => {
			mergedConfig.enabled = true
		},

		/**
		 * Disable debug logging
		 */
		disable: () => {
			mergedConfig.enabled = false
		}
	}
}
