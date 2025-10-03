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

// TODO: Add endpoint management routes (/api/apis/:id/endpoints)
// TODO: Add scenario management routes (/api/endpoints/:id/scenarios)
// TODO: Add OpenAPI import routes (/api/openapi/import)

const PORT = Number(process.env.PORT) || 3000

console.log(`🚀 Server running on port ${PORT}`)
console.log(`📋 Health check: http://localhost:${PORT}/health`)
console.log(`🔧 API endpoint: http://localhost:${PORT}/api`)
console.log(`🛡️  Security headers enabled`)
console.log(`⏱️  Request timeout: 30s`)
console.log(`📏 Body size limit: 10MB`)
console.log(`🚦 Rate limit: 1000 requests per 15 minutes`)

serve({
  fetch: app.fetch,
  port: PORT,
})