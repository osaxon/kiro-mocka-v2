import { z } from 'zod'

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])

export const ScenarioConditionSchema = z.object({
  type: z.enum(['header', 'query', 'body']),
  key: z.string(),
  operator: z.enum(['equals', 'contains', 'exists']),
  value: z.string().optional(),
})

export const CreateApiSchema = z.object({
  name: z.string().min(1, 'API name is required'),
  description: z.string().optional(),
})

export const UpdateApiSchema = z.object({
  name: z.string().min(1, 'API name is required').optional(),
  description: z.string().optional(),
})

export const CreateEndpointSchema = z.object({
  method: HttpMethodSchema,
  path: z.string().min(1, 'Path is required'),
  description: z.string().optional(),
  requestHeaders: z.record(z.string()).optional(),
  requestParams: z.record(z.string()).optional(),
  requestBody: z.any().optional(),
})

export const UpdateEndpointSchema = z.object({
  method: HttpMethodSchema.optional(),
  path: z.string().min(1, 'Path is required').optional(),
  description: z.string().optional(),
  requestHeaders: z.record(z.string()).optional(),
  requestParams: z.record(z.string()).optional(),
  requestBody: z.any().optional(),
  defaultScenarioId: z.string().optional(),
})

export const CreateScenarioSchema = z.object({
  name: z.string().min(1, 'Scenario name is required'),
  statusCode: z.number().int().min(100).max(599),
  responseHeaders: z.record(z.string()).optional(),
  responseBody: z.any().optional(),
  conditions: z.array(ScenarioConditionSchema).optional(),
  isDefault: z.boolean().default(false),
})

export const UpdateScenarioSchema = z.object({
  name: z.string().min(1, 'Scenario name is required').optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  responseHeaders: z.record(z.string()).optional(),
  responseBody: z.any().optional(),
  conditions: z.array(ScenarioConditionSchema).optional(),
  isDefault: z.boolean().optional(),
})
