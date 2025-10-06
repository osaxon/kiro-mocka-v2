import { Hono } from 'hono'
import { validateJson, validateQuery, validateParam, paginationQuerySchema } from '../middleware/index.js'
import { EndpointService } from '../db/services/endpoint-service.js'
import { ApiService } from '../db/services/api-service.js'
import {
  CreateEndpointRequestSchema,
  UpdateEndpointRequestSchema,
  HttpMethodSchema,
  type CreateEndpointRequest,
  type UpdateEndpointRequest
} from '../db/types.js'
import { z } from 'zod'

const endpointRouter = new Hono()
const endpointService = new EndpointService()
const apiService = new ApiService()

// Query schema for endpoint listing with method filter
const endpointListQuerySchema = paginationQuerySchema.extend({
  method: HttpMethodSchema.optional(),
})

// Parameter schema for API ID
const apiIdParamSchema = z.object({
  apiId: z.string().min(1, 'API ID is required'),
})

// Parameter schema for endpoint ID with API ID
const endpointParamSchema = z.object({
  apiId: z.string().min(1, 'API ID is required'),
  endpointId: z.string().min(1, 'Endpoint ID is required'),
})

// Schema for setting default scenario
const setDefaultScenarioSchema = z.object({
  scenarioId: z.string().min(1, 'Scenario ID is required'),
})

