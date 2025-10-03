# Hono Server Middleware Setup

This document describes the middleware setup implemented for the API Mocking Service backend.

## Implemented Middleware

### 1. CORS Middleware (`src/middleware/cors.ts`)
- Configured to allow requests from development servers (localhost:5173, localhost:3000, localhost:4173)
- Supports all necessary HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)
- Includes proper headers for content type and authorization
- Enables credentials for authenticated requests
- 24-hour cache for preflight requests

### 2. Error Handler (`src/middleware/error-handler.ts`)
- Comprehensive error handling for different error types:
  - HTTP exceptions (from Hono)
  - Zod validation errors with detailed field-level feedback
  - Database constraint errors (UNIQUE, FOREIGN KEY)
  - Generic server errors
- Structured error responses with timestamps
- Development vs production error message handling

### 3. Validation Middleware (`src/middleware/validation.ts`)
- Zod-based validation for JSON, query parameters, and path parameters
- Consistent error response format
- Helper functions: `validateJson()`, `validateQuery()`, `validateParam()`
- Common schemas: `idParamSchema`, `paginationQuerySchema`
- Type-safe validation with proper TypeScript integration

### 4. Security Middleware (`src/middleware/security.ts`)
- **Body Size Limit**: 10MB maximum for file uploads (OpenAPI specs)
- **Request Timeout**: 30-second timeout for all requests
- **Security Headers**: 
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - HSTS (production only)
- **Rate Limiting**: In-memory rate limiting (configurable, default: 1000 requests per 15 minutes)

## Server Configuration

### Middleware Stack Order
1. Logger (Hono built-in)
2. CORS
3. Security Headers
4. Body Size Limit
5. Request Timeout
6. Rate Limiting

### Error Handling
- Global error handler catches all unhandled errors
- 404 handler for unknown routes
- Structured error responses with timestamps

### Example Routes
- Health check: `GET /health`
- API info: `GET /api`
- Example CRUD operations: `/api/example/*` (demonstrates all middleware features)

## Usage Examples

### JSON Validation
```typescript
const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

app.post('/api/items', 
  validateJson(schema),
  (c) => {
    const data = c.req.valid('json') // Type-safe validated data
    return c.json({ success: true, data })
  }
)
```

### Query Parameter Validation
```typescript
app.get('/api/items',
  validateQuery(paginationQuerySchema),
  (c) => {
    const { page, limit, sort, order } = c.req.valid('query')
    // Pagination logic here
  }
)
```

### Path Parameter Validation
```typescript
app.get('/api/items/:id',
  validateParam(idParamSchema),
  (c) => {
    const { id } = c.req.valid('param')
    // Find item by ID
  }
)
```

## Testing

- Comprehensive test suite in `src/middleware/middleware.test.ts`
- Tests cover validation success and failure cases
- All middleware components are tested
- Integration tests demonstrate real-world usage

## Security Features

- **Input Validation**: All inputs validated with Zod schemas
- **Rate Limiting**: Prevents abuse with configurable limits
- **Security Headers**: Standard security headers applied
- **Error Handling**: Prevents information leakage in production
- **Request Size Limits**: Prevents large payload attacks
- **Timeout Protection**: Prevents long-running request attacks

## Performance Considerations

- Lightweight middleware stack using Hono's optimized routing
- In-memory rate limiting (suitable for single-instance deployments)
- Efficient error handling with minimal overhead
- Structured logging for debugging and monitoring

## Next Steps

This middleware setup provides the foundation for:
1. API management endpoints (Task 3.2)
2. Endpoint and scenario management (Task 3.3)
3. OpenAPI import functionality (Task 3.4)
4. Mock server management (Task 4.x)

All subsequent API routes will benefit from this robust middleware foundation.