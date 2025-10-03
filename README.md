# API Mocking Service

A self-hostable API mocking service for developers to create and manage mock APIs for testing and development purposes.

## Features

- Create mock APIs through a clean web interface
- Import OpenAPI specifications to automatically generate mock endpoints
- Configure multiple scenarios per endpoint (success, error, different payloads)
- Test endpoints directly in the UI
- Each API runs on a dedicated port for easy integration
- Request logging and analytics

## Development

This project uses a monorepo structure with pnpm workspaces.

### Prerequisites

- Node.js 18+
- pnpm 9+

### Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Start development servers:
```bash
pnpm dev
```

This will start:
- Frontend development server on http://localhost:5173
- Backend API server on http://localhost:3000

### Project Structure

```
├── packages/
│   ├── frontend/     # React frontend with TanStack Router
│   ├── backend/      # Node.js backend with Express
│   └── shared/       # Shared types and schemas
├── .kiro/           # Kiro configuration and specs
└── docs/            # Documentation
```

### Available Scripts

- `pnpm dev` - Start all development servers
- `pnpm build` - Build all packages
- `pnpm test` - Run tests for all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Biome

## Architecture

The service consists of:

1. **Management UI** (React) - For creating and configuring mock APIs
2. **Management API** (Express) - Handles CRUD operations for APIs and endpoints
3. **Mock Servers** (Hono) - Individual lightweight servers for each mock API
4. **Database** (SQLite + Drizzle) - Stores API configurations and request logs

Each mock API runs on its own port, allowing client applications to connect directly to the mock endpoints.

## License

MIT