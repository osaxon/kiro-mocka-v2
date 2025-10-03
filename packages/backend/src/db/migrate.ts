import { migrate } from 'drizzle-orm/libsql/migrator'
import { db, client, dbUtils } from './connection.js'
import path from 'node:path'

/**
 * Run database migrations
 */
async function runMigrations() {
  try {
    console.log('Running database migrations...')

    // Enable foreign keys
    await dbUtils.enableForeignKeys()

    const migrationsFolder = path.join(process.cwd(), 'drizzle')

    await migrate(db, { migrationsFolder })

    console.log('✅ Database migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
}

export { runMigrations }