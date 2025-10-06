// Database connection and utilities
export { db, client, dbUtils } from './connection.js'

// Database initialization
export { initializeDatabase, checkDatabaseHealth } from './init.js'

// Migration utilities
export { runMigrations } from './migrate.js'

// Database schema
export * from './schema.js'

// Database types
export * from './types.js'

// Note: Database services have been moved to ../services/

// Error handling
export * from './errors.js'