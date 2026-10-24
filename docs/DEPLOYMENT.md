# Deployment

## Recommended shape

Build the SPA once and serve it from FastAPI behind an HTTPS reverse proxy. This keeps the session cookie same-origin and avoids CORS complexity.

```powershell
cd frontend
npm ci
npm run build
cd ..\backend
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

FastAPI detects `frontend/dist/index.html` at startup and serves the SPA, assets, and `/api/*` from one origin. Startup-time detection means the server must start (or restart) after the build exists.

Health check: `GET /api/health` checks the database and reports the AI provider, configuration state, and version.

## Production environment

Start from [`backend/.env.example`](../backend/.env.example). At minimum:

```dotenv
ENVIRONMENT=production
SECRET_KEY=<long-random-secret>
COOKIE_SECURE=true
CORS_ORIGINS=https://finance.example.com
AUTH_RATE_LIMIT_ATTEMPTS=20
AUTH_RATE_LIMIT_WINDOW_SECONDS=300
DATABASE_URL=postgresql+psycopg://finsight:<password>@db:5432/finsight
SEED_DEMO_ON_STARTUP=false
ENABLE_SCHEDULER=true
```

Notes:

- Terminate TLS at the proxy and forward to Uvicorn on loopback.
- Use a unique, randomly generated `SECRET_KEY`; changing it invalidates existing sessions.
- Keep `COOKIE_SECURE=true` in HTTPS deployments. Production mode also enables
  secure cookies automatically.
- Authentication rate limits are stored in process memory. With multiple
  workers, use a shared rate-limit store at the proxy or replace the limiter.
- If frontend and API are separate origins, set `CORS_ORIGINS` exactly and build the frontend with `VITE_API_URL=https://api.example.com/api`. Prefer same-origin or a path-based reverse proxy because the session cookie is SameSite=Lax.
- The demo account is publicly accessible by design. Disable or restrict it if the application should not expose fictional demo data.
- No email or SMS delivery exists. Bill reminders and notifications stay in-app.

## Database

### PostgreSQL

1. Create the database and user.
2. Set `DATABASE_URL` as shown above.
3. Run migrations from `backend`:

```powershell
.\.venv\Scripts\alembic upgrade head
```

For production, set `AUTO_CREATE_TABLES=false` after migrations are part of the release process. SQLite remains the zero-setup local default.

### SQLite

The default database is `backend/data/finsight.db`. It is created and seeded on first start. Do not run multiple application instances against the same SQLite file. Back up the file if the demo data matters; it is excluded from git by default.

## Scheduler

APScheduler runs inside the API process. With one worker, the default configuration is sufficient.

With multiple workers, enable the scheduler in exactly one process (for example, a dedicated worker with `ENABLE_SCHEDULER=true`) and set `ENABLE_SCHEDULER=false` everywhere else. Running it in every worker duplicates evaluation work.

## AI provider

The default `AI_PROVIDER=deterministic` is self-contained. For an OpenAI-compatible endpoint:

```dotenv
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=<secret>
AI_MODEL=gpt-4o-mini
```

The backend sends it the constructed financial context. Review the provider's retention and data-processing terms before enabling it for real user data. Provider failures fall back to the deterministic grounded answer and are surfaced in the response metadata.

## PWA and caching

- The production build generates `manifest.webmanifest`, `sw.js`, and Workbox assets.
- Installability and service workers require HTTPS, except on localhost.
- API requests are network-only; the app shell is precached.
- The service worker uses automatic updates. Publish a fresh build rather than editing files in `dist`.

## Release checks

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q

cd ..\frontend
npm ci
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Then start the production server and verify:

- `/api/health` returns `status: ok`.
- Sign-in and demo sign-in work with secure cookies over HTTPS.
- A create/delete cycle works for a transaction, budget, goal, bill, and research run.
- Session cookies are `HttpOnly` and `Secure`.
- `/api/docs` is disabled or protected if the API should not be public.
- Backups and database migrations are owned by the deployment pipeline.
