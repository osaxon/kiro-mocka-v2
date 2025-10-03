import { runMigrations } from './migrate.js'
import { db, dbUtils } from './connection.js'

/**
 * Initialize the database
 * This function sets up the database and runs migrations
 */
export async function initializeDatabase() {
  try {
    console.log('Initializing database...')

    // Check database connection
    const info = dbUtils.getInfo()
    console.log(`Database path: ${info.path}`)
    console.log(`Database URL: ${info.url}`)

    // Run migrations
    await runMigrations()

    console.log('✅ Database initialized successfully')

    return db
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth() {
  try {
    const info = dbUtils.getInfo()

    // Test a simple query
    await dbUtils.exec('SELECT 1')

    return {
      status: 'healthy',
      info,
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}