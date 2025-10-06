import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import {
  corsMiddleware,
  errorHandler,
  bodySizeLimit,
  requestTimeout,
  securityHeaders,
  rateLimit
} from './middleware/index.js'

const app = new Hono()

// Global middleware stack
app.use('*', logger())
app.use('*', corsMiddleware)
app.use('*', securityHeaders)
app.use('*', bodySizeLimit)
app.use('*', requestTimeout)
app.use('*', rateLimit(1000, 15 * 60 * 1000)) // 1000 requests per 15 minutes

// Global error handler
app.onError(errorHandler)

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: 'The requested resource was not found',
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  }, 404)
})

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })
})

// API info endpoint
app.get('/api', (c) => {
  return c.json({
    message: 'API Mocking Service Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      apis: '/api/apis',
      endpoints: '/api/apis/:apiId/endpoints',
      scenarios: '/api/endpoints/:endpointId/scenarios',
      openapi: '/api/openapi',
    },
    timestamp: new Date().toISOString(),
  })
})

// Example routes demonstrating middleware usage
import { exampleRouter } from './routes/example.js'
app.route('/api/example', exampleRouter)

// API management routes
import { apiRouter } from './routes/apis.js'
app.route('/api/apis', apiRouter)

// Endpoint management routes
import { endpointRouter } from './routes/endpoints.js'
app.route('/api/apis/:apiId/endpoints', endpointRouter)

// Scenario management routes
import { scenarioRouter } from './routes/scenarios.js'
app.route('/api/endpoints/:endpointId/scenarios', scenarioRouter)

// OpenAPI import routes
import { openApiRouter } from './routes/openapi.js'
app.route('/api/openapi', openApiRouter)

// Mock server management routes
import { mockServerRouter } from './routes/mock-servers.js'
app.route('/api/mock-servers', mockServerRouter)

// Logs and monitoring routes
import { logsRouter } from './routes/logs.js'
app.route('/api/logs', logsRouter)

// Initialize monitoring service
import { monitoringService } from './services/index.js'

// TODO: Implement oRPC for type-safe frontend-backend communication

const PORT = Number(process.env.PORT) || 3000

// Initialize services
async function initializeServices() {
  try {
    await monitoringService.initialize()
    console.log('✅ All services initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize services:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  try {
    await monitoringService.shutdown()
    console.log('✅ Services shut down successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  try {
    await monitoringService.shutdown()
    console.log('✅ Services shut down successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
})

console.log(`🚀 Server running on port ${PORT}`)
console.log(`📋 Health check: http://localhost:${PORT}/health`)
console.log(`🔧 API endpoint: http://localhost:${PORT}/api`)
console.log(`📊 Logs endpoint: http://localhost:${PORT}/api/logs`)
console.log(`🖥️  Mock servers endpoint: http://localhost:${PORT}/api/mock-servers`)
console.log(`🛡️  Security headers enabled`)
console.log(`⏱️  Request timeout: 30s`)
console.log(`📏 Body size limit: 10MB`)
console.log(`🚦 Rate limit: 1000 requests per 15 minutes`)

// Initialize services and start server
initializeServices().then(() => {
  serve({
    fetch: app.fetch,
    port: PORT,
  })
}).catch((error) => {
  console.error('❌ Failed to start server:', error)
  process.exit(1)
})