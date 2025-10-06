import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { monitoringService, requestLogService } from '../services/index.js'
import { LogFiltersSchema, PaginationSchema } from '../db/types.js'

const logsRouter = new Hono()

// Enhanced log filters schema with additional monitoring features
const EnhancedLogFiltersSchema = LogFiltersSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(['timestamp', 'duration', 'status', 'method']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).merge(PaginationSchema)

const ExportFiltersSchema = EnhancedLogFiltersSchema.extend({
  format: z.enum(['json', 'csv']).default('json'),
})

const CleanupConfigSchema = z.object({
  retentionDays: z.number().min(1).max(365).default(30),
  maxLogsPerApi: z.number().min(100).max(100000).default(10000),
  archiveOldLogs: z.boolean().default(false),
})

/**
 * Get logs with enhanced filtering and search
 * GET /logs?apiId=xxx&method=GET&statusCode=200&search=error&limit=50&offset=0
 */
logsRouter.get('/', zValidator('query', EnhancedLogFiltersSchema), async (c) => {
  try {
    const filters = c.req.valid('query')

    // Convert string dates to Date objects
    const enhancedFilters = {
      ...filters,
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
          limit: filters.limit,
          offset: filters.offset,
          hasMore: result.hasMore,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching logs:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get logs for a specific API
 * GET /logs/api/:apiId
 */
logsRouter.get('/api/:apiId', zValidator('query', PaginationSchema), async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const { limit, offset } = c.req.valid('query')

    const logs = await requestLogService.findByApiId(apiId, limit, offset)
    const total = await requestLogService.countWithFilters({ apiId })

    return c.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logs.length < total,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching API logs:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch API logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get logs for a specific endpoint
 * GET /logs/endpoint/:endpointId
 */
logsRouter.get('/endpoint/:endpointId', zValidator('query', PaginationSchema), async (c) => {
  try {
    const endpointId = c.req.param('endpointId')
    const { limit, offset } = c.req.valid('query')

    const logs = await requestLogService.findByEndpointId(endpointId, limit, offset)
    const total = await requestLogService.countWithFilters({ endpointId })

    return c.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logs.length < total,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching endpoint logs:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch endpoint logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get a specific log entry by ID
 * GET /logs/:logId
 */
logsRouter.get('/:logId', async (c) => {
  try {
    const logId = c.req.param('logId')
    const log = await requestLogService.findById(logId)

    if (!log) {
      return c.json({
        success: false,
        error: 'Log not found',
        message: `Log with ID ${logId} does not exist`,
      }, 404)
    }

    return c.json({
      success: true,
      data: log,
    })
  } catch (error) {
    console.error('Error fetching log:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch log',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get recent logs across all APIs
 * GET /logs/recent?limit=50
 */
logsRouter.get('/recent', zValidator('query', z.object({ limit: z.number().min(1).max(1000).default(50) })), async (c) => {
  try {
    const { limit } = c.req.valid('query')
    const logs = await requestLogService.findRecent(limit)

    return c.json({
      success: true,
      data: logs,
    })
  } catch (error) {
    console.error('Error fetching recent logs:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch recent logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get API metrics and statistics
 * GET /logs/api/:apiId/metrics?startDate=xxx&endDate=xxx
 */
logsRouter.get('/api/:apiId/metrics', zValidator('query', z.object({
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
    console.error('Error fetching API metrics:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch API metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get system-wide statistics
 * GET /logs/system/stats
 */
logsRouter.get('/system/stats', async (c) => {
  try {
    const stats = await monitoringService.getSystemStats()

    return c.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('Error fetching system stats:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch system stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get API activity summary
 * GET /logs/activity
 */
logsRouter.get('/activity', async (c) => {
  try {
    const activities = monitoringService.getApiActivities()

    return c.json({
      success: true,
      data: activities,
    })
  } catch (error) {
    console.error('Error fetching API activities:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch API activities',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Get activity for a specific API
 * GET /logs/activity/:apiId
 */
logsRouter.get('/activity/:apiId', async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const activity = monitoringService.getApiActivity(apiId)

    if (!activity) {
      return c.json({
        success: false,
        error: 'Activity not found',
        message: `No activity found for API ${apiId}`,
      }, 404)
    }

    return c.json({
      success: true,
      data: activity,
    })
  } catch (error) {
    console.error('Error fetching API activity:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch API activity',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Export logs in various formats
 * POST /logs/export
 */
logsRouter.post('/export', zValidator('json', ExportFiltersSchema), async (c) => {
  try {
    const filters = c.req.valid('json')

    // Convert string dates to Date objects
    const enhancedFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    }

    const exportData = await monitoringService.exportLogs(enhancedFilters, filters.format)

    // Set appropriate headers for download
    const filename = `logs-${new Date().toISOString().split('T')[0]}.${filters.format}`
    const contentType = filters.format === 'csv' ? 'text/csv' : 'application/json'

    c.header('Content-Type', contentType)
    c.header('Content-Disposition', `attachment; filename="${filename}"`)

    return c.text(exportData)
  } catch (error) {
    console.error('Error exporting logs:', error)
    return c.json({
      success: false,
      error: 'Failed to export logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Perform log cleanup
 * POST /logs/cleanup
 */
logsRouter.post('/cleanup', zValidator('json', CleanupConfigSchema), async (c) => {
  try {
    const config = c.req.valid('json')
    const stats = await monitoringService.performCleanup(config)

    return c.json({
      success: true,
      message: 'Log cleanup completed successfully',
      data: stats,
    })
  } catch (error) {
    console.error('Error performing cleanup:', error)
    return c.json({
      success: false,
      error: 'Failed to perform cleanup',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Delete logs for a specific API
 * DELETE /logs/api/:apiId
 */
logsRouter.delete('/api/:apiId', async (c) => {
  try {
    const apiId = c.req.param('apiId')
    const deletedCount = await requestLogService.deleteByApiId(apiId)

    return c.json({
      success: true,
      message: `Deleted ${deletedCount} logs for API ${apiId}`,
      data: { deletedCount },
    })
  } catch (error) {
    console.error('Error deleting API logs:', error)
    return c.json({
      success: false,
      error: 'Failed to delete API logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Delete logs for a specific endpoint
 * DELETE /logs/endpoint/:endpointId
 */
logsRouter.delete('/endpoint/:endpointId', async (c) => {
  try {
    const endpointId = c.req.param('endpointId')
    const deletedCount = await requestLogService.deleteByEndpointId(endpointId)

    return c.json({
      success: true,
      message: `Deleted ${deletedCount} logs for endpoint ${endpointId}`,
      data: { deletedCount },
    })
  } catch (error) {
    console.error('Error deleting endpoint logs:', error)
    return c.json({
      success: false,
      error: 'Failed to delete endpoint logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

/**
 * Delete logs older than specified date
 * DELETE /logs/older-than/:date
 */
logsRouter.delete('/older-than/:date', async (c) => {
  try {
    const dateParam = c.req.param('date')
    const date = new Date(dateParam)

    if (isNaN(date.getTime())) {
      return c.json({
        success: false,
        error: 'Invalid date format',
        message: 'Date must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)',
      }, 400)
    }

    const deletedCount = await requestLogService.deleteOlderThan(date)

    return c.json({
      success: true,
      message: `Deleted ${deletedCount} logs older than ${date.toISOString()}`,
      data: { deletedCount, cutoffDate: date },
    })
  } catch (error) {
    console.error('Error deleting old logs:', error)
    return c.json({
      success: false,
      error: 'Failed to delete old logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// Internal endpoints for mock servers to use

const InternalLogRequestSchema = z.object({
  apiId: z.string(),
  endpointId: z.string().optional(),
  scenarioId: z.string().optional(),
  method: z.string(),
  path: z.string(),
  requestHeaders: z.record(z.string(), z.string()),
  requestBody: z.any().optional(),
  responseStatus: z.number(),
  responseHeaders: z.record(z.string(), z.string()),
  responseBody: z.any().optional(),
  duration: z.number().optional(),
})

/**
 * Internal endpoint for mock servers to create log entries
 * POST /logs/internal/create
 */
logsRouter.post('/internal/create', zValidator('json', InternalLogRequestSchema), async (c) => {
  try {
    const logData = c.req.valid('json')

    const log = await monitoringService.logRequest(logData)

    return c.json({
      success: true,
      data: { logId: log.id },
    })
  } catch (error) {
    console.error('Error creating internal log:', error)
    return c.json({
      success: false,
      error: 'Failed to create log',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

export { logsRouter }