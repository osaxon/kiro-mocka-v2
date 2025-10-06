// Service classes
import { ApiService } from './api-service.js'
import { EndpointService } from './endpoint-service.js'
import { ScenarioService } from './scenario-service.js'
import { RequestLogService } from './request-log-service.js'

export { ApiService, EndpointService, ScenarioService, RequestLogService }

// Service types
export type { CreateLogRequest } from './request-log-service.js'

// Create service instances
export const apiService = new ApiService()
export const endpointService = new EndpointService()
export const scenarioService = new ScenarioService()
export const requestLogService = new RequestLogService()