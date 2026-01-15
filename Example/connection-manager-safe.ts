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
 * ✅ Connection Manager Seguro - Versão Melhorada
 *
 * Melhorias críticas aplicadas:
 * 1. ✅ closeSocket() - Fecha socket explicitamente antes de criar novo
 * 2. ✅ pendingManualClose - Diferencia close intencional de desconexão
 * 3. ✅ isStarting flag - Previne múltiplas inicializações simultâneas
 * 4. ✅ Cleanup automático de socket anterior (previne sockets órfãos)
 * 5. ✅ Suporte multi-tenant (múltiplas conexões independentes)
 * 6. ✅ Circuit breaker por tenant (previne loops de reconexão)
 * 7. ✅ Backoff exponencial com jitter (reduz thundering herd)
 * 8. ✅ Logs detalhados para debugging
 *
 * Trabalha em conjunto com ev.destroy() (implementado no core) para garantir
 * que tanto sockets quanto buffers sejam limpos corretamente.
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
 * Gerencia lifecycle completo de um socket com todas as proteções necessárias
 */
class ConnectionManager {
	private socket: WASocket | null = null
	private reconnectAttempts = 0
	private isReconnectScheduled = false
	private isStarting = false
	private pendingManualClose = 0
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

		logger.info({ tenantId }, '✅ Connection manager initialized')
	}

	/**
	 * ✅ CRÍTICO: Fecha socket explicitamente antes de criar novo
	 * Previne sockets órfãos que continuam rodando em background
	 */
	private closeSocket(reason?: string) {
		if (!this.socket) {
			logger.debug({ tenantId: this.tenantId }, 'closeSocket: no socket to close')
			return
		}

		this.pendingManualClose += 1
		logger.info({
			tenantId: this.tenantId,
			reason,
			pendingManualClose: this.pendingManualClose
		}, '🔌 Closing socket intentionally')

		try {
			// Usa socket.end() se disponível, caso contrário fecha WebSocket diretamente
			if (typeof (this.socket as any).end === 'function') {
				(this.socket as any).end(reason ? new Error(reason) : undefined)
			} else if (this.socket.ws) {
				this.socket.ws.close()
			}

			// Remove listeners para prevenir memory leak
			this.socket.ev.removeAllListeners()
		} catch (error) {
			logger.warn({ tenantId: this.tenantId, error }, '⚠️ Failed to close socket cleanly')
		} finally {
			this.socket = null
		}
	}

	/**
	 * ✅ Inicia socket com todas as proteções
	 */
	async start() {
		// Proteção 1: Previne múltiplas inicializações simultâneas
		if (this.isStarting) {
			logger.warn({ tenantId: this.tenantId }, '⚠️ Start already in progress, skipping')
			return
		}

		// Proteção 2: Verifica se já está conectado
		if (this.socket?.ws?.readyState === 1) { // WebSocket.OPEN = 1
			logger.warn({ tenantId: this.tenantId }, '⚠️ Socket already connected, skipping start')
			return
		}

		// Proteção 3: Verifica se foi destruído
		if (this.isDestroyed) {
			logger.warn({ tenantId: this.tenantId }, '⚠️ Manager destroyed, skipping start')
			return
		}

		this.isStarting = true
		logger.info({
			tenantId: this.tenantId,
			reconnectAttempts: this.reconnectAttempts
		}, '🚀 Starting socket connection')

		// ✅ CRÍTICO: Fecha socket anterior antes de criar novo
		this.closeSocket('starting new connection')

		try {
			const { state, saveCreds } = await useMultiFileAuthState(this.authPath)
			const { version } = await fetchLatestBaileysVersion()

			logger.debug({ tenantId: this.tenantId, version }, 'Fetched Baileys version')

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

			logger.debug({ tenantId: this.tenantId }, 'Socket instance created, registering event handlers')

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
		} finally {
			this.isStarting = false
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
			logger.info({
				tenantId: this.tenantId,
				circuitState: this.circuitBreaker.getStats().state
			}, '🟢 Connection opened, counters reset')
		}

		if (connection === 'close') {
			// ✅ CRÍTICO: Diferencia close intencional de desconexão real
			if (this.pendingManualClose > 0) {
				this.pendingManualClose -= 1
				logger.info({
					tenantId: this.tenantId,
					remainingPendingCloses: this.pendingManualClose
				}, '🔌 Socket closed intentionally, skipping reconnect')
				return
			}

			const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
			const isLoggedOut = statusCode === DisconnectReason.loggedOut

			logger.warn({
				tenantId: this.tenantId,
				statusCode,
				isLoggedOut,
				error: lastDisconnect?.error?.message
			}, '🔴 Connection closed')

			if (isLoggedOut) {
				logger.warn({ tenantId: this.tenantId }, '🚪 Logged out: will not reconnect')
				await this.destroy()
				return
			}

			// ✅ Registra falha no circuit breaker
			this.circuitBreaker.recordFailure(
				new Error(`disconnect: ${statusCode ?? 'unknown'}`)
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
				{
					tenantId: this.tenantId,
					waitMs,
					state: breakerStats.state,
					failures: breakerStats.failureCount
				},
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
		if (this.isDestroyed) {
			logger.debug({ tenantId: this.tenantId }, 'destroy() called on already destroyed manager')
			return
		}

		logger.info({ tenantId: this.tenantId }, '💀 Destroying connection manager')
		this.isDestroyed = true

		// Para timer de reconexão
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		// Fecha socket
		this.closeSocket('manager destroyed')

		// Limpa cache
		if (this.msgRetryCache && typeof this.msgRetryCache.close === 'function') {
			this.msgRetryCache.close()
		}

		logger.info({ tenantId: this.tenantId }, '✅ Connection manager destroyed')
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
		return this.socket?.ws?.readyState === 1 // WebSocket.OPEN = 1
	}

	/**
	 * ✅ Obtém estatísticas do circuit breaker
	 */
	getCircuitBreakerStats() {
		return this.circuitBreaker.getStats()
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
			logger.warn({ tenantId }, '⚠️ Tenant already exists, returning existing manager')
			return this.managers.get(tenantId)!
		}

		logger.info({ tenantId, authPath }, '➕ Adding new tenant')
		const manager = new ConnectionManager(tenantId, authPath)
		this.managers.set(tenantId, manager)
		await manager.start()

		logger.info({ tenantId }, '✅ Tenant added and started')
		return manager
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

		logger.info({ tenantId }, '➖ Removing tenant')
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
	 * ✅ Obtém manager de um tenant específico
	 */
	getManager(tenantId: string): ConnectionManager | undefined {
		return this.managers.get(tenantId)
	}

	/**
	 * ✅ Lista todos os tenants e status
	 */
	getStatus() {
		const status: Array<{
			tenantId: string
			connected: boolean
			circuitState: string
			reconnectAttempts: number
		}> = []

		for (const [tenantId, manager] of this.managers.entries()) {
			const stats = manager.getCircuitBreakerStats()
			status.push({
				tenantId,
				connected: manager.isConnected(),
				circuitState: stats.state,
				reconnectAttempts: (manager as any).reconnectAttempts || 0
			})
		}
		return status
	}

	/**
	 * ✅ Destrói todos os tenants (shutdown da aplicação)
	 */
	async destroyAll() {
		logger.info({ count: this.managers.size }, '💀 Destroying all tenants')
		const promises = Array.from(this.managers.values()).map(m => m.destroy())
		await Promise.all(promises)
		this.managers.clear()
		logger.info('✅ All tenants destroyed')
	}
}

// ✅ Exemplo de uso: bootstrap multi-tenant
const globalManager = new MultiTenantConnectionManager()

// ✅ Inicia múltiplas conexões (simula Z-PRO com 4 conexões)
;(async() => {
	logger.info('🚀 Starting multi-tenant connection manager example')

	try {
		await globalManager.addTenant('infinite-store', 'baileys_auth_infinite')
		await globalManager.addTenant('secundaria-mx', 'baileys_auth_secundaria')
		await globalManager.addTenant('linea-4', 'baileys_auth_linea4')
		await globalManager.addTenant('wp-principal', 'baileys_auth_principal')

		logger.info('✅ All tenants initialized')
	} catch (error) {
		logger.error({ error }, '❌ Failed to initialize tenants')
	}

	// ✅ Monitoramento: mostra status a cada 30 segundos
	setInterval(() => {
		const status = globalManager.getStatus()
		logger.info({ status }, '📊 Multi-tenant status')
	}, 30_000)

	// ✅ Exemplo: enviar mensagem usando socket de tenant específico
	setTimeout(() => {
		const socket = globalManager.getSocket('infinite-store')
		if (socket) {
			logger.info('💬 Socket available for messaging')
			// socket.sendMessage(...) etc
		} else {
			logger.warn('⚠️ Socket not available')
		}
	}, 5000)
})()

// ✅ Shutdown graceful
process.on('SIGINT', async() => {
	logger.info('🛑 Received SIGINT, shutting down...')
	await globalManager.destroyAll()
	process.exit(0)
})

process.on('SIGTERM', async() => {
	logger.info('🛑 Received SIGTERM, shutting down...')
	await globalManager.destroyAll()
	process.exit(0)
})

/**
 * ✅ RESUMO DAS MELHORIAS CRÍTICAS:
 *
 * 1. ✅ closeSocket() com pendingManualClose counter
 *    - Fecha socket explicitamente antes de criar novo
 *    - Diferencia close intencional de desconexão
 *    - Previne reconexão desnecessária em close intencional
 *
 * 2. ✅ isStarting flag
 *    - Previne múltiplas inicializações simultâneas
 *    - Protege contra race conditions
 *
 * 3. ✅ Logs detalhados em todas as operações
 *    - Facilita debugging em produção
 *    - Rastreia lifecycle completo do socket
 *
 * 4. ✅ Circuit breaker stats expostos
 *    - Permite monitoramento externo
 *    - Facilita troubleshooting
 *
 * 5. ✅ Multi-tenant robusto
 *    - Cada tenant com seu próprio circuit breaker
 *    - Isolamento completo entre conexões
 *    - Shutdown graceful de todos os tenants
 *
 * ✅ TRABALHA EM CONJUNTO COM ev.destroy():
 * - Connection Manager: fecha SOCKET antes de criar novo
 * - ev.destroy(): fecha BUFFER quando socket fecha
 * - Resultado: Zero sockets órfãos + zero buffers órfãos = taxa de flush consistente
 */
