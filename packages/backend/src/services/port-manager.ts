import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { apis } from '../db/schema.js'
import { z } from 'zod'

// Port allocation configuration
const PORT_RANGE_START = 3001
const PORT_RANGE_END = 9999
const RESERVED_PORTS = new Set([5000]) // macOS AirPlay

// Validation schemas
const PortAllocationRequestSchema = z.object({
  apiId: z.string().min(1),
  preferredPort: z.number().int().min(PORT_RANGE_START).max(PORT_RANGE_END).optional(),
})

export type PortAllocationRequest = z.infer<typeof PortAllocationRequestSchema>

export interface PortAllocation {
  apiId: string
  port: number
  status: 'allocated' | 'active' | 'inactive'
  allocatedAt: Date
}

export class PortManager {
  private allocatedPorts = new Map<string, PortAllocation>()

  /**
   * Initialize port manager by loading existing allocations from database
   */
  async initialize(): Promise<void> {
    try {
      const existingApis = await db.select({
        id: apis.id,
        port: apis.port,
        status: apis.status,
        createdAt: apis.createdAt,
      }).from(apis)

      // Load existing port allocations
      for (const api of existingApis) {
        this.allocatedPorts.set(api.id, {
          apiId: api.id,
          port: api.port,
          status: api.status === 'active' ? 'active' : 'inactive',
          allocatedAt: api.createdAt,
        })
      }

      console.log(`🔌 Port manager initialized with ${this.allocatedPorts.size} existing allocations`)
    } catch (error) {
      console.error('Failed to initialize port manager:', error)
      throw error
    }
  }

  /**
   * Allocate a port for an API
   */
  async allocatePort(request: PortAllocationRequest): Promise<number> {
    const validatedRequest = PortAllocationRequestSchema.parse(request)
    const { apiId, preferredPort } = validatedRequest

    // Check if API already has a port allocated
    const existingAllocation = this.allocatedPorts.get(apiId)
    if (existingAllocation) {
      return existingAllocation.port
    }

    let port: number

    if (preferredPort) {
      // Try to allocate preferred port
      if (await this.isPortAvailable(preferredPort)) {
        port = preferredPort
      } else {
        throw new Error(`Preferred port ${preferredPort} is not available`)
      }
    } else {
      // Find next available port
      port = await this.findNextAvailablePort()
    }

    // Create allocation
    const allocation: PortAllocation = {
      apiId,
      port,
      status: 'allocated',
      allocatedAt: new Date(),
    }

    this.allocatedPorts.set(apiId, allocation)

    console.log(`🔌 Allocated port ${port} for API ${apiId}`)
    return port
  }

  /**
   * Deallocate a port for an API
   */
  async deallocatePort(apiId: string): Promise<void> {
    const allocation = this.allocatedPorts.get(apiId)
    if (!allocation) {
      console.warn(`⚠️  No port allocation found for API ${apiId}`)
      return
    }

    this.allocatedPorts.delete(apiId)
    console.log(`🔌 Deallocated port ${allocation.port} for API ${apiId}`)
  }

  /**
   * Mark a port as active (server is running)
   */
  async markPortActive(apiId: string): Promise<void> {
    const allocation = this.allocatedPorts.get(apiId)
    if (!allocation) {
      throw new Error(`No port allocation found for API ${apiId}`)
    }

    allocation.status = 'active'
    console.log(`🟢 Port ${allocation.port} marked as active for API ${apiId}`)
  }

  /**
   * Mark a port as inactive (server is stopped)
   */
  async markPortInactive(apiId: string): Promise<void> {
    const allocation = this.allocatedPorts.get(apiId)
    if (!allocation) {
      throw new Error(`No port allocation found for API ${apiId}`)
    }

    allocation.status = 'inactive'
    console.log(`🔴 Port ${allocation.port} marked as inactive for API ${apiId}`)
  }

  /**
   * Get port allocation for an API
   */
  getPortAllocation(apiId: string): PortAllocation | null {
    return this.allocatedPorts.get(apiId) || null
  }

  /**
   * Get all port allocations
   */
  getAllAllocations(): PortAllocation[] {
    return Array.from(this.allocatedPorts.values())
  }

  /**
   * Get all active ports
   */
  getActivePorts(): number[] {
    return Array.from(this.allocatedPorts.values())
      .filter(allocation => allocation.status === 'active')
      .map(allocation => allocation.port)
  }

  /**
   * Check if a port is available for allocation
   */
  async isPortAvailable(port: number): Promise<boolean> {
    // Check if port is in reserved range
    if (port < PORT_RANGE_START || port > PORT_RANGE_END) {
      return false
    }

    // Check if port is reserved
    if (RESERVED_PORTS.has(port)) {
      return false
    }

    // Check if port is already allocated
    const isAllocated = Array.from(this.allocatedPorts.values())
      .some(allocation => allocation.port === port)

    if (isAllocated) {
      return false
    }

    // Check database for any existing allocations not in memory
    const existingApi = await db.select()
      .from(apis)
      .where(eq(apis.port, port))
      .limit(1)

    return existingApi.length === 0
  }

  /**
   * Find the next available port in the range
   */
  async findNextAvailablePort(): Promise<number> {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (await this.isPortAvailable(port)) {
        return port
      }
    }

    throw new Error(`No available ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`)
  }

  /**
   * Handle port conflicts by finding alternative ports
   */
  async resolvePortConflict(apiId: string, conflictedPort: number): Promise<number> {
    console.warn(`⚠️  Port conflict detected for API ${apiId} on port ${conflictedPort}`)

    // Deallocate the conflicted port
    await this.deallocatePort(apiId)

    // Allocate a new port
    const newPort = await this.allocatePort({ apiId })

    console.log(`🔄 Resolved port conflict for API ${apiId}: ${conflictedPort} → ${newPort}`)
    return newPort
  }

  /**
   * Validate port range and configuration
   */
  validatePortConfiguration(): void {
    if (PORT_RANGE_START >= PORT_RANGE_END) {
      throw new Error('Invalid port range: start port must be less than end port')
    }

    if (PORT_RANGE_START < 1024) {
      console.warn('⚠️  Port range includes system ports (< 1024), which may require elevated privileges')
    }

    console.log(`🔌 Port manager configured for range ${PORT_RANGE_START}-${PORT_RANGE_END}`)
    console.log(`🚫 Reserved ports: ${Array.from(RESERVED_PORTS).join(', ')}`)
  }

  /**
   * Get port manager statistics
   */
  getStatistics() {
    const allocations = this.getAllAllocations()
    const activeCount = allocations.filter(a => a.status === 'active').length
    const inactiveCount = allocations.filter(a => a.status === 'inactive').length
    const allocatedCount = allocations.filter(a => a.status === 'allocated').length

    return {
      totalAllocations: allocations.length,
      activeServers: activeCount,
      inactiveServers: inactiveCount,
      pendingAllocations: allocatedCount,
      availablePortsRange: `${PORT_RANGE_START}-${PORT_RANGE_END}`,
      reservedPorts: Array.from(RESERVED_PORTS),
    }
  }
}