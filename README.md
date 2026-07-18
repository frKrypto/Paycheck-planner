# PayCheck Planner

Track your shifts, bills, and expenses to plan your paycheck.

## Setup

```bash
# Install root dependencies (concurrently)
npm install

# Install backend and frontend dependencies
npm run install:all

# Start both servers in development mode
npm run dev
```

The backend runs on **http://localhost:3001** and the frontend on **http://localhost:5173**.

### Running individually

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

## Project Structure

```
paycheck-planner/
├── backend/          # Express + TypeScript API
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── db.ts         # Database connection & schema
│   │   └── middleware/   # Auth and other middleware
│   └── data/             # SQLite database files (gitignored)
├── frontend/         # React + Vite + TypeScript
│   └── src/
│       ├── pages/        # Page components
│       ├── components/   # Reusable components
│       └── api/          # API client
└── CLAUDE.md         # Project conventions for contributors
```

## API

| Method | Path         | Description    |
|--------|-------------|----------------|
| GET    | /api/health | Health check   |

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, better-sqlite3, JWT
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, react-router-dom
- **Database**: SQLite (file-based in `/backend/data/`)
