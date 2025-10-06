import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { requestLogs } from '../db/schema.js'
import type {
  RequestLog,
  NewRequestLog,
  RequestHeaders,
  ResponseHeaders,
  LogFilters
} from '../db/types.js'

export interface CreateLogRequest {
  apiId: string
  endpointId?: string
  scenarioId?: string
  method: string
  path: string
  requestHeaders: RequestHeaders
  requestBody?: any
  responseStatus: number
  responseHeaders: ResponseHeaders
  responseBody?: any
  duration?: number
}

export class RequestLogService {
  /**
   * Create a new request log
   */
  async create(data: CreateLogRequest): Promise<RequestLog> {
    const newLog: NewRequestLog = {
      apiId: data.apiId,
      endpointId: data.endpointId,
      scenarioId: data.scenarioId,
      method: data.method,
      path: data.path,
      requestHeaders: data.requestHeaders,
      requestBody: data.requestBody,
      responseStatus: data.responseStatus,
      responseHeaders: data.responseHeaders,
      responseBody: data.responseBody,
      duration: data.duration,
    }

    const [log] = await db.insert(requestLogs).values(newLog).returning()
    return log
  }

  /**
   * Get logs with filters
   */
  async findWithFilters(filters: LogFilters = {}): Promise<RequestLog[]> {
    const conditions = []

    if (filters.apiId) {
      conditions.push(eq(requestLogs.apiId, filters.apiId))
    }

    if (filters.endpointId) {
      conditions.push(eq(requestLogs.endpointId, filters.endpointId))
    }

    if (filters.method) {
      conditions.push(eq(requestLogs.method, filters.method))
    }

    if (filters.statusCode) {
      conditions.push(eq(requestLogs.responseStatus, filters.statusCode))
    }

    if (filters.startDate) {
      conditions.push(gte(requestLogs.timestamp, filters.startDate))
    }

    if (filters.endDate) {
      conditions.push(lte(requestLogs.timestamp, filters.endDate))
    }

    // Build the query step by step to avoid TypeScript issues
    const baseQuery = db.select().from(requestLogs)

    const whereQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery

    const orderedQuery = whereQuery.orderBy(desc(requestLogs.timestamp))

    const limitedQuery = filters.limit
      ? orderedQuery.limit(filters.limit)
      : orderedQuery

    const finalQuery = filters.offset
      ? limitedQuery.offset(filters.offset)
      : limitedQuery

    return await finalQuery
  }

  /**
   * Get logs for a specific API
   */
  async findByApiId(apiId: string, limit: number = 100, offset: number = 0): Promise<RequestLog[]> {
    return await this.findWithFilters({ apiId, limit, offset })
  }

  /**
   * Get logs for a specific endpoint
   */
  async findByEndpointId(endpointId: string, limit: number = 100, offset: number = 0): Promise<RequestLog[]> {
    return await this.findWithFilters({ endpointId, limit, offset })
  }

  /**
   * Get recent logs
   */
  async findRecent(limit: number = 50): Promise<RequestLog[]> {
    return await db
      .select()
      .from(requestLogs)
      .orderBy(desc(requestLogs.timestamp))
      .limit(limit)
  }

  /**
   * Get log by ID
   */
  async findById(id: string): Promise<RequestLog | null> {
    const [log] = await db.select().from(requestLogs).where(eq(requestLogs.id, id)).limit(1)
    return log || null
  }

  /**
   * Delete logs older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await db
      .delete(requestLogs)
      .where(lte(requestLogs.timestamp, date))

    return result.rowsAffected
  }

  /**
   * Delete logs for a specific API
   */
  async deleteByApiId(apiId: string): Promise<number> {
    const result = await db
      .delete(requestLogs)
      .where(eq(requestLogs.apiId, apiId))

    return result.rowsAffected
  }

  /**
   * Delete logs for a specific endpoint
   */
  async deleteByEndpointId(endpointId: string): Promise<number> {
    const result = await db
      .delete(requestLogs)
      .where(eq(requestLogs.endpointId, endpointId))

    return result.rowsAffected
  }

  /**
   * Count logs with filters
   */
  async countWithFilters(filters: Omit<LogFilters, 'limit' | 'offset'> = {}): Promise<number> {
    const conditions = []

    if (filters.apiId) {
      conditions.push(eq(requestLogs.apiId, filters.apiId))
    }

    if (filters.endpointId) {
      conditions.push(eq(requestLogs.endpointId, filters.endpointId))
    }

    if (filters.method) {
      conditions.push(eq(requestLogs.method, filters.method))
    }

    if (filters.statusCode) {
      conditions.push(eq(requestLogs.responseStatus, filters.statusCode))
    }

    if (filters.startDate) {
      conditions.push(gte(requestLogs.timestamp, filters.startDate))
    }

    if (filters.endDate) {
      conditions.push(lte(requestLogs.timestamp, filters.endDate))
    }

    const baseQuery = db.select({ count: sql<number>`count(*)` }).from(requestLogs)

    const finalQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery

    const [result] = await finalQuery
    return result.count
  }

  /**
   * Get statistics for an API
   */
  async getApiStats(apiId: string, startDate?: Date, endDate?: Date) {
    const filters: LogFilters = { apiId }
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate

    const logs = await this.findWithFilters(filters)

    const stats = {
      totalRequests: logs.length,
      successRequests: logs.filter(log => log.responseStatus >= 200 && log.responseStatus < 300).length,
      errorRequests: logs.filter(log => log.responseStatus >= 400).length,
      averageResponseTime: 0,
      statusCodes: {} as Record<number, number>,
      methods: {} as Record<string, number>,
    }

    if (logs.length > 0) {
      const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0)
      stats.averageResponseTime = totalDuration / logs.length

      // Count status codes
      logs.forEach(log => {
        stats.statusCodes[log.responseStatus] = (stats.statusCodes[log.responseStatus] || 0) + 1
      })

      // Count methods
      logs.forEach(log => {
        stats.methods[log.method] = (stats.methods[log.method] || 0) + 1
      })
    }

    return stats
  }

  /**
   * Clean up old logs (keep only recent N logs per API)
   */
  async cleanupOldLogs(keepPerApi: number = 1000): Promise<number> {
    // Get all API IDs
    const apiIds = await db
      .selectDistinct({ apiId: requestLogs.apiId })
      .from(requestLogs)

    let totalDeleted = 0

    for (const { apiId } of apiIds) {
      // Get logs for this API, ordered by timestamp desc
      const logs = await db
        .select({ id: requestLogs.id })
        .from(requestLogs)
        .where(eq(requestLogs.apiId, apiId))
        .orderBy(desc(requestLogs.timestamp))

      // If we have more than keepPerApi logs, delete the oldest ones
      if (logs.length > keepPerApi) {
        const logsToDelete = logs.slice(keepPerApi)
        const idsToDelete = logsToDelete.map(log => log.id)

        for (const id of idsToDelete) {
          const result = await db
            .delete(requestLogs)
            .where(eq(requestLogs.id, id))

          totalDeleted += result.rowsAffected
        }
      }
    }

    return totalDeleted
  }
}