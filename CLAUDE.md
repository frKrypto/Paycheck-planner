# PayCheck Planner — Project Conventions

## General
- TypeScript strict mode everywhere (`strict: true` in tsconfig.json)
- Use `async/await` for asynchronous operations; avoid raw promises
- Prefer named exports over default exports for utility modules
- File names: `kebab-case` for utility files, `PascalCase` for React components

## Backend (`/backend`)
- **Framework**: Express with TypeScript
- **API pattern**: RESTful — `GET /api/resource`, `POST /api/resource`, `PUT /api/resource/:id`, `DELETE /api/resource/:id`
- **Route handlers**: Separate route files in `src/routes/`, one file per resource
- **Middleware**: Auth middleware in `src/middleware/`, validation middleware alongside routes
- **Database**: SQLite via `better-sqlite3`, synchronous API
- **Auth**: JWT-based. User ID attached to `req.userId` by auth middleware
- **Error handling**: Use a centralized error handler middleware; throw custom `AppError` instances

## Frontend (`/frontend`)
- **Framework**: React with Vite and TypeScript
- **Components**: Functional components with hooks; no class components
- **State management**: React Context for global state (auth, etc.); local state for component-scoped data
- **Routing**: react-router-dom v6+
- **API calls**: Centralized axios instance in `src/api/client.ts`
- **Styling**: Tailwind CSS (utility-first)
- **File structure**:
  - `src/pages/` — page-level components (one per route)
  - `src/components/` — reusable UI components
  - `src/api/` — API client and resource modules
  - `src/hooks/` — custom hooks
  - `src/contexts/` — React Context providers

## Testing
- Backend: Vitest or Jest with supertest for API tests
- Frontend: Vitest + React Testing Library
- Test files co-located with their source: `foo.test.ts` next to `foo.ts`
- Aim for meaningful coverage on business logic and API endpoints
