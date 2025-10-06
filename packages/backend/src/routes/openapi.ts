import { Hono } from 'hono'
import { validateJson } from '../middleware/index.js'
import { OpenApiService } from '../services/openapi-service.js'
import { z } from 'zod'

const openApiRouter = new Hono()
const openApiService = new OpenApiService()

const OpenApiImportSchema = z.object({
  name: z.string().min(1, 'API name is required'),
  description: z.string().optional(),
  openApiSpec: z.object({}).passthrough(),
})

const OpenApiValidateSchema = z.object({
  openApiSpec: z.object({}).passthrough(),
})

openApiRouter.post('/import', validateJson(OpenApiImportSchema), async (c) => {
  try {
    const { name, description, openApiSpec } = c.req.valid('json')
    const result = await openApiService.importSpec(name, description, openApiSpec)

    return c.json({
      message: 'OpenAPI specification imported successfully',
      data: result,
      timestamp: new Date().toISOString(),
    }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import OpenAPI specification'
    const isValidationError = error instanceof Error &&
      (error.message.includes('Invalid OpenAPI') || error.message.includes('does not contain any valid endpoints'))

    return c.json({
      error: isValidationError ? 'Invalid OpenAPI specification' : 'Internal server error',
      message,
      timestamp: new Date().toISOString(),
    }, isValidationError ? 400 : 500)
  }
})

openApiRouter.post('/validate', validateJson(OpenApiValidateSchema), async (c) => {
  try {
    const { openApiSpec } = c.req.valid('json')
    const result = openApiService.validateSpec(openApiSpec)

    if (!result.valid) {
      return c.json({
        valid: false,
        error: result.error,
        message: result.message,
        timestamp: new Date().toISOString(),
      }, 400)
    }

    return c.json({
      valid: true,
      message: result.message,
      data: { summary: result.summary },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return c.json({
      valid: false,
      error: 'Internal server error',
      message: 'Failed to validate OpenAPI specification',
      timestamp: new Date().toISOString(),
    }, 500)
  }
})

export { openApiRouter }