// GET /apis/:apiId/endpoints - List all endpoints for an API
endpointRouter.get('/',
  validateParam(apiIdParamSchema),
  validateQuery(endpointListQuerySchema),
  async (c) => {
    try {
      const { apiId } = c.req.valid('param')
      const { page, limit, sort, order, method } = c.req.valid('query')

      // Check if API exists
      const api = await apiService.findById(apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${apiId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      let endpoints = method
        ? await endpointService.findByMethod(apiId, method)
        : await endpointService.findByApiId(apiId)

      // Apply sorting
      if (sort) {
        endpoints.sort((a, b) => {
          const aVal = (a as any)[sort] || ''
          const bVal = (b as any)[sort] || ''
          const comparison = aVal.toString().localeCompare(bVal.toString())
          return order === 'desc' ? -comparison : comparison
        })
      }

      // Apply pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedEndpoints = endpoints.slice(startIndex, endIndex)

      return c.json({
        data: paginatedEndpoints,
        pagination: {
          page,
          limit,
          total: endpoints.length,
          totalPages: Math.ceil(endpoints.length / limit),
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching endpoints:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch endpoints',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// GET /apis/:apiId/endpoints/:endpointId - Get single endpoint with scenarios
endpointRouter.get('/:endpointId',
  validateParam(endpointParamSchema),
  async (c) => {
    try {
      const { apiId, endpointId } = c.req.valid('param')

      // Check if API exists
      const api = await apiService.findById(apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${apiId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const endpoint = await endpointService.findByIdWithScenarios(endpointId)

      if (!endpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify endpoint belongs to the specified API
      if (endpoint.apiId !== apiId) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not belong to API ${apiId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        data: endpoint,
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching endpoint:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch endpoint',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /apis/:apiId/endpoints - Create new endpoint
endpointRouter.post('/',
  validateParam(apiIdParamSchema),
  validateJson(CreateEndpointRequestSchema),
  async (c) => {
    try {
      const { apiId } = c.req.valid('param')
      const data: CreateEndpointRequest = c.req.valid('json')

      // Check if API exists
      const api = await apiService.findById(apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${apiId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Check if endpoint with same method and path already exists
      const existingEndpoint = await endpointService.findByApiAndRoute(apiId, data.method, data.path)
      if (existingEndpoint) {
        return c.json({
          error: 'Endpoint already exists',
          message: `Endpoint ${data.method} ${data.path} already exists for this API`,
          timestamp: new Date().toISOString(),
        }, 409)
      }

      const newEndpoint = await endpointService.create(apiId, data)

      return c.json({
        message: 'Endpoint created successfully',
        data: newEndpoint,
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      }, 201)
    } catch (error) {
      console.error('Error creating endpoint:', error)

      if (error instanceof Error && error.message.includes('already exists')) {
        return c.json({
          error: 'Endpoint conflict',
          message: error.message,
          timestamp: new Date().toISOString(),
        }, 409)
      }

      return c.json({
        error: 'Internal server error',
        message: 'Failed to create endpoint',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// PUT /apis/:apiId/endpoints/:endpointId - Update endpoint
endpointRouter.put('/:endpointId',
  validateParam(endpointParamSchema),
  validateJson(UpdateEndpointRequestSchema),
  async (c) => {
    try {
      const { apiId, endpointId } = c.req.valid('param')
      const updates: UpdateEndpointRequest = c.req.valid('json')

      // Check if API exists
      const api = await apiService.findById(apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${apiId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const existingEndpoint = await endpointService.findById(endpointId)
      if (!existingEndpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify endpoint belongs to the specified API
      if (existingEndpoint.apiId !== apiId) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not belong to API ${apiId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // If updating method or path, check for conflicts
      if (updates.method || updates.path) {
        const method = updates.method || existingEndpoint.method
        const path = updates.path || existingEndpoint.path

        const conflictExists = await endpointService.exists(apiId, method, path, endpointId)
        if (conflictExists) {
          return c.json({
            error: 'Endpoint conflict',
            message: `Endpoint ${method} ${path} already exists for this API`,
            timestamp: new Date().toISOString(),
          }, 409)
        }
      }

      const updatedEndpoint = await endpointService.update(endpointId, updates)

      if (!updatedEndpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        message: 'Endpoint updated successfully',
        data: updatedEndpoint,
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error updating endpoint:', error)

      if (error instanceof Error && error.message.includes('already exists')) {
        return c.json({
          error: 'Endpoint conflict',
          message: error.message,
          timestamp: new Date().toISOString(),
        }, 409)
      }

      return c.json({
        error: 'Internal server error',
        message: 'Failed to update endpoint',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// DELETE /apis/:apiId/endpoints/:endpointId - Delete endpoint
endpointRouter.delete('/:endpointId',
  validateParam(endpointParamSchema),
  async (c) => {
    try {
      const { apiId, endpointId } = c.req.valid('param')

      // Check if API exists
      const api = await apiService.findById(apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${apiId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const existingEndpoint = await endpointService.findById(endpointId)
      if (!existingEndpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify endpoint belongs to the specified API
      if (existingEndpoint.apiId !== apiId) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not belong to API ${apiId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const deleted = await endpointService.delete(endpointId)

      if (!deleted) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        message: 'Endpoint deleted successfully',
        data: {
          id: endpointId,
          method: existingEndpoint.method,
          path: existingEndpoint.path,
        },
        api: {
          id: api.id,
          name: api.name,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error deleting endpoint:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to delete endpoint',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /apis/:apiId/endpoints/:endpointId/default-scenario - Set default scenario
endpointRouter.post('/:endpointId/default-scenario',
  validateParam(endpointParamSchema),
  validateJson(setDefaultScenarioSchema),
  async (c) => {
    try {
      const { apiId, endpointId } = c.req.valid('param')
      const { scenarioId } = c.req.valid('json')

      // Check if API exists
      const api = await apiService.findById(apiId)
      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${apiId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const existingEndpoint = await endpointService.findById(endpointId)
      if (!existingEndpoint) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Verify endpoint belongs to the specified API
      if (existingEndpoint.apiId !== apiId) {
        return c.json({
          error: 'Endpoint not found',
          message: `Endpoint with ID ${endpointId} does not belong to API ${apiId}`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      const updatedEndpoint = await endpointService.setDefaultScenario(endpointId, scenarioId)

      if (!updatedEndpoint) {
        return c.json({
          error: 'Failed to set default scenario',
          message: 'Could not update endpoint with default scenario',
          timestamp: new Date().toISOString(),
        }, 400)
      }

      return c.json({
        message: 'Default scenario set successfully',
        data: updatedEndpoint,
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

export { endpointRouter }