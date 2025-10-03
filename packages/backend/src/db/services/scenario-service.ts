import { eq, and, desc } from 'drizzle-orm'
import { db } from '../connection.js'
import { scenarios, endpoints } from '../schema.js'
import type {
  Scenario,
  NewScenario,
  CreateScenarioRequest,
  UpdateScenarioRequest
} from '../types.js'

export class ScenarioService {
  /**
   * Create a new scenario
   */
  async create(endpointId: string, data: CreateScenarioRequest): Promise<Scenario> {
    const newScenario: NewScenario = {
      endpointId,
      name: data.name,
      statusCode: data.statusCode,
      responseHeaders: data.responseHeaders,
      responseBody: data.responseBody,
      conditions: data.conditions,
      isDefault: data.isDefault || false,
    }

    // If this is being set as default, unset other defaults for this endpoint
    if (data.isDefault) {
      await this.unsetDefaultsForEndpoint(endpointId)
    }

    const [scenario] = await db.insert(scenarios).values(newScenario).returning()

    // If this is the default scenario, update the endpoint's defaultScenarioId
    if (data.isDefault) {
      await db
        .update(endpoints)
        .set({
          defaultScenarioId: scenario.id,
          updatedAt: new Date(),
        })
        .where(eq(endpoints.id, endpointId))
    }

    return scenario
  }

  /**
   * Get all scenarios for an endpoint
   */
  async findByEndpointId(endpointId: string): Promise<Scenario[]> {
    return await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.endpointId, endpointId))
      .orderBy(desc(scenarios.isDefault), desc(scenarios.createdAt))
  }

  /**
   * Get scenario by ID
   */
  async findById(id: string): Promise<Scenario | null> {
    const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id)).limit(1)
    return scenario || null
  }

  /**
   * Get default scenario for an endpoint
   */
  async findDefaultByEndpointId(endpointId: string): Promise<Scenario | null> {
    const [scenario] = await db
      .select()
      .from(scenarios)
      .where(
        and(
          eq(scenarios.endpointId, endpointId),
          eq(scenarios.isDefault, true)
        )
      )
      .limit(1)

    return scenario || null
  }

  /**
   * Update scenario
   */
  async update(id: string, data: UpdateScenarioRequest): Promise<Scenario | null> {
    const scenario = await this.findById(id)
    if (!scenario) return null

    // If setting as default, unset other defaults for this endpoint
    if (data.isDefault) {
      await this.unsetDefaultsForEndpoint(scenario.endpointId)
    }

    const updateData = {
      ...data,
      updatedAt: new Date(),
    }

    const [updatedScenario] = await db
      .update(scenarios)
      .set(updateData)
      .where(eq(scenarios.id, id))
      .returning()

    // If this is now the default scenario, update the endpoint's defaultScenarioId
    if (data.isDefault && updatedScenario) {
      await db
        .update(endpoints)
        .set({
          defaultScenarioId: updatedScenario.id,
          updatedAt: new Date(),
        })
        .where(eq(endpoints.id, scenario.endpointId))
    }

    return updatedScenario || null
  }

  /**
   * Delete scenario
   */
  async delete(id: string): Promise<boolean> {
    const scenario = await this.findById(id)
    if (!scenario) return false

    // If deleting the default scenario, clear the endpoint's defaultScenarioId
    if (scenario.isDefault) {
      await db
        .update(endpoints)
        .set({
          defaultScenarioId: null,
          updatedAt: new Date(),
        })
        .where(eq(endpoints.id, scenario.endpointId))
    }

    const result = await db.delete(scenarios).where(eq(scenarios.id, id))
    return result.rowsAffected > 0
  }

  /**
   * Set scenario as default
   */
  async setAsDefault(id: string): Promise<Scenario | null> {
    const scenario = await this.findById(id)
    if (!scenario) return null

    // Unset other defaults for this endpoint
    await this.unsetDefaultsForEndpoint(scenario.endpointId)

    // Set this scenario as default
    const [updatedScenario] = await db
      .update(scenarios)
      .set({
        isDefault: true,
        updatedAt: new Date(),
      })
      .where(eq(scenarios.id, id))
      .returning()

    // Update the endpoint's defaultScenarioId
    if (updatedScenario) {
      await db
        .update(endpoints)
        .set({
          defaultScenarioId: updatedScenario.id,
          updatedAt: new Date(),
        })
        .where(eq(endpoints.id, scenario.endpointId))
    }

    return updatedScenario || null
  }

  /**
   * Unset all default scenarios for an endpoint
   */
  private async unsetDefaultsForEndpoint(endpointId: string): Promise<void> {
    await db
      .update(scenarios)
      .set({
        isDefault: false,
        updatedAt: new Date(),
      })
      .where(eq(scenarios.endpointId, endpointId))
  }

  /**
   * Count scenarios for an endpoint
   */
  async countByEndpointId(endpointId: string): Promise<number> {
    const result = await db
      .select({ count: scenarios.id })
      .from(scenarios)
      .where(eq(scenarios.endpointId, endpointId))

    return result.length
  }

  /**
   * Find scenarios by status code
   */
  async findByStatusCode(endpointId: string, statusCode: number): Promise<Scenario[]> {
    return await db
      .select()
      .from(scenarios)
      .where(
        and(
          eq(scenarios.endpointId, endpointId),
          eq(scenarios.statusCode, statusCode)
        )
      )
      .orderBy(desc(scenarios.createdAt))
  }

  /**
   * Check if endpoint has scenarios
   */
  async hasScenarios(endpointId: string): Promise<boolean> {
    const count = await this.countByEndpointId(endpointId)
    return count > 0
  }
}