import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// Helper function to create consistent validation middleware
export const validateJson = <T extends z.ZodSchema>(schema: T) => {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: 'Validation failed',
        details: result.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
        })),
        timestamp: new Date().toISOString(),
      }, 400)
    }
  })
}

export const validateQuery = <T extends z.ZodSchema>(schema: T) => {
  return zValidator('query', schema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: 'Invalid query parameters',
        details: result.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
        })),
        timestamp: new Date().toISOString(),
      }, 400)
    }
  })
}

export const validateParam = <T extends z.ZodSchema>(schema: T) => {
  return zValidator('param', schema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: 'Invalid path parameters',
        details: result.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
        })),
        timestamp: new Date().toISOString(),
      }, 400)
    }
  })
}

// Common parameter schemas
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
})

export const paginationQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
})