import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { z } from 'zod'
import { PortManager } from './port-manager.js'
import { ApiService } from './api-service.js'


// Server instance tracking
export interface MockServerInstance {
  apiId: string
  port: number
  process: ChildProcess
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  startedAt: Date
  lastHealthCheck?: Date
  errorCount: number
  restartCount: number
}

// Configuration schemas
const ServerStartRequestSchema = z.object({
  apiId: z.string().min(1),
  force: z.boolean().default(false),
})

const ServerStopRequestSchema = z.object({
  apiId: z.string().min(1),
  graceful: z.boolean().default(true),
})

export type ServerStartRequest = z.infer<typeof ServerStartRequestSchema>
export type ServerStopRequest = z.infer<typeof ServerStopRequestSchema>

export class MockServerManager {
  private servers = new Map<string, MockServerInstance>()
  private portManager: PortManager
  private apiService: ApiService
  private healthCheckInterval?: NodeJS.Timeout
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
  private readonly MAX_RESTART_ATTEMPTS = 3
  private readonly STARTUP_TIMEOUT = 10000 // 10 seconds

  constructor(
    portManager: PortManager,
    apiService: ApiService
  ) {
    this.portManager = portManager
    this.apiService = apiService
  }

  /**
   * Initialize the mock server manager
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Mock Server Manager...')

    // Start health monitoring
    this.startHealthMonitoring()

    // Restore any active servers from database
    await this.restoreActiveServers()

    console.log(`🚀 Mock Server Manager initialized with ${this.servers.size} servers`)
  }

  /**
   * Start a mock server for an API
   */
  async startServer(request: ServerStartRequest): Promise<MockServerInstance> {
    const validatedRequest = ServerStartRequestSchema.parse(request)
    const { apiId, force } = validatedRequest

    // Check if server is already running
    const existingServer = this.servers.get(apiId)
    if (existingServer && existingServer.status === 'running' && !force) {
      throw new Error(`Mock server for API ${apiId} is already running on port ${existingServer.port}`)
    }

    // Stop existing server if force restart
    if (existingServer && force) {
      await this.stopServer({ apiId, graceful: true })
    }

    // Get API details
    const api = await this.apiService.findByIdWithEndpointsAndScenarios(apiId)
    if (!api) {
      throw new Error(`API ${apiId} not found`)
    }

    // Get or allocate port
    let portAllocation = this.portManager.getPortAllocation(apiId)
    if (!portAllocation) {
      await this.portManager.allocatePort({ apiId })
      portAllocation = this.portManager.getPortAllocation(apiId)!
    }

    try {
      // Create server instance
      const serverInstance: MockServerInstance = {
        apiId,
        port: portAllocation.port,
        process: null as any, // Will be set below
        status: 'starting',
        startedAt: new Date(),
        errorCount: 0,
        restartCount: existingServer?.restartCount || 0,
      }

      // Spawn the mock server process
      const mockServerProcess = await this.spawnMockServer(api, portAllocation.port)
      serverInstance.process = mockServerProcess

      // Set up process event handlers
      this.setupProcessHandlers(serverInstance)

      // Store server instance
      this.servers.set(apiId, serverInstance)

      // Wait for server to start
      await this.waitForServerStart(serverInstance)

      // Update API status in database
      await this.apiService.update(apiId, { status: 'active' })

      // Mark port as active
      await this.portManager.markPortActive(apiId)

      console.log(`🟢 Mock server started for API ${apiId} on port ${portAllocation.port}`)
      return serverInstance

    } catch (error) {
      console.error(`❌ Failed to start mock server for API ${apiId}:`, error)

      // Clean up on failure
      await this.portManager.markPortInactive(apiId)
      await this.apiService.update(apiId, { status: 'inactive' })

      throw error
    }
  }

