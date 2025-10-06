import { EventEmitter } from 'events'
import { z } from 'zod'
import { RequestLogService, CreateLogRequest } from './request-log-service.js'
import type { RequestLog, LogFilters } from '../db/types.js'

// Monitoring configuration
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
const MAX_LOGS_PER_API = 10000
const LOG_RETENTION_DAYS = 30

// Event types for real-time monitoring
export interface MonitoringEvents {
  'request-logged': (log: RequestLog) => void
  'api-activity': (apiId: string, activity: ApiActivity) => void
  'cleanup-completed': (stats: CleanupStats) => void
  'error-threshold-exceeded': (apiId: string, errorRate: number) => void
}

export interface ApiActivity {
  apiId: string
  requestCount: number
  errorCount: number
  averageResponseTime: number
  lastRequestAt: Date
}

export interface CleanupStats {
  deletedLogs: number
  archivedLogs: number
  totalProcessed: number
  duration: number
}

export interface MonitoringMetrics {
  totalRequests: number
  totalErrors: number
  averageResponseTime: number
  requestsPerMinute: number
  errorRate: number
  topEndpoints: Array<{ path: string; count: number }>
  statusCodeDistribution: Record<number, number>
  methodDistribution: Record<string, number>
}

// Validation schemas
const LogFilterSchema = z.object({
  apiId: z.string().optional(),
  endpointId: z.string().optional(),
  method: z.string().optional(),
  statusCode: z.number().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  search: z.string().optional(),
})

const CleanupConfigSchema = z.object({
  retentionDays: z.number().min(1).default(LOG_RETENTION_DAYS),
  maxLogsPerApi: z.number().min(100).default(MAX_LOGS_PER_API),
  archiveOldLogs: z.boolean().default(false),
})

export type EnhancedLogFilters = z.infer<typeof LogFilterSchema>
export type CleanupConfig = z.infer<typeof CleanupConfigSchema>

export class MonitoringService extends EventEmitter {
  private requestLogService: RequestLogService
  private cleanupInterval?: NodeJS.Timeout
  private activityCache = new Map<string, ApiActivity>()
  private metricsCache = new Map<string, { metrics: MonitoringMetrics; timestamp: Date }>()
  private readonly METRICS_CACHE_TTL = 60000 // 1 minute
  private readonly ERROR_THRESHOLD = 0.1 // 10% error rate threshold

  constructor(requestLogService: RequestLogService) {
    super()
    this.requestLogService = requestLogService
  }

  /**
   * Initialize monitoring service
   */
  async initialize(): Promise<void> {
    console.log('📊 Initializing Monitoring Service...')

    // Start periodic cleanup
    this.startPeriodicCleanup()

    // Initialize activity cache
    await this.refreshActivityCache()

    console.log('📊 Monitoring Service initialized')
  }

  /**
   * Log a request with real-time monitoring
   */
  async logRequest(data: CreateLogRequest): Promise<RequestLog> {
    try {
      // Create the log entry
      const log = await this.requestLogService.create(data)

      // Update activity cache
      await this.updateActivityCache(data.apiId, log)

      // Check error thresholds
      await this.checkErrorThresholds(data.apiId)

      // Emit real-time event
      this.emit('request-logged', log)

      // Invalidate metrics cache for this API
      this.metricsCache.delete(data.apiId)

      return log

    } catch (error) {
      console.error('❌ Error logging request:', error)
      throw error
    }
  }

