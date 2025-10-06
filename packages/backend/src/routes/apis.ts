import { Hono } from 'hono'
import { validateJson, validateQuery, validateParam, idParamSchema, paginationQuerySchema } from '../middleware/index.js'
import { ApiService } from '../db/services/api-service.js'
import {
  CreateApiRequestSchema,
  UpdateApiRequestSchema,
  type CreateApiRequest,
  type UpdateApiRequest
} from '../db/types.js'
import { z } from 'zod'

const apiRouter = new Hono()
const apiService = new ApiService()

// Query schema for API listing with status filter
const apiListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
})



// GET /apis - List all APIs with optional filtering
apiRouter.get('/',
  validateQuery(apiListQuerySchema),
  async (c) => {
    try {
      const { page, limit, sort, order, status } = c.req.valid('query')

      let apis = await apiService.findAll()

      // Filter by status if provided
      if (status) {
        apis = apis.filter(api => api.status === status)
      }

      // Apply sorting
      if (sort) {
        apis.sort((a, b) => {
          const aVal = (a as any)[sort] || ''
          const bVal = (b as any)[sort] || ''
          const comparison = aVal.toString().localeCompare(bVal.toString())
          return order === 'desc' ? -comparison : comparison
        })
      }

      // Apply pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedApis = apis.slice(startIndex, endIndex)

      return c.json({
        data: paginatedApis,
        pagination: {
          page,
          limit,
          total: apis.length,
          totalPages: Math.ceil(apis.length / limit),
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching APIs:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch APIs',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// GET /apis/active - Get all active APIs
apiRouter.get('/active',
  async (c) => {
    try {
      const activeApis = await apiService.findActive()

      return c.json({
        data: activeApis,
        count: activeApis.length,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching active APIs:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch active APIs',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// GET /apis/:id - Get single API with endpoints
apiRouter.get('/:id',
  validateParam(idParamSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const api = await apiService.findByIdWithEndpoints(id)

      if (!api) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        data: api,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error fetching API:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to fetch API',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /apis - Create new API
apiRouter.post('/',
  validateJson(CreateApiRequestSchema),
  async (c) => {
    try {
      const data: CreateApiRequest = c.req.valid('json')

      // Find next available port (avoiding port 5000)
      const port = await apiService.findNextAvailablePort()

      const newApi = await apiService.create({
        ...data,
        port,
      })

      return c.json({
        message: 'API created successfully',
        data: newApi,
        timestamp: new Date().toISOString(),
      }, 201)
    } catch (error) {
      console.error('Error creating API:', error)

      if (error instanceof Error) {
        if (error.message.includes('Port') && error.message.includes('already in use')) {
          return c.json({
            error: 'Port conflict',
            message: error.message,
            timestamp: new Date().toISOString(),
          }, 409)
        }

        if (error.message.includes('No available ports')) {
          return c.json({
            error: 'No available ports',
            message: 'All ports in the allowed range are in use',
            timestamp: new Date().toISOString(),
          }, 503)
        }
      }

      return c.json({
        error: 'Internal server error',
        message: 'Failed to create API',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// PUT /apis/:id - Update API
apiRouter.put('/:id',
  validateParam(idParamSchema),
  validateJson(UpdateApiRequestSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')
      const updates: UpdateApiRequest = c.req.valid('json')

      const existingApi = await apiService.findById(id)
      if (!existingApi) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // If trying to activate an API, check if port is available
      if (updates.status === 'active' && existingApi.status === 'inactive') {
        const isPortAvailable = await apiService.isPortAvailable(existingApi.port, id)
        if (!isPortAvailable) {
          return c.json({
            error: 'Port conflict',
            message: `Port ${existingApi.port} is already in use by another API`,
            timestamp: new Date().toISOString(),
          }, 409)
        }
      }

      const updatedApi = await apiService.update(id, updates)

      if (!updatedApi) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        message: 'API updated successfully',
        data: updatedApi,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error updating API:', error)

      if (error instanceof Error && error.message.includes('Port is already in use')) {
        return c.json({
          error: 'Port conflict',
          message: error.message,
          timestamp: new Date().toISOString(),
        }, 409)
      }

      return c.json({
        error: 'Internal server error',
        message: 'Failed to update API',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// DELETE /apis/:id - Delete API
apiRouter.delete('/:id',
  validateParam(idParamSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')

      const existingApi = await apiService.findById(id)
      if (!existingApi) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      // Check if API is active and prevent deletion
      if (existingApi.status === 'active') {
        return c.json({
          error: 'Cannot delete active API',
          message: 'Please deactivate the API before deleting it',
          timestamp: new Date().toISOString(),
        }, 400)
      }

      const deleted = await apiService.delete(id)

      if (!deleted) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      return c.json({
        message: 'API deleted successfully',
        data: { id },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error deleting API:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to delete API',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /apis/:id/start - Start/activate API
apiRouter.post('/:id/start',
  validateParam(idParamSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')

      const existingApi = await apiService.findById(id)
      if (!existingApi) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      if (existingApi.status === 'active') {
        return c.json({
          error: 'API already active',
          message: 'API is already running',
          timestamp: new Date().toISOString(),
        }, 400)
      }

      // Check if port is available
      const isPortAvailable = await apiService.isPortAvailable(existingApi.port, id)
      if (!isPortAvailable) {
        return c.json({
          error: 'Port conflict',
          message: `Port ${existingApi.port} is already in use by another API`,
          timestamp: new Date().toISOString(),
        }, 409)
      }

      const updatedApi = await apiService.update(id, { status: 'active' })

      // TODO: In task 4.2, we'll implement actual mock server spawning here
      // For now, we just update the status in the database

      return c.json({
        message: 'API started successfully',
        data: updatedApi,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error starting API:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to start API',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

// POST /apis/:id/stop - Stop/deactivate API
apiRouter.post('/:id/stop',
  validateParam(idParamSchema),
  async (c) => {
    try {
      const { id } = c.req.valid('param')

      const existingApi = await apiService.findById(id)
      if (!existingApi) {
        return c.json({
          error: 'API not found',
          message: `API with ID ${id} does not exist`,
          timestamp: new Date().toISOString(),
        }, 404)
      }

      if (existingApi.status === 'inactive') {
        return c.json({
          error: 'API already inactive',
          message: 'API is already stopped',
          timestamp: new Date().toISOString(),
        }, 400)
      }

      const updatedApi = await apiService.update(id, { status: 'inactive' })

      // TODO: In task 4.2, we'll implement actual mock server termination here
      // For now, we just update the status in the database

      return c.json({
        message: 'API stopped successfully',
        data: updatedApi,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error stopping API:', error)
      return c.json({
        error: 'Internal server error',
        message: 'Failed to stop API',
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }
)

export { apiRouter }