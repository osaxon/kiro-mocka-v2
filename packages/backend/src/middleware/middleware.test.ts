import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { validateJson, validateQuery, validateParam } from './validation'
import { z } from 'zod'

describe('Middleware', () => {
  describe('validateJson', () => {
    it('should validate JSON input correctly', async () => {
      const app = new Hono()
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().optional(),
      })

      app.post('/test', validateJson(schema), (c) => {
        const data = c.req.valid('json')
        return c.json({ success: true, data })
      })

      // Valid request
      const validRes = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 30 }),
      })

      expect(validRes.status).toBe(200)
      const validData = await validRes.json() as any
      expect(validData.success).toBe(true)
      expect(validData.data.name).toBe('John')
    })

    it('should reject invalid JSON input', async () => {
      const app = new Hono()
      const schema = z.object({
        name: z.string().min(1),
      })

      app.post('/test', validateJson(schema), (c) => {
        return c.json({ success: true })
      })

      // Invalid request (missing required field)
      const invalidRes = await app.request('/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(invalidRes.status).toBe(400)
      const errorData = await invalidRes.json() as any
      expect(errorData.error).toBe('Validation failed')
      expect(errorData.details).toBeDefined()
    })
  })

  describe('validateQuery', () => {
    it('should validate query parameters correctly', async () => {
      const app = new Hono()
      const schema = z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      })

      app.get('/test', validateQuery(schema), (c) => {
        const query = c.req.valid('query')
        return c.json({ success: true, query })
      })

      const res = await app.request('/test?page=1&limit=10')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(data.success).toBe(true)
      expect(data.query.page).toBe('1')
      expect(data.query.limit).toBe('10')
    })
  })

  describe('validateParam', () => {
    it('should validate path parameters correctly', async () => {
      const app = new Hono()
      const schema = z.object({
        id: z.string().min(1),
      })

      app.get('/test/:id', validateParam(schema), (c) => {
        const params = c.req.valid('param')
        return c.json({ success: true, params })
      })

      const res = await app.request('/test/123')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(data.success).toBe(true)
      expect(data.params.id).toBe('123')
    })
  })
})