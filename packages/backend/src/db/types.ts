import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { z } from 'zod'
import { apis, endpoints, scenarios, requestLogs } from './schema.js'

// Inferred types for select operations (reading from database)
export type Api = InferSelectModel<typeof apis>
export type Endpoint = InferSelectModel<typeof endpoints>
export type Scenario = InferSelectModel<typeof scenarios>
export type RequestLog = InferSelectModel<typeof requestLogs>

// Inferred types for insert operations (writing to database)
export type NewApi = InferInsertModel<typeof apis>
export type NewEndpoint = InferInsertModel<typeof endpoints>
export type NewScenario = InferInsertModel<typeof scenarios>
export type NewRequestLog = InferInsertModel<typeof requestLogs>

// Extended types with relations
export type ApiWithEndpoints = Api & {
  endpoints: Endpoint[]
}

export type ApiWithEndpointsAndScenarios = Api & {
  endpoints: (Endpoint & {
    scenarios: Scenario[]
    defaultScenario?: Scenario
  })[]
}

export type EndpointWithScenarios = Endpoint & {
  scenarios: Scenario[]
  defaultScenario?: Scenario
}

export type EndpointWithApi = Endpoint & {
  api: Api
}

// Zod schemas for validation
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
export const ApiStatusSchema = z.enum(['active', 'inactive'])

export const ScenarioConditionSchema = z.object({
  type: z.enum(['header', 'query', 'body']),
  key: z.string().min(1, 'Key is required'),
  operator: z.enum(['equals', 'contains', 'exists']),
  value: z.string().optional(),
})

export const RequestHeadersSchema = z.record(z.string(), z.string())
export const ResponseHeadersSchema = z.record(z.string(), z.string())

// Utility types derived from Zod schemas
export type HttpMethod = z.infer<typeof HttpMethodSchema>
export type ApiStatus = z.infer<typeof ApiStatusSchema>
export type ScenarioCondition = z.infer<typeof ScenarioConditionSchema>
export type RequestHeaders = z.infer<typeof RequestHeadersSchema>
export type ResponseHeaders = z.infer<typeof ResponseHeadersSchema>

// Zod schemas for CRUD operations
export const CreateApiRequestSchema = z.object({
  name: z.string().min(1, 'API name is required').max(255, 'API name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
})

export const UpdateApiRequestSchema = z.object({
  name: z.string().min(1, 'API name is required').max(255, 'API name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: ApiStatusSchema.optional(),
})

export const CreateEndpointRequestSchema = z.object({
  method: HttpMethodSchema,
  path: z.string().min(1, 'Path is required').regex(/^\//, 'Path must start with /'),
  description: z.string().max(1000, 'Description too long').optional(),
  requestHeaders: RequestHeadersSchema.optional(),
  requestParams: z.record(z.string(), z.string()).optional(),
  requestBody: z.any().optional(),
})

export const UpdateEndpointRequestSchema = z.object({
  method: HttpMethodSchema.optional(),
  path: z.string().min(1, 'Path is required').regex(/^\//, 'Path must start with /').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  requestHeaders: RequestHeadersSchema.optional(),
  requestParams: z.record(z.string(), z.string()).optional(),
  requestBody: z.any().optional(),
  defaultScenarioId: z.string().optional(),
})

export const CreateScenarioRequestSchema = z.object({
  name: z.string().min(1, 'Scenario name is required').max(255, 'Scenario name too long'),
  statusCode: z.number().int().min(100, 'Invalid status code').max(599, 'Invalid status code'),
  responseHeaders: ResponseHeadersSchema.optional(),
  responseBody: z.any().optional(),
  conditions: z.array(ScenarioConditionSchema).optional(),
  isDefault: z.boolean().default(false),
})

export const UpdateScenarioRequestSchema = z.object({
  name: z.string().min(1, 'Scenario name is required').max(255, 'Scenario name too long').optional(),
  statusCode: z.number().int().min(100, 'Invalid status code').max(599, 'Invalid status code').optional(),
  responseHeaders: ResponseHeadersSchema.optional(),
  responseBody: z.any().optional(),
  conditions: z.array(ScenarioConditionSchema).optional(),
  isDefault: z.boolean().optional(),
})

// TypeScript types derived from Zod schemas
export type CreateApiRequest = z.infer<typeof CreateApiRequestSchema>
export type UpdateApiRequest = z.infer<typeof UpdateApiRequestSchema>
export type CreateEndpointRequest = z.infer<typeof CreateEndpointRequestSchema>
export type UpdateEndpointRequest = z.infer<typeof UpdateEndpointRequestSchema>
export type CreateScenarioRequest = z.infer<typeof CreateScenarioRequestSchema>
export type UpdateScenarioRequest = z.infer<typeof UpdateScenarioRequestSchema>

// Additional validation schemas for API operations
export const PortSchema = z.number().int().min(1024, 'Port must be >= 1024').max(65535, 'Port must be <= 65535')

export const CreateApiWithPortRequestSchema = CreateApiRequestSchema.extend({
  port: PortSchema,
})

export const IdSchema = z.string().min(1, 'ID is required')

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(50),
  offset: z.number().int().min(0).default(0),
})

export const LogFiltersSchema = z.object({
  apiId: IdSchema.optional(),
  endpointId: IdSchema.optional(),
  method: HttpMethodSchema.optional(),
  statusCode: z.number().int().min(100).max(599).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
})

// Export additional derived types
export type CreateApiWithPortRequest = z.infer<typeof CreateApiWithPortRequestSchema>
export type PaginationParams = z.infer<typeof PaginationSchema>
export type LogFilters = z.infer<typeof LogFiltersSchema>

// Validation helper functions
export const validateCreateApiRequest = (data: unknown) => CreateApiRequestSchema.parse(data)
export const validateUpdateApiRequest = (data: unknown) => UpdateApiRequestSchema.parse(data)
export const validateCreateEndpointRequest = (data: unknown) => CreateEndpointRequestSchema.parse(data)
export const validateUpdateEndpointRequest = (data: unknown) => UpdateEndpointRequestSchema.parse(data)
export const validateCreateScenarioRequest = (data: unknown) => CreateScenarioRequestSchema.parse(data)
export const validateUpdateScenarioRequest = (data: unknown) => UpdateScenarioRequestSchema.parse(data)
export const validateCreateApiWithPortRequest = (data: unknown) => CreateApiWithPortRequestSchema.parse(data)
export const validateLogFilters = (data: unknown) => LogFiltersSchema.parse(data)
export const validatePagination = (data: unknown) => PaginationSchema.parse(data)