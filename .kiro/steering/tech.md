# Technology Stack

This workspace is ready for project setup. The tech stack should be defined based on project requirements.

## Common Technology Choices

### Frontend
- React
- TypeScript for type safety
- Tailwind CSS
- ShadCN

### Backend
- Node.js
- SQLite
- API: REST 
- oRPC to provide layer between frontend and backend

### Development Tools
- Package managers: pnpm
- Build tools: Vite
- Testing: Vitest
- biome
- zod for schema validation

## Common Commands

Once the tech stack is established, document key commands here:

```bash
# Install dependencies
# npm install / yarn / pip install -r requirements.txt

# Development server
# npm run dev / yarn dev / python manage.py runserver

# Build for production
# npm run build / yarn build / python -m build

# Run tests
# npm test / yarn test / pytest / cargo test

# Linting and formatting
# npm run lint / yarn lint / black . / cargo fmt
```

## Code Quality Standards
- Use consistent formatting (Prettier, Black, rustfmt)
- Enable linting (Biome)
- Write meaningful commit messages
- Use semantic versioning for releases
- use zod validation when parsing requests from frontend to backend layer
- derive Typescript types from zod schemas
- follow an easy to understand structure for business logic - use services for all business logic
- utilise common design patterns where they fit the purpose