  /**
   * Stop a mock server
   */
  async stopServer(request: ServerStopRequest): Promise<void> {
    const validatedRequest = ServerStopRequestSchema.parse(request)
    const { apiId, graceful } = validatedRequest

    const serverInstance = this.servers.get(apiId)
    if (!serverInstance) {
      console.warn(`⚠️  No server instance found for API ${apiId}`)
      return
    }

    if (serverInstance.status === 'stopped' || serverInstance.status === 'stopping') {
      console.warn(`⚠️  Server for API ${apiId} is already stopped or stopping`)
      return
    }

    try {
      serverInstance.status = 'stopping'

      if (graceful) {
        // Send SIGTERM for graceful shutdown
        serverInstance.process.kill('SIGTERM')

        // Wait for graceful shutdown with timeout
        await this.waitForProcessExit(serverInstance.process, 5000)
      } else {
        // Force kill
        serverInstance.process.kill('SIGKILL')
      }

      // Update status
      serverInstance.status = 'stopped'

      // Update API status in database
      await this.apiService.update(apiId, { status: 'inactive' })

      // Mark port as inactive
      await this.portManager.markPortInactive(apiId)

      console.log(`🔴 Mock server stopped for API ${apiId}`)

    } catch (error) {
      console.error(`❌ Error stopping server for API ${apiId}:`, error)
      serverInstance.status = 'error'
      throw error
    }
  }

  /**
   * Restart a mock server
   */
  async restartServer(apiId: string): Promise<MockServerInstance> {
    console.log(`🔄 Restarting mock server for API ${apiId}`)

    const serverInstance = this.servers.get(apiId)
    if (serverInstance) {
      serverInstance.restartCount++
    }

    // Stop the server first
    await this.stopServer({ apiId, graceful: true })

    // Start the server again
    return await this.startServer({ apiId, force: true })
  }

  /**
   * Get server instance
   */
  getServerInstance(apiId: string): MockServerInstance | null {
    return this.servers.get(apiId) || null
  }

  /**
   * Get all server instances
   */
  getAllServerInstances(): MockServerInstance[] {
    return Array.from(this.servers.values())
  }

  /**
   * Get running servers
   */
  getRunningServers(): MockServerInstance[] {
    return Array.from(this.servers.values())
      .filter(server => server.status === 'running')
  }

  /**
   * Check server health
   */
  async checkServerHealth(apiId: string): Promise<boolean> {
    const serverInstance = this.servers.get(apiId)
    if (!serverInstance || serverInstance.status !== 'running') {
      return false
    }

    try {
      // Simple HTTP health check
      const response = await fetch(`http://localhost:${serverInstance.port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      const isHealthy = response.ok
      if (isHealthy) {
        serverInstance.lastHealthCheck = new Date()
      } else {
        serverInstance.errorCount++
      }

      return isHealthy

    } catch (error) {
      console.warn(`⚠️  Health check failed for API ${apiId}:`, error)
      serverInstance.errorCount++
      return false
    }
  }

  /**
   * Shutdown all servers
   */
  async shutdownAll(): Promise<void> {
    console.log('🛑 Shutting down all mock servers...')

    const shutdownPromises = Array.from(this.servers.keys()).map(apiId =>
      this.stopServer({ apiId, graceful: true }).catch(error =>
        console.error(`Error shutting down server ${apiId}:`, error)
      )
    )

    await Promise.all(shutdownPromises)

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    console.log('🛑 All mock servers shut down')
  }

  /**
   * Spawn a mock server process
   */
  private async spawnMockServer(api: any, port: number): Promise<ChildProcess> {
    // Path to the mock server script
    const mockServerScript = join(process.cwd(), 'packages', 'backend', 'dist', 'mock-server', 'server.js')

    // Prepare environment variables
    const env = {
      ...process.env,
      PORT: port.toString(),
      API_ID: api.id,
      API_CONFIG: JSON.stringify(api),
      NODE_ENV: process.env.NODE_ENV || 'development',
      MANAGEMENT_API_URL: process.env.MANAGEMENT_API_URL || `http://localhost:${process.env.PORT || 3000}`,
    }

    // Spawn the process
    const childProcess = spawn('node', [mockServerScript], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    })

    return childProcess
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(serverInstance: MockServerInstance): void {
    const { process: childProcess, apiId } = serverInstance

    childProcess.on('spawn', () => {
      console.log(`📡 Mock server process spawned for API ${apiId} (PID: ${childProcess.pid})`)
    })

    childProcess.on('error', (error) => {
      console.error(`❌ Mock server process error for API ${apiId}:`, error)
      serverInstance.status = 'error'
      serverInstance.errorCount++
    })

    childProcess.on('exit', (code, signal) => {
      console.log(`🔚 Mock server process exited for API ${apiId} (code: ${code}, signal: ${signal})`)

      // Check if this was an unexpected exit before changing status
      const wasRunning = serverInstance.status === 'running' || serverInstance.status === 'starting'
      serverInstance.status = 'stopped'

      // Handle unexpected exits (only if the server was supposed to be running)
      if (code !== 0 && wasRunning) {
        console.warn(`⚠️  Unexpected exit for API ${apiId}, considering restart...`)
        this.handleUnexpectedExit(serverInstance)
      }
    })

    // Log stdout/stderr
    childProcess.stdout?.on('data', (data) => {
      console.log(`[${apiId}] ${data.toString().trim()}`)
    })

    childProcess.stderr?.on('data', (data) => {
      console.error(`[${apiId}] ${data.toString().trim()}`)
    })
  }

  /**
   * Wait for server to start
   */
  private async waitForServerStart(serverInstance: MockServerInstance): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      if (serverInstance.status === 'error') {
        throw new Error(`Server failed to start for API ${serverInstance.apiId}`)
      }

      // Check if server is responding
      const isHealthy = await this.checkServerHealth(serverInstance.apiId)
      if (isHealthy) {
        serverInstance.status = 'running'
        return
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    throw new Error(`Server startup timeout for API ${serverInstance.apiId}`)
  }

  /**
   * Wait for process to exit
   */
  private async waitForProcessExit(process: ChildProcess, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        process.kill('SIGKILL')
        reject(new Error('Process exit timeout'))
      }, timeout)

