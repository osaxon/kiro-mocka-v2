import { Hono } from 'hono'
import { validateJson, validateQuery, validateParam, paginationQuerySchema } from '../middleware/index.js'
import { ScenarioService } from '../services/scenario-service.js'
import { EndpointService } from '../services/endpoint-service.js'
import { ApiService } from '../services/api-service.js'
import {
  CreateScenarioRequestSchema,
  UpdateScenarioRequestSchema,
  type CreateScenarioRequest,
  type UpdateScenarioRequest
} from '../db/types.js'
import { z } from 'zod'

const scenarioRouter = new Hono()
const scenarioService = new ScenarioService()
const endpointService = new EndpointService()
const apiService = new ApiService()

// Query schema for scenario listing with status code filter
const scenarioListQuerySchema = paginationQuerySchema.extend({
  statusCode: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
})

// Parameter schema for endpoint ID
const endpointIdParamSchema = z.object({
  endpointId: z.string().min(1, 'Endpoint ID is required'),
})

// Parameter schema for scenario ID with endpoint ID
const scenarioParamSchema = z.object({
  endpointId: z.string().min(1, 'Endpoint ID is required'),
  scenarioId: z.string().min(1, 'Scenario ID is required'),
})

// GET /endpoints/:endpointId/scenarios - List all scenarios for an endpoint
scenarioRouter.get('/',
  validateParam(endpointIdParamSchema),
  validateQuery(scenarioListQuerySchema),
  async (c) => {
    try {
      const { endpointId } = c.req.valid('param')
      const { page, limit, sort, order, statusCode } = c.req.valid('query')

      // Check if endpoint exists and get API info
      const endpoint = await endpointService.findById(endpointId)
      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const api = await apiService.findById(endpoint.apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API for endpoint ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      let scenarios = statusCode
        ? await scenarioService.findByStatusCode(endpointId, statusCode)
        : await scenarioService.findByEndpointId(endpointId)

      // Apply sorting
      if (sort) {
        scenarios.sort((a, b) => {
          const aVal = (a as any)[sort] || ''
          const bVal = (b as any)[sort] || ''
          const comparison = aVal.toString().localeCompare(bVal.toString())
          return order === 'desc' ? -comparison : comparison
        })
      }

      // Apply pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedScenarios = scenarios.slice(startIndex, endIndex)

      return c.json({
        data: paginatedScenarios,
        pagination: {
          page,
          limit,
          total: scenarios.length,
          totalPages: Math.ceil(scenarios.length / limit),
        },
        endpoint: {
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching scenarios:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch scenarios',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// GET /endpoints/:endpointId/scenarios/:scenarioId - Get single scenario
scenarioRouter.get('/:scenarioId',
  validateParam(scenarioParamSchema),
  async (c) => {
    try {
      const { endpointId, scenarioId } = c.req.valid('param')

      // Check if endpoint exists
      const endpoint = await endpointService.findById(endpointId)
      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const api = await apiService.findById(endpoint.apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API for endpoint ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const scenario = await scenarioService.findById(scenarioId)

      if (!scenario) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify scenario belongs to the specified endpoint
      if (scenario.endpointId !== endpointId) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not belong to endpoint ${endpointId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        data: scenario,
        endpoint: {
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching scenario:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch scenario',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /endpoints/:endpointId/scenarios - Create new scenario
scenarioRouter.post('/',
  validateParam(endpointIdParamSchema),
  validateJson(CreateScenarioRequestSchema),
  async (c) => {
    try {
      const { endpointId } = c.req.valid('param')
      const data: CreateScenarioRequest = c.req.valid('json')

      // Check if endpoint exists
      const endpoint = await endpointService.findById(endpointId)
      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const api = await apiService.findById(endpoint.apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API for endpoint ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const newScenario = await scenarioService.create(endpointId, data)

      return c.json({
        message: 'Scenario created successfully',
        data: newScenario,
        endpoint: {
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      }, 201)
    } catch (error) {
      console.error('Error creating scenario:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to create scenario',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// PUT /endpoints/:endpointId/scenarios/:scenarioId - Update scenario
scenarioRouter.put('/:scenarioId',
  validateParam(scenarioParamSchema),
  validateJson(UpdateScenarioRequestSchema),
  async (c) => {
    try {
      const { endpointId, scenarioId } = c.req.valid('param')
      const updates: UpdateScenarioRequest = c.req.valid('json')

      // Check if endpoint exists
      const endpoint = await endpointService.findById(endpointId)
      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const api = await apiService.findById(endpoint.apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API for endpoint ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const existingScenario = await scenarioService.findById(scenarioId)
      if (!existingScenario) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify scenario belongs to the specified endpoint
      if (existingScenario.endpointId !== endpointId) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not belong to endpoint ${endpointId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const updatedScenario = await scenarioService.update(scenarioId, updates)

      if (!updatedScenario) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        message: 'Scenario updated successfully',
        data: updatedScenario,
        endpoint: {
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error updating scenario:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to update scenario',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// DELETE /endpoints/:endpointId/scenarios/:scenarioId - Delete scenario
scenarioRouter.delete('/:scenarioId',
  validateParam(scenarioParamSchema),
  async (c) => {
    try {
      const { endpointId, scenarioId } = c.req.valid('param')

      // Check if endpoint exists
      const endpoint = await endpointService.findById(endpointId)
      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const api = await apiService.findById(endpoint.apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API for endpoint ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const existingScenario = await scenarioService.findById(scenarioId)
      if (!existingScenario) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify scenario belongs to the specified endpoint
      if (existingScenario.endpointId !== endpointId) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not belong to endpoint ${endpointId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const deleted = await scenarioService.delete(scenarioId)

      if (!deleted) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        message: 'Scenario deleted successfully',
        data: {
          id: scenarioId,
          name: existingScenario.name,
          statusCode: existingScenario.statusCode,
        },
        endpoint: {
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error deleting scenario:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to delete scenario',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /endpoints/:endpointId/scenarios/:scenarioId/set-default - Set scenario as default
scenarioRouter.post('/:scenarioId/set-default',
  validateParam(scenarioParamSchema),
  async (c) => {
    try {
      const { endpointId, scenarioId } = c.req.valid('param')

      // Check if endpoint exists
      const endpoint = await endpointService.findById(endpointId)
      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const api = await apiService.findById(endpoint.apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API for endpoint ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const existingScenario = await scenarioService.findById(scenarioId)
      if (!existingScenario) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify scenario belongs to the specified endpoint
      if (existingScenario.endpointId !== endpointId) {
        return c.json({
          error: 'Scenario not found',
          message: `Scenario with ID ${scenarioId} does not belong to endpoint ${endpointId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const updatedScenario = await scenarioService.setAsDefault(scenarioId)

      if (!updatedScenario) {
        return c.json({
          error: 'Failed to set default scenario',
          message: 'Could not set scenario as default',
          timestamp: new Date().toISOString(),
        }, 400)
      }

      return c.json({
        message: 'Scenario set as default successfully',
        data: updatedScenario,
        endpoint: {
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error setting default scenario:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to set default scenario',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

export { scenarioRouter }