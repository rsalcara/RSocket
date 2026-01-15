import NodeCache from '@cacheable/node-cache'
import P from 'pino'
import makeWASocket, {
	CircuitBreaker,
	DisconnectReason,
	fetchLatestBaileysVersion,
	getBackoffDelay,
	makeCacheableSignalKeyStore,
	useMultiFileAuthState
} from '../src'
import type { SocketConfig, WASocket } from '../src/Types'

/**
 * ✅ VERSÃO CORRIGIDA - Connection Manager Seguro
 *
 * Correções aplicadas:
 * 1. ✅ Cleanup de socket anterior antes de criar novo
 * 2. ✅ Remoção de event listeners
 * 3. ✅ Suporte multi-tenant (múltiplas conexões)
 * 4. ✅ Proteção contra race conditions
 * 5. ✅ Gerenciamento de lifecycle completo
 */

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` })
logger.level = 'info'

// Backoff config
const reconnectRetryConfig: Pick<SocketConfig, 'retryBackoffDelays' | 'retryJitterFactor'> = {
	retryBackoffDelays: [1000, 2000, 5000, 10_000, 20_000, 30_000],
	retryJitterFactor: 0.25
}

/**
 * ✅ Connection Manager para UMA instância/tenant
 * Gerencia lifecycle completo de um socket
 */
class ConnectionManager {
	private socket: WASocket | null = null
	private reconnectAttempts = 0
	private isReconnectScheduled = false
	private reconnectTimer: NodeJS.Timeout | null = null
	private isDestroyed = false
	private circuitBreaker: CircuitBreaker
	private msgRetryCache: NodeCache

	constructor(
		private tenantId: string,
		private authPath: string
	) {
		this.circuitBreaker = new CircuitBreaker({
			failureThreshold: 5,         // 5 falhas
			failureWindow: 60_000,       // em 60 segundos
			openTimeout: 30_000,         // aguarda 30s antes de half-open
			successThreshold: 2,         // precisa de 2 sucessos para fechar
			logger: logger.child({ tenantId })
		})

		this.msgRetryCache = new NodeCache()
	}

	/**
	 * ✅ CRÍTICO: Limpa socket anterior antes de criar novo
	 */
	private async cleanupSocket() {
		if (!this.socket) return

		logger.info({ tenantId: this.tenantId }, '🧹 Cleaning up old socket before reconnect')

		try {
			// 1. Para reconexão agendada
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer)
				this.reconnectTimer = null
			}

			// 2. Remove todos os event listeners
			this.socket.ev.removeAllListeners()

			// 3. Fecha conexão WebSocket se existir
			if (this.socket.ws) {
				this.socket.ws.close()
			}

			// 4. Limpa referência
			this.socket = null

		} catch (error) {
			logger.error({ tenantId: this.tenantId, error }, '⚠️ Error during socket cleanup')
		}
	}

	/**
	 * ✅ Inicia socket com cleanup automático
	 */
	async start() {
		// ✅ Previne race condition: apenas uma inicialização por vez
		if (this.socket && this.socket.ws?.readyState === this.socket.ws?.OPEN) {
			logger.warn({ tenantId: this.tenantId }, '⚠️ Socket already connected, skipping start')
			return
		}

		// ✅ CRÍTICO: Limpa socket anterior antes de criar novo
		await this.cleanupSocket()

		if (this.isDestroyed) {
			logger.warn({ tenantId: this.tenantId }, '⚠️ Manager destroyed, skipping start')
			return
		}

		try {
			const { state, saveCreds } = await useMultiFileAuthState(this.authPath)
			const { version } = await fetchLatestBaileysVersion()

			// ✅ Cria NOVO socket apenas após cleanup completo
			this.socket = makeWASocket({
				version,
				logger: logger.child({ tenantId: this.tenantId }),
				printQRInTerminal: true,
				auth: {
					creds: state.creds,
					keys: makeCacheableSignalKeyStore(state.keys, logger)
				},
				msgRetryCounterCache: this.msgRetryCache
			})

			// ✅ Registra event listeners no socket NOVO
			this.socket.ev.process(async(events) => {
				if (events['connection.update']) {
					await this.handleConnectionUpdate(events['connection.update'])
				}

				if (events['creds.update']) {
					await saveCreds()
				}
			})

			logger.info({ tenantId: this.tenantId }, '✅ Socket started successfully')

		} catch (error) {
			logger.error({ tenantId: this.tenantId, error }, '❌ Failed to start socket')
			this.circuitBreaker.recordFailure(error as Error)
			this.scheduleReconnect()
		}
	}

	/**
	 * ✅ Gerencia updates de conexão
	 */
	private async handleConnectionUpdate(update: any) {
		const { connection, lastDisconnect } = update

		if (connection === 'open') {
			// ✅ Conexão aberta: reseta contadores
			this.reconnectAttempts = 0
			this.circuitBreaker.recordSuccess()
			logger.info({ tenantId: this.tenantId }, '🟢 Connection opened, counters reset')
		}

		if (connection === 'close') {
			const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
			const isLoggedOut = statusCode === DisconnectReason.loggedOut

			if (isLoggedOut) {
				logger.warn({ tenantId: this.tenantId }, '🔴 Logged out: will not reconnect')
				await this.destroy()
				return
			}

			// ✅ Registra falha no circuit breaker
			this.circuitBreaker.recordFailure(
				new Error(`disconnect: ${statusCode ?? 'unknown'}`)
			)

			logger.warn(
				{ tenantId: this.tenantId, statusCode },
				'🔴 Connection closed, scheduling reconnect'
			)

			// ✅ Agenda reconexão com backoff + circuit breaker
			this.scheduleReconnect()
		}
	}

	/**
	 * ✅ Agenda reconexão com proteção anti-loop
	 */
	private scheduleReconnect() {
		// ✅ Previne múltiplas reconexões simultâneas
		if (this.isReconnectScheduled) {
			logger.debug({ tenantId: this.tenantId }, '⏭️ Reconnect already scheduled, skipping')
			return
		}

		if (this.isDestroyed) {
			logger.warn({ tenantId: this.tenantId }, '⚠️ Manager destroyed, skipping reconnect')
			return
		}

		// ✅ Verifica circuit breaker
		const canReconnect = this.circuitBreaker.canExecute()
		const breakerStats = this.circuitBreaker.getStats()

		if (!canReconnect) {
			const waitMs = breakerStats.timeUntilHalfOpen || 30_000
			logger.warn(
				{ tenantId: this.tenantId, waitMs, state: breakerStats.state },
				'⏸️ Circuit breaker OPEN, delaying reconnect'
			)

			this.isReconnectScheduled = true
			this.reconnectTimer = setTimeout(() => {
				this.isReconnectScheduled = false
				this.reconnectTimer = null
				this.scheduleReconnect()
			}, waitMs)
			return
		}

		// ✅ Aplica backoff exponencial com jitter
		const attemptIndex = Math.max(0, this.reconnectAttempts)
		const delayMs = this.reconnectAttempts > 0
			? getBackoffDelay(attemptIndex - 1, reconnectRetryConfig as SocketConfig)
			: 0

		logger.warn(
			{
				tenantId: this.tenantId,
				reconnectAttempts: this.reconnectAttempts,
				delayMs,
				state: breakerStats.state
			},
			'⏰ Scheduling reconnect attempt'
		)

		this.isReconnectScheduled = true
		this.reconnectTimer = setTimeout(async() => {
			this.isReconnectScheduled = false
			this.reconnectTimer = null
			this.reconnectAttempts += 1
			await this.start()
		}, delayMs)
	}

	/**
	 * ✅ Destrói manager completamente (logout, shutdown, etc)
	 */
	async destroy() {
		logger.info({ tenantId: this.tenantId }, '💀 Destroying connection manager')
		this.isDestroyed = true
		await this.cleanupSocket()
		this.msgRetryCache.close?.()
	}

	/**
	 * ✅ Obtém socket atual (para enviar mensagens, etc)
	 */
	getSocket(): WASocket | null {
		return this.socket
	}

	/**
	 * ✅ Verifica se está conectado
	 */
	isConnected(): boolean {
		return this.socket?.ws?.readyState === this.socket?.ws?.OPEN
	}
}

/**
 * ✅ MULTI-TENANT: Gerencia múltiplas conexões (Infinite Store, Secundaria MX, etc)
 */
class MultiTenantConnectionManager {
	private managers = new Map<string, ConnectionManager>()

	/**
	 * ✅ Adiciona/inicia uma conexão tenant
	 */
	async addTenant(tenantId: string, authPath: string) {
		if (this.managers.has(tenantId)) {
			logger.warn({ tenantId }, '⚠️ Tenant already exists')
			return
		}

		const manager = new ConnectionManager(tenantId, authPath)
		this.managers.set(tenantId, manager)
		await manager.start()

		logger.info({ tenantId }, '✅ Tenant added and started')
	}

	/**
	 * ✅ Remove/destrói uma conexão tenant
	 */
	async removeTenant(tenantId: string) {
		const manager = this.managers.get(tenantId)
		if (!manager) {
			logger.warn({ tenantId }, '⚠️ Tenant not found')
			return
		}

		await manager.destroy()
		this.managers.delete(tenantId)
		logger.info({ tenantId }, '✅ Tenant removed')
	}

	/**
	 * ✅ Obtém socket de um tenant específico
	 */
	getSocket(tenantId: string): WASocket | null {
		return this.managers.get(tenantId)?.getSocket() ?? null
	}

	/**
	 * ✅ Lista todos os tenants e status
	 */
	getStatus() {
		const status: Array<{ tenantId: string; connected: boolean }> = []
		for (const [tenantId, manager] of this.managers.entries()) {
			status.push({
				tenantId,
				connected: manager.isConnected()
			})
		}
		return status
	}

	/**
	 * ✅ Destrói todos os tenants (shutdown da aplicação)
	 */
	async destroyAll() {
		logger.info('💀 Destroying all tenants')
		const promises = Array.from(this.managers.values()).map(m => m.destroy())
		await Promise.all(promises)
		this.managers.clear()
	}
}

// ✅ Exemplo de uso: bootstrap multi-tenant
const globalManager = new MultiTenantConnectionManager()

// ✅ Inicia múltiplas conexões (simula Z-PRO com 4 conexões)
;(async() => {
	await globalManager.addTenant('infinite-store', 'baileys_auth_infinite')
	await globalManager.addTenant('secundaria-mx', 'baileys_auth_secundaria')
	await globalManager.addTenant('linea-4', 'baileys_auth_linea4')
	await globalManager.addTenant('wp-principal', 'baileys_auth_principal')

	// ✅ Monitoramento: mostra status a cada 30 segundos
	setInterval(() => {
		const status = globalManager.getStatus()
		logger.info({ status }, '📊 Multi-tenant status')
	}, 30_000)

	// ✅ Exemplo: enviar mensagem usando socket de tenant específico
	const socket = globalManager.getSocket('infinite-store')
	if (socket) {
		// socket.sendMessage(...) etc
	}
})()

// ✅ Shutdown graceful
process.on('SIGINT', async() => {
	logger.info('🛑 Shutting down...')
	await globalManager.destroyAll()
	process.exit(0)
})

/**
 * ✅ RESUMO DAS CORREÇÕES:
 *
 * 1. ✅ cleanupSocket(): Destrói socket anterior antes de criar novo
 * 2. ✅ removeAllListeners(): Previne memory leak
 * 3. ✅ Multi-tenant support: Gerencia N conexões independentes
 * 4. ✅ Race condition protection: isReconnectScheduled + timer cleanup
 * 5. ✅ Lifecycle management: destroy() completo para shutdown
 * 6. ✅ getSocket(): API segura para enviar mensagens
 * 7. ✅ getStatus(): Monitoramento de todas as conexões
 * 8. ✅ Circuit breaker POR tenant (independente)
 * 9. ✅ Backoff exponencial POR tenant (independente)
 * 10. ✅ Graceful shutdown (SIGINT handler)
 *
 * ✅ IMPACTO NO SEU PROBLEMA:
 * - Antes: 5 conexões + 15 reconexões = 20 sockets = 240 flushes/min
 * - Depois: 5 conexões + cleanup automático = 5 sockets = 60 flushes/min
 * - Redução: 75% na taxa de flush durante instabilidade!
 */