      process.on('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  /**
   * Handle unexpected server exits
   */
  private async handleUnexpectedExit(serverInstance: MockServerInstance): Promise<void> {
    if (serverInstance.restartCount >= this.MAX_RESTART_ATTEMPTS) {
      console.error(`❌ Max restart attempts reached for API ${serverInstance.apiId}`)
      serverInstance.status = 'error'
      return
    }

    console.log(`🔄 Attempting to restart server for API ${serverInstance.apiId}`)

    try {
      await this.restartServer(serverInstance.apiId)
    } catch (error) {
      console.error(`❌ Failed to restart server for API ${serverInstance.apiId}:`, error)
      serverInstance.status = 'error'
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const runningServers = this.getRunningServers()

      for (const server of runningServers) {
        const isHealthy = await this.checkServerHealth(server.apiId)

        if (!isHealthy && server.errorCount > 3) {
          console.warn(`⚠️  Server ${server.apiId} is unhealthy, attempting restart...`)
          await this.handleUnexpectedExit(server)
        }
      }
    }, this.HEALTH_CHECK_INTERVAL)
  }

  /**
   * Restore active servers from database
   */
  private async restoreActiveServers(): Promise<void> {
    try {
      const activeApis = await this.apiService.findActive()

      for (const api of activeApis) {
        try {
          console.log(`🔄 Restoring server for API ${api.id}...`)
          await this.startServer({ apiId: api.id, force: true })
        } catch (error) {
          console.error(`❌ Failed to restore server for API ${api.id}:`, error)
          // Mark as inactive if restore fails
          await this.apiService.update(api.id, { status: 'inactive' })
        }
      }
    } catch (error) {
      console.error('❌ Error restoring active servers:', error)
    }
  }

  /**
   * Get manager statistics
   */
  getStatistics() {
    const servers = this.getAllServerInstances()
    const runningCount = servers.filter(s => s.status === 'running').length
    const stoppedCount = servers.filter(s => s.status === 'stopped').length
    const errorCount = servers.filter(s => s.status === 'error').length
    const startingCount = servers.filter(s => s.status === 'starting').length

    return {
      totalServers: servers.length,
      runningServers: runningCount,
      stoppedServers: stoppedCount,
      errorServers: errorCount,
      startingServers: startingCount,
      totalRestarts: servers.reduce((sum, s) => sum + s.restartCount, 0),
      totalErrors: servers.reduce((sum, s) => sum + s.errorCount, 0),
    }
  }
}