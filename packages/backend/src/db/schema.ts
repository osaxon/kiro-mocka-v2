import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// APIs table
export const apis = sqliteTable('apis', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  name: text('name').notNull(),
  description: text('description'),
  port: integer('port').notNull().unique(),
  status: text('status', { enum: ['active', 'inactive'] }).default('inactive').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// Endpoints table
export const endpoints = sqliteTable('endpoints', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  apiId: text('api_id').notNull().references(() => apis.id, { onDelete: 'cascade' }),
  method: text('method', { enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] }).notNull(),
  path: text('path').notNull(),
  description: text('description'),
  requestHeaders: text('request_headers', { mode: 'json' }),
  requestParams: text('request_params', { mode: 'json' }),
  requestBody: text('request_body', { mode: 'json' }),
  defaultScenarioId: text('default_scenario_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueEndpoint: uniqueIndex('unique_endpoint').on(table.apiId, table.method, table.path),
}))

// Scenarios table
export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  endpointId: text('endpoint_id').notNull().references(() => endpoints.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  statusCode: integer('status_code').notNull(),
  responseHeaders: text('response_headers', { mode: 'json' }),
  responseBody: text('response_body', { mode: 'json' }),
  conditions: text('conditions', { mode: 'json' }),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// Request logs table
export const requestLogs = sqliteTable('request_logs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  apiId: text('api_id').notNull().references(() => apis.id, { onDelete: 'cascade' }),
  endpointId: text('endpoint_id').references(() => endpoints.id),
  scenarioId: text('scenario_id').references(() => scenarios.id),
  method: text('method').notNull(),
  path: text('path').notNull(),
  requestHeaders: text('request_headers', { mode: 'json' }).notNull(),
  requestBody: text('request_body', { mode: 'json' }),
  responseStatus: integer('response_status').notNull(),
  responseHeaders: text('response_headers', { mode: 'json' }).notNull(),
  responseBody: text('response_body', { mode: 'json' }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  duration: integer('duration'), // milliseconds
})

// Relations
export const apisRelations = relations(apis, ({ many }) => ({
  endpoints: many(endpoints),
  requestLogs: many(requestLogs),
}))

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  api: one(apis, { fields: [endpoints.apiId], references: [apis.id] }),
  scenarios: many(scenarios),
  requestLogs: many(requestLogs),
  defaultScenario: one(scenarios, {
    fields: [endpoints.defaultScenarioId],
    references: [scenarios.id]
  }),
}))

export const scenariosRelations = relations(scenarios, ({ one }) => ({
  endpoint: one(endpoints, { fields: [scenarios.endpointId], references: [endpoints.id] }),
}))

export const requestLogsRelations = relations(requestLogs, ({ one }) => ({
  api: one(apis, { fields: [requestLogs.apiId], references: [apis.id] }),
  endpoint: one(endpoints, { fields: [requestLogs.endpointId], references: [endpoints.id] }),
  scenario: one(scenarios, { fields: [requestLogs.scenarioId], references: [scenarios.id] }),
}))