import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { mockServerManager, monitoringService } from '../services/index.js'

const mockServerRouter = new Hono()

// Validation schemas
const StartServerSchema = z.object({
  force: z.boolean().default(false),
})

const StopServerSchema = z.object({
  graceful: z.boolean().default(true),
})

const LogFiltersSchema = z.object({
  method: z.string().optional(),
  statusCode: z.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  search: z.string().optional(),
})

/**
 * Start a mock server for an API
 */
mockServerRouter.post('/:apiId/start', zValidator('json', StartServerSchema), async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const { force } = c.req.valid('json')

    const serverInstance = await mockServerManager.startServer({ apiId, force })

    return c.json({
      success: true,
      message: `Mock server started for API ${apiId}`,
      data: {
        apiId: serverInstance.apiId,
        port: serverInstance.port,
        status: serverInstance.status,
        startedAt: serverInstance.startedAt,
      },
    })
  } catch (error) {
    console.error('Error starting mock server:', error)
    return c.json({
      success: false,
      error: 'Failed to start mock server',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Stop a mock server for an API
 */
mockServerRouter.post('/:apiId/stop', zValidator('json', StopServerSchema), async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const { graceful } = c.req.valid('json')

    await mockServerManager.stopServer({ apiId, graceful })

    return c.json({
      success: true,
      message: `Mock server stopped for API ${apiId}`,
    })
  } catch (error) {
    console.error('Error stopping mock server:', error)
    return c.json({
      success: false,
      error: 'Failed to stop mock server',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Restart a mock server for an API
 */
mockServerRouter.post('/:apiId/restart', async (c) => {
  try {
    const apiId = c.req.param('apiId')

    const serverInstance = await mockServerManager.restartServer(apiId)

    return c.json({
      success: true,
      message: `Mock server restarted for API ${apiId}`,
      data: {
        apiId: serverInstance.apiId,
        port: serverInstance.port,
        status: serverInstance.status,
        startedAt: serverInstance.startedAt,
        restartCount: serverInstance.restartCount,
      },
    })
  } catch (error) {
    console.error('Error restarting mock server:', error)
    return c.json({
      success: false,
      error: 'Failed to restart mock server',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get status of a mock server
 */
mockServerRouter.get('/:apiId/status', async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const serverInstance = mockServerManager.getServerInstance(apiId)

    if (!serverInstance) {
      return c.json({
        success: true,
        data: {
          apiId,
          status: 'stopped',
          port: null,
        },
      })
    }

    return c.json({
      success: true,
      data: {
        apiId: serverInstance.apiId,
        port: serverInstance.port,
        status: serverInstance.status,
        startedAt: serverInstance.startedAt,
        restartCount: serverInstance.restartCount,
        uptime: Date.now() - serverInstance.startedAt.getTime(),
      },
    })
  } catch (error) {
    console.error('Error getting server status:', error)
    return c.json({
      success: false,
      error: 'Failed to get server status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get all running mock servers
 */
mockServerRouter.get('/', async (c) => {
  try {
    const servers = mockServerManager.getAllServerInstances()

    return c.json({
      success: true,
      data: servers.map(server => ({
        apiId: server.apiId,
        port: server.port,
        status: server.status,
        startedAt: server.startedAt,
        restartCount: server.restartCount,
        uptime: Date.now() - server.startedAt.getTime(),
      })),
    })
  } catch (error) {
    console.error('Error getting server list:', error)
    return c.json({
      success: false,
      error: 'Failed to get server list',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get logs for a specific mock server
 */
mockServerRouter.get('/:apiId/logs', zValidator('query', LogFiltersSchema), async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const filters = c.req.valid('query')

    // Convert string dates to Date objects if provided
    const enhancedFilters = {
      ...filters,
      apiId,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    }

    const result = await monitoringService.getLogs(enhancedFilters)

    return c.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: filters.limit || 100,
          offset: filters.offset || 0,
          hasMore: result.hasMore,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching server logs:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch server logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get metrics for a specific mock server
 */
mockServerRouter.get('/:apiId/metrics', zValidator('query', z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})), async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const query = c.req.valid('query')

    const timeRange = query.startDate && query.endDate ? {
      start: new Date(query.startDate),
      end: new Date(query.endDate),
    } : undefined

    const metrics = await monitoringService.getApiMetrics(apiId, timeRange)

    return c.json({
      success: true,
      data: metrics,
    })
  } catch (error) {
    console.error('Error fetching server metrics:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch server metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Clear logs for a specific mock server
 */
mockServerRouter.delete('/:apiId/logs', async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const deletedCount = await monitoringService.clearApiLogs(apiId)

    return c.json({
      success: true,
      message: `Cleared ${deletedCount} logs for API ${apiId}`,
      data: { deletedCount },
    })
  } catch (error) {
    console.error('Error clearing server logs:', error)
    return c.json({
      success: false,
      error: 'Failed to clear server logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

export { mockServerRouter }