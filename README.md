# FinSight AI

A full-stack, INR-first personal finance workspace: transaction ledger, budgets, savings goals, cash-flow analytics, what-if scenarios, notifications, reminders, a grounded AI assistant, and a reproducible AI research lab.

FinSight is a demonstration product. The demo data is fictional, there is no bank or UPI connection, and nothing in the app is financial advice.

## Demo

- Email: `demo@finsight.local`
- Password: `Demo@12345`

The same data can be opened with **Open dashboard**, **Explore the live demo**, or the demo button on the sign-in page.

## What is included

- Responsive marketing page, authentication flow, and protected application shell.
- Ledger with filtering, search, sorting, pagination, CSV import preview, and CSV export.
- Monthly budgets with warning/critical thresholds and copy-from-previous-month.
- Savings goals, contributions, pace tracking, and projections.
- Analytics for categories, monthly trends, recurring payments, anomalies, and reports.
- Scenario simulator for income, expense, and goal changes.
- In-app notifications generated from ledger rules, with configurable preferences and quiet hours.
- Bill reminders with due dates and mark-paid workflow.
- Grounded AI assistant with evidence, traceable figures, conversation history, and deterministic fallback.
- Research lab comparing baseline answers with grounded answers using a versioned rubric.
- Installable PWA with generated icons and an auto-updating service worker.
- Single-user isolation, JWT cookie authentication, PBKDF2 password hashing, and per-user data checks.

## Stack

- Frontend: React 19, TypeScript, Vite 7, Tailwind CSS, Radix UI, TanStack Query, React Router 7, Recharts, React Hook Form, Zod.
- Backend: FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, PyJWT, APScheduler.
- Data: SQLite by default; PostgreSQL supported through `DATABASE_URL`.
- AI: deterministic grounded provider by default; optional OpenAI-compatible endpoint.
- Tests: pytest and FastAPI TestClient.

## Quick start

Prerequisites: Python 3.12+, Node.js 20.19+ (Node 22 recommended), npm 10+.

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

On PowerShell, if activation is blocked, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The API is at `http://127.0.0.1:8000`, with interactive docs at `http://127.0.0.1:8000/api/docs`. On first start the backend creates the SQLite schema and seeds the fictional demo workspace.

### 2. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to port `8000`.

## Production build

The backend can serve the built frontend:

```powershell
cd frontend
npm ci
npm run build
cd ..\backend
.\.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000`. The SPA fallback serves `frontend/dist/index.html`, while `/api/*` remains API-only.

For a separate static host, set `VITE_API_URL` at build time and configure CORS. See [Deployment](docs/DEPLOYMENT.md).

## Validation

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q

cd ..\frontend
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Last validated on 23 October 2026:

- Backend: 47 tests passed.
- TypeScript: passed.
- ESLint: 0 errors, 0 warnings.
- Production build: passed with route-level code splitting.
- Production dependency audit: 0 vulnerabilities.
- Headless Chrome smoke test: every public and authenticated route, research run/export/delete, Settings bills, mobile layout, and both 404 variants passed with no runtime exceptions or console errors.

## Configuration

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`. The most important production settings are:

| Setting | Purpose |
| --- | --- |
| `SECRET_KEY` | Signs session tokens. Use a long random value. |
| `DATABASE_URL` | SQLite or PostgreSQL connection string. |
| `COOKIE_SECURE` | Set `true` behind HTTPS. |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins. |
| `SEED_DEMO_ON_STARTUP` | Whether to create/repair the fictional demo account at startup. |
| `ENABLE_SCHEDULER` | In-process notification scheduler. |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Optional hosted AI provider. |
| `AI_RATE_LIMIT_PER_HOUR` | Per-user assistant request limit. |

Frontend configuration is documented in [`frontend/.env.example`](frontend/.env.example).

## Project layout

```text
backend/
  app/api/          FastAPI routes and auth dependencies
  app/core/         Configuration and security
  app/db/           SQLAlchemy engine and session
  app/services/     Ledger, analytics, notifications, AI, research
  alembic/          Database migration
  tests/            API and finance regression tests
  data/             Local runtime database (ignored)
frontend/
  src/components/   Shared UI, app shell, dialogs
  src/hooks/        Auth and query helpers
  src/lib/          API client, types, formatting
  src/pages/        Public and authenticated routes
  public/           PWA icons and favicon
docs/               Architecture, API, research, and deployment notes
```

## Data and privacy

- Every account is isolated by `user_id`; cross-user resource access returns 404.
- Passwords use PBKDF2-HMAC-SHA256 with per-user salts and 600,000 iterations.
- Sessions are HttpOnly, SameSite=Lax cookies.
- Timestamps are stored in UTC. Date-only values such as bill due dates remain calendar dates.
- The deterministic assistant needs no external service. If a hosted provider is configured, the constructed financial context is sent to that provider.
- No email/SMS provider is configured. Notifications and bill reminders remain in-app.
- The demo account is intentionally accessible. Put a private production deployment behind access control or remove/disable demo access if the data must not be public.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API guide](docs/API.md)
- [Research methodology](docs/RESEARCH.md)
- [Deployment](docs/DEPLOYMENT.md)
