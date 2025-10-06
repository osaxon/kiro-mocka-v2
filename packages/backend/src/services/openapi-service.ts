import { ApiService } from '../db/services/api-service.js'
import { EndpointService } from '../db/services/endpoint-service.js'
import { ScenarioService } from '../db/services/scenario-service.js'
import type { HttpMethod } from '../db/types.js'

export interface ParsedEndpoint {
  method: HttpMethod
  path: string
  description?: string
  scenarios: Array<{
    name: string
    statusCode: number
    responseHeaders?: Record<string, string>
    responseBody?: any
    isDefault: boolean
  }>
}

export interface ImportResult {
  api: any
  endpoints: any[]
  summary: {
    totalEndpoints: number
    createdEndpoints: number
    totalScenarios: number
    createdScenarios: number
  }
}

export interface ValidationResult {
  valid: boolean
  error?: string
  message: string
  summary?: {
    totalEndpoints: number
    totalScenarios: number
    endpoints: Array<{
      method: HttpMethod
      path: string
      description?: string
      scenarioCount: number
    }>
  }
}

export class OpenApiService {
  private apiService: ApiService
  private endpointService: EndpointService
  private scenarioService: ScenarioService

  constructor() {
    this.apiService = new ApiService()
    this.endpointService = new EndpointService()
    this.scenarioService = new ScenarioService()
  }

  /**
   * Validate OpenAPI specification
   */
  validateSpec(spec: any): ValidationResult {
    try {
      const endpoints = this.parseOpenApiSpec(spec)

      return {
        valid: true,
        message: 'OpenAPI specification is valid',
        summary: {
          totalEndpoints: endpoints.length,
          totalScenarios: endpoints.reduce((sum, ep) => sum + ep.scenarios.length, 0),
          endpoints: endpoints.map(ep => ({
            method: ep.method,
            path: ep.path,
            description: ep.description,
            scenarioCount: ep.scenarios.length,
          }))
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid OpenAPI specification',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Import OpenAPI specification and create API with endpoints
   */
  async importSpec(name: string, description: string | undefined, spec: any): Promise<ImportResult> {
    // Parse and validate the spec
    const endpoints = this.parseOpenApiSpec(spec)

    if (endpoints.length === 0) {
      throw new Error('The OpenAPI specification does not contain any valid endpoints')
    }

    // Create the API
    const port = await this.apiService.findNextAvailablePort()
    const newApi = await this.apiService.create({
      name,
      description: description || 'Imported from OpenAPI specification',
      port,
    })

    // Create endpoints and scenarios
    const createdEndpoints = []
    for (const endpointData of endpoints) {
      try {
        // Create endpoint
        const endpoint = await this.endpointService.create(newApi.id, {
          method: endpointData.method,
          path: endpointData.path,
          description: endpointData.description,
        })

        // Create scenarios for this endpoint
        const createdScenarios = []
        for (const scenarioData of endpointData.scenarios) {
          const scenario = await this.scenarioService.create(endpoint.id, scenarioData)
          createdScenarios.push(scenario)
        }

        createdEndpoints.push({
          ...endpoint,
          scenarios: createdScenarios,
        })
      } catch (error) {
        console.warn(`Failed to create endpoint ${endpointData.method} ${endpointData.path}:`,
          error instanceof Error ? error.message : String(error))
      }
    }

    return {
      api: newApi,
      endpoints: createdEndpoints,
      summary: {
        totalEndpoints: endpoints.length,
        createdEndpoints: createdEndpoints.length,
        totalScenarios: endpoints.reduce((sum, ep) => sum + ep.scenarios.length, 0),
        createdScenarios: createdEndpoints.reduce((sum, ep) => sum + ep.scenarios.length, 0),
      }
    }
  }

  /**
   * Parse OpenAPI specification and extract endpoints
   */
  private parseOpenApiSpec(spec: any): ParsedEndpoint[] {
    if (!spec.openapi && !spec.swagger) {
      throw new Error('Invalid OpenAPI specification: missing openapi or swagger version')
    }

    if (!spec.paths || typeof spec.paths !== 'object') {
      throw new Error('Invalid OpenAPI specification: missing or invalid paths')
    }

    const endpoints: ParsedEndpoint[] = []

    // Parse paths
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue

      // Parse operations
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!operation || typeof operation !== 'object') continue

        try {
          const httpMethod = this.normalizeHttpMethod(method)
          const operationObj = operation as any

          const endpointData: ParsedEndpoint = {
            method: httpMethod,
            path: path,
            description: operationObj.summary || operationObj.description || `${httpMethod} ${path}`,
            scenarios: []
          }

          // Create basic scenarios from responses
          if (operationObj.responses && typeof operationObj.responses === 'object') {
            let hasDefault = false

            for (const [statusCode, response] of Object.entries(operationObj.responses)) {
              if (!response || typeof response !== 'object') continue

              const code = statusCode === 'default' ? 200 : parseInt(statusCode, 10)
              if (isNaN(code)) continue

              const responseObj = response as any
              const isDefault = !hasDefault && (code >= 200 && code < 300)
              if (isDefault) hasDefault = true

              endpointData.scenarios.push({
                name: responseObj.description || `${code} Response`,
                statusCode: code,
                responseHeaders: { 'Content-Type': 'application/json' },
                responseBody: this.generateBasicResponse(code),
                isDefault
              })
            }

            // Ensure at least one default scenario
            if (!hasDefault && endpointData.scenarios.length > 0) {
              endpointData.scenarios[0].isDefault = true
            }
          }

          // If no scenarios, add a basic success scenario
          if (endpointData.scenarios.length === 0) {
            endpointData.scenarios.push({
              name: 'Success Response',
              statusCode: 200,
              responseHeaders: { 'Content-Type': 'application/json' },
              responseBody: this.generateBasicResponse(200),
              isDefault: true
            })
          }

          endpoints.push(endpointData)
        } catch (error) {
          console.warn(`Skipping method ${method} for path ${path}:`,
            error instanceof Error ? error.message : String(error))
        }
      }
    }

    return endpoints
  }

  /**
   * Normalize HTTP method to valid HttpMethod type
   */
  private normalizeHttpMethod(method: string): HttpMethod {
    const upperMethod = method.toUpperCase()
    const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

    if (validMethods.includes(upperMethod as HttpMethod)) {
      return upperMethod as HttpMethod
    }

    throw new Error(`Unsupported HTTP method: ${method}`)
  }

  /**
   * Generate basic response based on status code
   */
  private generateBasicResponse(statusCode: number): any {
    if (statusCode >= 200 && statusCode < 300) {
      return { message: 'Success', data: {} }
    } else if (statusCode >= 400 && statusCode < 500) {
      return { error: 'Client Error', message: 'Bad Request' }
    } else if (statusCode >= 500) {
      return { error: 'Server Error', message: 'Internal Server Error' }
    }
    return { message: 'Response' }
  }
}