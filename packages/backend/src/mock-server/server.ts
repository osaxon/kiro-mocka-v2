import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import type { Context, HonoRequest } from 'hono'

// Types for the mock server
interface ApiConfig {
  id: string
  name: string
  description?: string
  endpoints: EndpointConfig[]
}

interface EndpointConfig {
  id: string
  method: string
  path: string
  description?: string
  scenarios: ScenarioConfig[]
  defaultScenarioId: string
}

interface ScenarioConfig {
  id: string
  name: string
  statusCode: number
  responseHeaders?: Record<string, string>
  responseBody?: any
  conditions?: ScenarioCondition[]
  isDefault: boolean
}

interface ScenarioCondition {
  type: 'header' | 'query' | 'body'
  key: string
  operator: 'equals' | 'contains' | 'exists'
  value?: string
}

interface RequestLogData {
  apiId: string
  endpointId?: string
  scenarioId?: string
  method: string
  path: string
  requestHeaders: Record<string, string>
  requestBody?: any
  responseStatus: number
  responseHeaders: Record<string, string>
  responseBody?: any
  duration: number
}

class MockServer {
  private app: Hono
  private apiConfig: ApiConfig
  private port: number
  private managementApiUrl: string

  constructor(apiConfig: ApiConfig, port: number) {
    this.app = new Hono()
    this.apiConfig = apiConfig
    this.port = port
    this.managementApiUrl = process.env.MANAGEMENT_API_URL || 'http://localhost:3000'

    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    // Basic middleware
    this.app.use('*', logger())
    this.app.use('*', cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      allowHeaders: ['*'],
    }))

    // Request logging middleware
    this.app.use('*', async (c, next) => {
      const startTime = Date.now()

      await next()

      const duration = Date.now() - startTime

      // Log the request asynchronously
      this.logRequest({
        apiId: this.apiConfig.id,
        method: c.req.method,
        path: c.req.path,
        requestHeaders: this.getRequestHeaders(c.req),
        requestBody: await this.getRequestBody(c.req),
        responseStatus: c.res.status,
        responseHeaders: this.getResponseHeaders(c.res),
        responseBody: await this.getResponseBody(c.res),
        duration,
      }).catch(error => {
        console.error('Failed to log request:', error)
      })
    })
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        apiId: this.apiConfig.id,
        apiName: this.apiConfig.name,
        port: this.port,
        timestamp: new Date().toISOString(),
      })
    })

    // API info endpoint
    this.app.get('/info', (c) => {
      return c.json({
        api: {
          id: this.apiConfig.id,
          name: this.apiConfig.name,
          description: this.apiConfig.description,
          endpointCount: this.apiConfig.endpoints.length,
        },
        endpoints: this.apiConfig.endpoints.map(endpoint => ({
          id: endpoint.id,
          method: endpoint.method,
          path: endpoint.path,
          description: endpoint.description,
          scenarioCount: endpoint.scenarios.length,
        })),
        timestamp: new Date().toISOString(),
      })
    })

    // Set up dynamic routes for each endpoint
    for (const endpoint of this.apiConfig.endpoints) {
      this.setupEndpointRoute(endpoint)
    }

    // Catch-all for unmatched routes
    this.app.all('*', (c) => {
      return c.json({
        error: 'Endpoint not found',
        message: `No endpoint configured for ${c.req.method} ${c.req.path}`,
        apiId: this.apiConfig.id,
        availableEndpoints: this.apiConfig.endpoints.map(e => `${e.method} ${e.path}`),
        timestamp: new Date().toISOString(),
      }, 404)
    })
  }

  private setupEndpointRoute(endpoint: EndpointConfig): void {
    const method = endpoint.method.toLowerCase()
    const path = endpoint.path

    // Use the appropriate method based on the HTTP method
    switch (method) {
      case 'get':
        this.app.get(path, async (c: Context) => this.handleRequest(c, endpoint))
        break
      case 'post':
        this.app.post(path, async (c: Context) => this.handleRequest(c, endpoint))
        break
      case 'put':
        this.app.put(path, async (c: Context) => this.handleRequest(c, endpoint))
        break
      case 'delete':
        this.app.delete(path, async (c: Context) => this.handleRequest(c, endpoint))
        break
      case 'patch':
        this.app.patch(path, async (c: Context) => this.handleRequest(c, endpoint))
        break
      case 'head':
        // HEAD method is not directly available in Hono, use GET and return empty body
        this.app.get(path, async (c: Context) => {
          const result = await this.handleRequest(c, endpoint)
          // For HEAD requests, return the same headers but no body
          return new Response(null, {
            status: result.status,
            headers: result.headers
          })
        })
        break
      case 'options':
        this.app.options(path, async (c: Context) => this.handleRequest(c, endpoint))
        break
      default:
        console.warn(`Unsupported HTTP method: ${method}`)
    }
  }

  private async handleRequest(c: Context, endpoint: EndpointConfig) {
    const startTime = Date.now()

    try {
      // Find matching scenario
      const scenario = await this.findMatchingScenario(endpoint, c)

      if (!scenario) {
        return c.json({
          error: 'No matching scenario',
          message: 'No scenario found for this request',
          endpointId: endpoint.id,
          timestamp: new Date().toISOString(),
        }, 500)
      }

      // Set response headers
      if (scenario.responseHeaders) {
        for (const [key, value] of Object.entries(scenario.responseHeaders)) {
          c.header(key, value)
        }
      }

      // Set default content type if not specified
      if (!scenario.responseHeaders?.['content-type'] && !scenario.responseHeaders?.['Content-Type']) {
        c.header('Content-Type', 'application/json')
      }

      // Log the request with scenario info
      const duration = Date.now() - startTime
      this.logRequest({
        apiId: this.apiConfig.id,
        endpointId: endpoint.id,
        scenarioId: scenario.id,
        method: c.req.method,
        path: c.req.path,
        requestHeaders: this.getRequestHeaders(c.req),
        requestBody: await this.getRequestBody(c.req),
        responseStatus: scenario.statusCode,
        responseHeaders: scenario.responseHeaders || {},
        responseBody: scenario.responseBody,
        duration,
      }).catch(error => {
        console.error('Failed to log request:', error)
      })

      // Return the response with proper status code typing
      return c.json(scenario.responseBody || {}, scenario.statusCode as any)

    } catch (error) {
      console.error(`Error processing request for ${c.req.method} ${c.req.path}:`, error)

      return c.json({
        error: 'Internal server error',
        message: 'An error occurred while processing the request',
        endpointId: endpoint.id,
        timestamp: new Date().toISOString(),
      }, 500)
    }
  }

  private async findMatchingScenario(endpoint: EndpointConfig, c: Context): Promise<ScenarioConfig | null> {
    // First, try to find a scenario that matches conditions
    for (const scenario of endpoint.scenarios) {
      if (scenario.conditions && scenario.conditions.length > 0) {
        const matches = await this.evaluateScenarioConditions(scenario.conditions, c)
        if (matches) {
          return scenario
        }
      }
    }

    // If no conditional scenario matches, use the default scenario
    const defaultScenario = endpoint.scenarios.find(s => s.id === endpoint.defaultScenarioId) ||
      endpoint.scenarios.find(s => s.isDefault) ||
      endpoint.scenarios[0]

    return defaultScenario || null
  }

  private async evaluateScenarioConditions(conditions: ScenarioCondition[], c: Context): Promise<boolean> {
    for (const condition of conditions) {
      const matches = await this.evaluateCondition(condition, c)
      if (!matches) {
        return false // All conditions must match
      }
    }
    return true
  }

  private async evaluateCondition(condition: ScenarioCondition, c: Context): Promise<boolean> {
    let actualValue: string | undefined

    switch (condition.type) {
      case 'header':
        actualValue = c.req.header(condition.key)
        break

      case 'query':
        actualValue = c.req.query(condition.key)
        break

      case 'body':
        try {
          const body = await c.req.json()
          actualValue = body[condition.key]?.toString()
        } catch {
          actualValue = undefined
        }
        break

      default:
        return false
    }

    switch (condition.operator) {
      case 'exists':
        return actualValue !== undefined

      case 'equals':
        return actualValue === condition.value

      case 'contains':
        return actualValue ? actualValue.includes(condition.value || '') : false

      default:
        return false
    }
  }

  private getRequestHeaders(req: HonoRequest): Record<string, string> {
    const headers: Record<string, string> = {}

    // Get all headers from the request using Hono's header method
    // We'll iterate through common headers since HonoRequest doesn't expose all headers directly
    const commonHeaders = [
      'accept', 'accept-encoding', 'accept-language', 'authorization', 'cache-control',
      'content-length', 'content-type', 'cookie', 'host', 'origin', 'referer',
      'user-agent', 'x-forwarded-for', 'x-real-ip'
    ]

    for (const headerName of commonHeaders) {
      const value = req.header(headerName)
      if (value) {
        headers[headerName] = value
      }
    }

    return headers
  }

  private async getRequestBody(req: HonoRequest): Promise<any> {
    try {
      // Try to get the body as text
      const text = await req.text()

      if (!text) return undefined

      // Try to parse as JSON, fallback to text
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } catch {
      return undefined
    }
  }

  private getResponseHeaders(res: Response): Record<string, string> {
    const headers: Record<string, string> = {}

    res.headers.forEach((value, key) => {
      headers[key] = value
    })

    return headers
  }

  private async getResponseBody(res: Response): Promise<any> {
    try {
      // Clone the response to avoid consuming the body
      const clonedRes = res.clone()
      const text = await clonedRes.text()

      if (!text) return undefined

      // Try to parse as JSON, fallback to text
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } catch {
      return undefined
    }
  }

  private async logRequest(logData: RequestLogData): Promise<void> {
    try {
      const response = await fetch(`${this.managementApiUrl}/api/logs/internal/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      })

      if (!response.ok) {
        console.error('Failed to log request:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error logging request:', error)
    }
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting mock server for API "${this.apiConfig.name}" on port ${this.port}`)
    console.log(`📋 Configured endpoints:`)

    for (const endpoint of this.apiConfig.endpoints) {
      console.log(`   ${endpoint.method} ${endpoint.path} (${endpoint.scenarios.length} scenarios)`)
    }

    serve({
      fetch: this.app.fetch,
      port: this.port,
    })

    console.log(`✅ Mock server running on http://localhost:${this.port}`)
  }
}

// Main execution
async function main() {
  try {
    // Get configuration from environment
    const port = Number(process.env.PORT)
    const apiConfigJson = process.env.API_CONFIG

    if (!port || !apiConfigJson) {
      throw new Error('Missing required environment variables: PORT, API_CONFIG')
    }

    const apiConfig: ApiConfig = JSON.parse(apiConfigJson)

    // Create and start the mock server
    const mockServer = new MockServer(apiConfig, port)
    await mockServer.start()

  } catch (error) {
    console.error('❌ Failed to start mock server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

// Start the server
main()