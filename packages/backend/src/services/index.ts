// Service classes
import { ApiService } from './api-service.js'
import { EndpointService } from './endpoint-service.js'
import { ScenarioService } from './scenario-service.js'
import { RequestLogService } from './request-log-service.js'
import { PortManager } from './port-manager.js'
import { MockServerManager } from './mock-server-manager.js'
import { MonitoringService } from './monitoring-service.js'

export {
  ApiService,
  EndpointService,
  ScenarioService,
  RequestLogService,
  PortManager,
  MockServerManager,
  MonitoringService
}

// Service types
export type { CreateLogRequest } from './request-log-service.js'
export type { PortAllocation, PortAllocationRequest } from './port-manager.js'
export type { MockServerInstance, ServerStartRequest, ServerStopRequest } from './mock-server-manager.js'
export type { MonitoringMetrics, ApiActivity, CleanupStats, EnhancedLogFilters } from './monitoring-service.js'

// Create service instances
export const apiService = new ApiService()
export const endpointService = new EndpointService()
export const scenarioService = new ScenarioService()
export const requestLogService = new RequestLogService()
export const portManager = new PortManager()
export const monitoringService = new MonitoringService(requestLogService)
export const mockServerManager = new MockServerManager(portManager, apiService)