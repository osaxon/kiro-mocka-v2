import { eq, and, desc } from 'drizzle-orm'
import { db } from '../connection.js'
import { endpoints, scenarios } from '../schema.js'
import type {
  Endpoint,
  NewEndpoint,
  EndpointWithScenarios,
  CreateEndpointRequest,
  UpdateEndpointRequest,
  HttpMethod
} from '../types.js'

export class EndpointService {
  /**
   * Create a new endpoint
   */
  async create(apiId: string, data: CreateEndpointRequest): Promise<Endpoint> {
    try {
      const newEndpoint: NewEndpoint = {
        apiId,
        method: data.method,
        path: data.path,
        description: data.description,
        requestHeaders: data.requestHeaders,
        requestParams: data.requestParams,
        requestBody: data.requestBody,
      }

      const [endpoint] = await db.insert(endpoints).values(newEndpoint).returning()
      return endpoint
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Endpoint ${data.method} ${data.path} already exists for this API`)
      }
      throw error
    }
  }

  /**
   * Get all endpoints for an API
   */
  async findByApiId(apiId: string): Promise<Endpoint[]> {
    return await db
      .select()
      .from(endpoints)
      .where(eq(endpoints.apiId, apiId))
      .orderBy(desc(endpoints.createdAt))
  }

  /**
   * Get endpoint by ID
   */
  async findById(id: string): Promise<Endpoint | null> {
    const [endpoint] = await db.select().from(endpoints).where(eq(endpoints.id, id)).limit(1)
    return endpoint || null
  }

  /**
   * Get endpoint with scenarios
   */
  async findByIdWithScenarios(id: string): Promise<EndpointWithScenarios | null> {
    const endpoint = await this.findById(id)
    if (!endpoint) return null

    const endpointScenarios = await db.select().from(scenarios).where(eq(scenarios.endpointId, id))
    const defaultScenario = endpoint.defaultScenarioId
      ? endpointScenarios.find(s => s.id === endpoint.defaultScenarioId)
      : endpointScenarios.find(s => s.isDefault)

    return {
      ...endpoint,
      scenarios: endpointScenarios,
      defaultScenario,
    }
  }

  /**
   * Find endpoint by API ID, method, and path
   */
  async findByApiAndRoute(apiId: string, method: HttpMethod, path: string): Promise<Endpoint | null> {
    const [endpoint] = await db
      .select()
      .from(endpoints)
      .where(
        and(
          eq(endpoints.apiId, apiId),
          eq(endpoints.method, method),
          eq(endpoints.path, path)
        )
      )
      .limit(1)

    return endpoint || null
  }

  /**
   * Update endpoint
   */
  async update(id: string, data: UpdateEndpointRequest): Promise<Endpoint | null> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date(),
      }

      const [updatedEndpoint] = await db
        .update(endpoints)
        .set(updateData)
        .where(eq(endpoints.id, id))
        .returning()

      return updatedEndpoint || null
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`Endpoint ${data.method} ${data.path} already exists for this API`)
      }
      throw error
    }
  }

  /**
   * Delete endpoint
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(endpoints).where(eq(endpoints.id, id))
    return result.rowsAffected > 0
  }

  /**
   * Check if endpoint exists
   */
  async exists(apiId: string, method: HttpMethod, path: string, excludeEndpointId?: string): Promise<boolean> {
    let query = db
      .select()
      .from(endpoints)
      .where(
        and(
          eq(endpoints.apiId, apiId),
          eq(endpoints.method, method),
          eq(endpoints.path, path)
        )
      )

    const [existingEndpoint] = await query.limit(1)

    if (!existingEndpoint) return false

    // If we're updating an existing endpoint, exclude it from the check
    if (excludeEndpointId && existingEndpoint.id === excludeEndpointId) {
      return false
    }

    return true
  }

  /**
   * Set default scenario for endpoint
   */
  async setDefaultScenario(endpointId: string, scenarioId: string): Promise<Endpoint | null> {
    const [updatedEndpoint] = await db
      .update(endpoints)
      .set({
        defaultScenarioId: scenarioId,
        updatedAt: new Date(),
      })
      .where(eq(endpoints.id, endpointId))
      .returning()

    return updatedEndpoint || null
  }

  /**
   * Get endpoints by method
   */
  async findByMethod(apiId: string, method: HttpMethod): Promise<Endpoint[]> {
    return await db
      .select()
      .from(endpoints)
      .where(
        and(
          eq(endpoints.apiId, apiId),
          eq(endpoints.method, method)
        )
      )
      .orderBy(desc(endpoints.createdAt))
  }

  /**
   * Count endpoints for an API
   */
  async countByApiId(apiId: string): Promise<number> {
    const result = await db
      .select({ count: endpoints.id })
      .from(endpoints)
      .where(eq(endpoints.apiId, apiId))

    return result.length
  }
}