  /**
   * Get enhanced logs with filtering and search
   */
  async getLogs(filters: EnhancedLogFilters): Promise<{
    logs: RequestLog[]
    total: number
    hasMore: boolean
  }> {
    const validatedFilters = LogFilterSchema.parse(filters)

    // Convert to base log filters
    const baseFilters: LogFilters = {
      apiId: validatedFilters.apiId,
      endpointId: validatedFilters.endpointId,
      method: validatedFilters.method as any, // Type assertion needed due to string vs enum mismatch
      statusCode: validatedFilters.statusCode,
      startDate: validatedFilters.startDate,
      endDate: validatedFilters.endDate,
      limit: validatedFilters.limit,
      offset: validatedFilters.offset,
    }

    // Get logs and total count
    const [logs, total] = await Promise.all([
      this.requestLogService.findWithFilters(baseFilters),
      this.requestLogService.countWithFilters(baseFilters),
    ])

    // Apply search filter if provided
    let filteredLogs = logs
    if (validatedFilters.search) {
      const searchTerm = validatedFilters.search.toLowerCase()
      filteredLogs = logs.filter(log =>
        log.path.toLowerCase().includes(searchTerm) ||
        log.method.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.requestBody || {}).toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.responseBody || {}).toLowerCase().includes(searchTerm)
      )
    }

    return {
      logs: filteredLogs,
      total,
      hasMore: validatedFilters.offset + filteredLogs.length < total,
    }
  }

  /**
   * Get real-time metrics for an API
   */
  async getApiMetrics(apiId: string, timeRange?: { start: Date; end: Date }): Promise<MonitoringMetrics> {
    const cacheKey = `${apiId}-${timeRange?.start?.getTime() || 'all'}-${timeRange?.end?.getTime() || 'all'}`

    // Check cache first
    const cached = this.metricsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp.getTime() < this.METRICS_CACHE_TTL) {
      return cached.metrics
    }

    // Calculate metrics
    const filters: LogFilters = { apiId }
    if (timeRange) {
      filters.startDate = timeRange.start
      filters.endDate = timeRange.end
    }

    const logs = await this.requestLogService.findWithFilters(filters)
    const metrics = this.calculateMetrics(logs, timeRange)

    // Cache the results
    this.metricsCache.set(cacheKey, {
      metrics,
      timestamp: new Date(),
    })

    return metrics
  }

  /**
   * Get activity summary for all APIs
   */
  getApiActivities(): ApiActivity[] {
    return Array.from(this.activityCache.values())
  }

  /**
   * Get activity for a specific API
   */
  getApiActivity(apiId: string): ApiActivity | null {
    return this.activityCache.get(apiId) || null
  }

  /**
   * Perform log cleanup with configuration
   */
  async performCleanup(config?: Partial<CleanupConfig>): Promise<CleanupStats> {
    const validatedConfig = CleanupConfigSchema.parse(config || {})
    const startTime = Date.now()

    console.log('🧹 Starting log cleanup...', validatedConfig)

    try {
      let deletedLogs = 0
      let archivedLogs = 0

      // Delete logs older than retention period
      const cutoffDate = new Date(Date.now() - validatedConfig.retentionDays * 24 * 60 * 60 * 1000)
      deletedLogs += await this.requestLogService.deleteOlderThan(cutoffDate)

      // Clean up excess logs per API
      deletedLogs += await this.requestLogService.cleanupOldLogs(validatedConfig.maxLogsPerApi)

      const stats: CleanupStats = {
        deletedLogs,
        archivedLogs,
        totalProcessed: deletedLogs + archivedLogs,
        duration: Date.now() - startTime,
      }

      console.log('🧹 Cleanup completed:', stats)
      this.emit('cleanup-completed', stats)

      return stats

    } catch (error) {
      console.error('❌ Error during cleanup:', error)
      throw error
    }
  }

  /**
   * Export logs for external analysis
   */
  async exportLogs(filters: EnhancedLogFilters, format: 'json' | 'csv' = 'json'): Promise<string> {
    const { logs } = await this.getLogs({ ...filters, limit: 10000 })

    if (format === 'csv') {
      return this.convertLogsToCSV(logs)
    }

    return JSON.stringify(logs, null, 2)
  }

  /**
   * Get system-wide monitoring statistics
   */
  async getSystemStats(): Promise<{
    totalApis: number
    activeApis: number
    totalRequests: number
    totalErrors: number
    systemHealth: 'healthy' | 'warning' | 'critical'
  }> {
    const activities = this.getApiActivities()
    const totalRequests = activities.reduce((sum, activity) => sum + activity.requestCount, 0)
    const totalErrors = activities.reduce((sum, activity) => sum + activity.errorCount, 0)
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (errorRate > 0.2) {
      systemHealth = 'critical'
    } else if (errorRate > 0.1) {
      systemHealth = 'warning'
    }

    return {
      totalApis: activities.length,
      activeApis: activities.filter(a => Date.now() - a.lastRequestAt.getTime() < 300000).length, // Active in last 5 minutes
      totalRequests,
      totalErrors,
      systemHealth,
    }
  }

  /**
   * Clear logs for a specific API
   */
  async clearApiLogs(apiId: string): Promise<number> {
    try {
      const deletedCount = await this.requestLogService.deleteByApiId(apiId)

      // Clear activity cache for this API
      this.activityCache.delete(apiId)

      // Clear metrics cache entries for this API
      for (const [key] of this.metricsCache) {
        if (key.startsWith(`${apiId}-`)) {
          this.metricsCache.delete(key)
        }
      }

      console.log(`🧹 Cleared ${deletedCount} logs for API ${apiId}`)
      return deletedCount

    } catch (error) {
      console.error('❌ Error clearing API logs:', error)
      throw error
    }
  }

  /**
   * Shutdown monitoring service
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Monitoring Service...')

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Clear caches
    this.activityCache.clear()
    this.metricsCache.clear()

    console.log('🛑 Monitoring Service shut down')
  }

  /**
   * Calculate metrics from logs
   */
  private calculateMetrics(logs: RequestLog[], timeRange?: { start: Date; end: Date }): MonitoringMetrics {
    const totalRequests = logs.length
    const totalErrors = logs.filter(log => log.responseStatus >= 400).length
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0)
    const averageResponseTime = totalRequests > 0 ? totalDuration / totalRequests : 0

    // Calculate requests per minute
    let requestsPerMinute = 0
    if (timeRange && totalRequests > 0) {
      const durationMinutes = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60)
      requestsPerMinute = durationMinutes > 0 ? totalRequests / durationMinutes : 0
    }

    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0

    // Top endpoints
    const endpointCounts = new Map<string, number>()
    logs.forEach(log => {
      const key = `${log.method} ${log.path}`
      endpointCounts.set(key, (endpointCounts.get(key) || 0) + 1)
    })

    const topEndpoints = Array.from(endpointCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }))

    // Status code distribution
    const statusCodeDistribution: Record<number, number> = {}
    logs.forEach(log => {
      statusCodeDistribution[log.responseStatus] = (statusCodeDistribution[log.responseStatus] || 0) + 1
    })

    // Method distribution
    const methodDistribution: Record<string, number> = {}
    logs.forEach(log => {
      methodDistribution[log.method] = (methodDistribution[log.method] || 0) + 1
    })

    return {
      totalRequests,
      totalErrors,
      averageResponseTime,
      requestsPerMinute,
      errorRate,
      topEndpoints,
      statusCodeDistribution,
      methodDistribution,
    }
  }

  /**
   * Update activity cache for an API
   */
  private async updateActivityCache(apiId: string, log: RequestLog): Promise<void> {
    let activity = this.activityCache.get(apiId)

    if (!activity) {
      activity = {
        apiId,
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastRequestAt: new Date(),
      }
    }

    // Update counters
    activity.requestCount++
    if (log.responseStatus >= 400) {
      activity.errorCount++
    }

    // Update average response time
    const totalTime = activity.averageResponseTime * (activity.requestCount - 1) + (log.duration || 0)
    activity.averageResponseTime = totalTime / activity.requestCount

    activity.lastRequestAt = new Date()

    this.activityCache.set(apiId, activity)
    this.emit('api-activity', apiId, activity)
  }

  /**
   * Check error thresholds and emit warnings
   */
  private async checkErrorThresholds(apiId: string): Promise<void> {
    const activity = this.activityCache.get(apiId)
    if (!activity || activity.requestCount < 10) {
      return // Need minimum requests to calculate meaningful error rate
    }

    const errorRate = activity.errorCount / activity.requestCount
    if (errorRate > this.ERROR_THRESHOLD) {
      this.emit('error-threshold-exceeded', apiId, errorRate)
    }
  }

  /**
   * Refresh activity cache from database
   */
  private async refreshActivityCache(): Promise<void> {
    try {
      // Get recent activity for all APIs (last 24 hours)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentLogs = await this.requestLogService.findWithFilters({
        startDate: since,
        limit: 10000,
      })

      // Group by API and calculate activity
      const apiActivities = new Map<string, ApiActivity>()

      for (const log of recentLogs) {
        let activity = apiActivities.get(log.apiId)
        if (!activity) {
          activity = {
            apiId: log.apiId,
            requestCount: 0,
            errorCount: 0,
            averageResponseTime: 0,
            lastRequestAt: log.timestamp,
          }
        }

        activity.requestCount++
        if (log.responseStatus >= 400) {
          activity.errorCount++
        }

        const totalTime = activity.averageResponseTime * (activity.requestCount - 1) + (log.duration || 0)
        activity.averageResponseTime = totalTime / activity.requestCount

        if (log.timestamp > activity.lastRequestAt) {
          activity.lastRequestAt = log.timestamp
        }

        apiActivities.set(log.apiId, activity)
      }

      this.activityCache = apiActivities
      console.log(`📊 Refreshed activity cache for ${apiActivities.size} APIs`)

    } catch (error) {
      console.error('❌ Error refreshing activity cache:', error)
    }
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup()
      } catch (error) {
        console.error('❌ Error in periodic cleanup:', error)
      }
    }, CLEANUP_INTERVAL)

    console.log(`🧹 Periodic cleanup scheduled every ${CLEANUP_INTERVAL / 1000 / 60 / 60} hours`)
  }

  /**
   * Convert logs to CSV format
   */
  private convertLogsToCSV(logs: RequestLog[]): string {
    if (logs.length === 0) {
      return 'timestamp,apiId,method,path,statusCode,duration,endpointId,scenarioId\n'
    }

    const headers = 'timestamp,apiId,method,path,statusCode,duration,endpointId,scenarioId\n'
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.apiId,
      log.method,
      log.path,
      log.responseStatus,
      log.duration || 0,
      log.endpointId || '',
      log.scenarioId || '',
    ].join(',')).join('\n')

    return headers + rows
  }
}

