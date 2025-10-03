import { describe, it, expect } from 'vitest'
import type { HttpMethod } from './types'

describe('Shared types', () => {
  it('should have correct HttpMethod type', () => {
    const method: HttpMethod = 'GET'
    expect(method).toBe('GET')
  })
})
