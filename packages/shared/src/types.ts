export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface MockApi {
  id: string
  name: string
  description?: string
  port: number
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
  endpoints?: Endpoint[]
}

export interface Endpoint {
  id: string
  apiId: string
  method: HttpMethod
  path: string
  description?: string
  requestHeaders?: Record<string, string>
  requestParams?: Record<string, string>
  requestBody?: any
  scenarios?: Scenario[]
  defaultScenarioId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Scenario {
  id: string
  endpointId: string
  name: string
  statusCode: number
  responseHeaders?: Record<string, string>
  responseBody?: any
  conditions?: ScenarioCondition[]
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ScenarioCondition {
  type: 'header' | 'query' | 'body'
  key: string
  operator: 'equals' | 'contains' | 'exists'
  value?: string
}

export interface RequestLog {
  id: string
  apiId: string
  endpointId?: string
  scenarioId?: string
  method: string
  path: string
  requestHeaders: Record<string, string>
  requestBody?: any
  responseStatus: number
  responseHeaders: Record<string, string>
  responseBody?: any
  timestamp: Date
  duration: number
}
