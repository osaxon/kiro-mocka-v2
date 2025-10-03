import { Hono } from 'hono'
import { validateJson, validateQuery, validateParam, idParamSchema, paginationQuerySchema } from '../middleware/index.js'
import { z } from 'zod'

const exampleRouter = new Hono()

// Example schemas for demonstration
const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
})

const updateItemSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
})

// Mock data store
const items: Array<{ id: string; name: string; description?: string; tags?: string[]; metadata?: Record<string, string>; createdAt: Date }> = []

// GET /example - List items with pagination
exampleRouter.get('/',
  validateQuery(paginationQuerySchema),
  (c) => {
    const { page, limit, sort, order } = c.req.valid('query')

    let sortedItems = [...items]
    if (sort) {
      sortedItems.sort((a, b) => {
        const aVal = (a as any)[sort] || ''
        const bVal = (b as any)[sort] || ''
        const comparison = aVal.toString().localeCompare(bVal.toString())
        return order === 'desc' ? -comparison : comparison
      })
    }

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedItems = sortedItems.slice(startIndex, endIndex)

    return c.json({
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit),
      },
      timestamp: new Date().toISOString(),
    })
  }
)

// GET /example/:id - Get single item
exampleRouter.get('/:id',
  validateParam(idParamSchema),
  (c) => {
    const { id } = c.req.valid('param')
    const item = items.find(item => item.id === id)

    if (!item) {
      return c.json({
        error: 'Item not found',
        message: `Item with ID ${id} does not exist`,
        timestamp: new Date().toISOString(),
      }, 404)
    }

    return c.json({
      data: item,
      timestamp: new Date().toISOString(),
    })
  }
)

// POST /example - Create new item
exampleRouter.post('/',
  validateJson(createItemSchema),
  (c) => {
    const data = c.req.valid('json')

    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      createdAt: new Date(),
    }

    items.push(newItem)

    return c.json({
      message: 'Item created successfully',
      data: newItem,
      timestamp: new Date().toISOString(),
    }, 201)
  }
)

// PUT /example/:id - Update item
exampleRouter.put('/:id',
  validateParam(idParamSchema),
  validateJson(updateItemSchema),
  (c) => {
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    const itemIndex = items.findIndex(item => item.id === id)
    if (itemIndex === -1) {
      return c.json({
        error: 'Item not found',
        message: `Item with ID ${id} does not exist`,
        timestamp: new Date().toISOString(),
      }, 404)
    }

    items[itemIndex] = { ...items[itemIndex], ...updates }

    return c.json({
      message: 'Item updated successfully',
      data: items[itemIndex],
      timestamp: new Date().toISOString(),
    })
  }
)

// DELETE /example/:id - Delete item
exampleRouter.delete('/:id',
  validateParam(idParamSchema),
  (c) => {
    const { id } = c.req.valid('param')

    const itemIndex = items.findIndex(item => item.id === id)
    if (itemIndex === -1) {
      return c.json({
        error: 'Item not found',
        message: `Item with ID ${id} does not exist`,
        timestamp: new Date().toISOString(),
      }, 404)
    }

    const deletedItem = items.splice(itemIndex, 1)[0]

    return c.json({
      message: 'Item deleted successfully',
      data: deletedItem,
      timestamp: new Date().toISOString(),
    })
  }
)

export { exampleRouter }