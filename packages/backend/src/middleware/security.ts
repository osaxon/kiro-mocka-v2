import { bodyLimit } from 'hono/body-limit'
import { timeout } from 'hono/timeout'
import type { MiddlewareHandler } from 'hono'

// Body size limit middleware
export const bodySizeLimit = bodyLimit({
  maxSize: 10 * 1024 * 1024, // 10MB limit for file uploads (OpenAPI specs)
  onError: (c) => {
    return c.json({
      error: 'Request too large',
      message: 'Request body exceeds the maximum allowed size of 10MB',
      timestamp: new Date().toISOString(),
    }, 413)
  }
})

// Request timeout middleware
export const requestTimeout = timeout(30000)

// Security headers middleware
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()

  // Add security headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Only add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

// Rate limiting (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000): MiddlewareHandler => {
  return async (c, next) => {
    const clientId = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const now = Date.now()

    const clientData = requestCounts.get(clientId)

    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      })
    } else {
      clientData.count++

      if (clientData.count > maxRequests) {
        return c.json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((clientData.resetTime - now) / 1000)} seconds`,
          timestamp: new Date().toISOString(),
        }, 429)
      }
    }

    await next()
  }
}