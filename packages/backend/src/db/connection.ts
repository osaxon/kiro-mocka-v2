import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import path from 'node:path'
import fs from 'node:fs'

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite')

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Create libsql client
const client = createClient({
  url: `file:${DB_PATH}`,
})

// Create Drizzle database instance
export const db = drizzle(client)

// Export client for advanced operations
export { client }

// Database connection utilities
export const dbUtils = {
  /**
   * Close the database connection
   */
  close: async () => {
    await client.close()
  },

  /**
   * Execute a raw SQL query
   */
  exec: async (sql: string) => {
    return await client.execute(sql)
  },

  /**
   * Get database info
   */
  getInfo: () => {
    return {
      path: DB_PATH,
      url: `file:${DB_PATH}`,
    }
  },

  /**
   * Enable foreign keys (should be called after connection)
   */
  enableForeignKeys: async () => {
    await client.execute('PRAGMA foreign_keys = ON')
  },
}