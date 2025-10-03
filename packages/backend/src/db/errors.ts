/**
 * Database error types and utilities
 */

export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends DatabaseError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends DatabaseError {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Handle SQLite constraint errors and convert them to appropriate error types
 */
export function handleDatabaseError(error: unknown): never {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Handle unique constraint violations
    if (message.includes('unique constraint failed')) {
      if (message.includes('apis.port')) {
        throw new ConflictError('Port is already in use')
      }
      if (message.includes('unique_endpoint')) {
        throw new ConflictError('Endpoint with this method and path already exists')
      }
      throw new ConflictError('Resource already exists')
    }

    // Handle foreign key constraint violations
    if (message.includes('foreign key constraint failed')) {
      throw new ValidationError('Referenced resource does not exist')
    }

    // Handle not null constraint violations
    if (message.includes('not null constraint failed')) {
      const field = message.split('.').pop()
      throw new ValidationError(`Field ${field} is required`, field)
    }

    // Re-throw database errors as-is
    if (error instanceof DatabaseError) {
      throw error
    }

    // Wrap other errors
    throw new DatabaseError(`Database operation failed: ${error.message}`, error)
  }

  throw new DatabaseError('Unknown database error occurred')
}

/**
 * Wrap a database operation with error handling
 */
export async function withErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    handleDatabaseError(error)
  }
}