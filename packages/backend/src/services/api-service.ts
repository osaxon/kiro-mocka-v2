import { eq, desc } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { apis, endpoints, scenarios } from '../db/schema.js'
import type {
  Api,
  NewApi,
  ApiWithEndpoints,
  ApiWithEndpointsAndScenarios,
  CreateApiRequest,
  UpdateApiRequest
} from '../db/types.js'
import {
  CreateApiWithPortRequestSchema,
  UpdateApiRequestSchema
} from '../db/types.js'

export class ApiService {
  /**
   * Create a new API
   */
  async create(data: CreateApiRequest & { port: number }): Promise<Api> {
    try {
      // Validate input data using Zod schema
      const validatedData = CreateApiWithPortRequestSchema.parse(data)

      const newApi: NewApi = {
        name: validatedData.name,
        description: validatedData.description,
        port: validatedData.port,
        status: 'inactive',
      }

      const [api] = await db.insert(apis).values(newApi).returning()
      return api
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: apis.port')) {
        throw new Error(`Port ${data.port} is already in use`)
      }
      throw error
    }
  }

  /**
   * Get all APIs
   */
  async findAll(): Promise<Api[]> {
    return await db.select().from(apis).orderBy(desc(apis.createdAt))
  }

  /**
   * Get API by ID
   */
  async findById(id: string): Promise<Api | null> {
    const [api] = await db.select().from(apis).where(eq(apis.id, id)).limit(1)
    return api || null
  }

  /**
   * Get API by port
   */
  async findByPort(port: number): Promise<Api | null> {
    const [api] = await db.select().from(apis).where(eq(apis.port, port)).limit(1)
    return api || null
  }

  /**
   * Get API with its endpoints
   */
  async findByIdWithEndpoints(id: string): Promise<ApiWithEndpoints | null> {
    const api = await this.findById(id)
    if (!api) return null

    const apiEndpoints = await db.select().from(endpoints).where(eq(endpoints.apiId, id))

    return {
      ...api,
      endpoints: apiEndpoints,
    }
  }

  /**
   * Get API with endpoints and scenarios
   */
  async findByIdWithEndpointsAndScenarios(id: string): Promise<ApiWithEndpointsAndScenarios | null> {
    const api = await this.findById(id)
    if (!api) return null

    const apiEndpoints = await db.select().from(endpoints).where(eq(endpoints.apiId, id))

    const endpointsWithScenarios = await Promise.all(
      apiEndpoints.map(async (endpoint) => {
        const endpointScenarios = await db.select().from(scenarios).where(eq(scenarios.endpointId, endpoint.id))
        const defaultScenario = endpoint.defaultScenarioId
          ? endpointScenarios.find(s => s.id === endpoint.defaultScenarioId)
          : endpointScenarios.find(s => s.isDefault)

        return {
          ...endpoint,
          scenarios: endpointScenarios,
          defaultScenario,
        }
      })
    )

    return {
      ...api,
      endpoints: endpointsWithScenarios,
    }
  }

  /**
   * Update API
   */
  async update(id: string, data: UpdateApiRequest): Promise<Api | null> {
    // Validate input data using Zod schema
    const validatedData = UpdateApiRequestSchema.parse(data)

    try {
      const updateData = {
        ...validatedData,
        updatedAt: new Date(),
      }

      const [updatedApi] = await db
        .update(apis)
        .set(updateData)
        .where(eq(apis.id, id))
        .returning()

      return updatedApi || null
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: apis.port')) {
        throw new Error(`Port is already in use`)
      }
      throw error
    }
  }

  /**
   * Delete API
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(apis).where(eq(apis.id, id))
    return result.rowsAffected > 0
  }

  /**
   * Get all active APIs
   */
  async findActive(): Promise<Api[]> {
    return await db.select().from(apis).where(eq(apis.status, 'active'))
  }

  /**
   * Check if port is available
   */
  async isPortAvailable(port: number, excludeApiId?: string): Promise<boolean> {
    const query = db.select().from(apis).where(eq(apis.port, port))

    if (excludeApiId) {
      // If we're updating an existing API, exclude it from the check
      const [existingApi] = await query.limit(1)
      return !existingApi || existingApi.id === excludeApiId
    }

    const [existingApi] = await query.limit(1)
    return !existingApi
  }

  /**
   * Find next available port in range
   */
  async findNextAvailablePort(startPort: number = 3001, endPort: number = 9999): Promise<number> {
    const usedPorts = await db.select({ port: apis.port }).from(apis)
    const usedPortNumbers = new Set(usedPorts.map(p => p.port))

    for (let port = startPort; port <= endPort; port++) {
      // Skip port 5000 (macOS AirPlay)
      if (port === 5000) continue

      if (!usedPortNumbers.has(port)) {
        return port
      }
    }

    throw new Error(`No available ports in range ${startPort}-${endPort}`)
  }
}