import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes placeholder
app.get('/api', (c) => {
  return c.json({ message: 'API Mocking Service Backend' })
})

const PORT = Number(process.env.PORT) || 3000

console.log(`Server running on port ${PORT}`)

serve({
  fetch: app.fetch,
  port: PORT,
})
