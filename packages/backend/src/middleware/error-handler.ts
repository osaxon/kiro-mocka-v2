import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('Server error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  })

  // Handle HTTP exceptions (thrown by Hono)
  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
      status: err.status,
      timestamp: new Date().toISOString(),
    }, err.status)
  }

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    return c.json({
      error: 'Validation failed',
      details: err.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        code: error.code,
      })),
      timestamp: new Date().toISOString(),
    }, 400)
  }

  // Handle database errors (if any)
  if (err.message.includes('UNIQUE constraint failed')) {
    return c.json({
      error: 'Resource already exists',
      message: 'A resource with these details already exists',
      timestamp: new Date().toISOString(),
    }, 409)
  }

  if (err.message.includes('FOREIGN KEY constraint failed')) {
    return c.json({
      error: 'Invalid reference',
      message: 'Referenced resource does not exist',
      timestamp: new Date().toISOString(),
    }, 400)
  }

  // Generic server error
  return c.json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  }, 500)
}