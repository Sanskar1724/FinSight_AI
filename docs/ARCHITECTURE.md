# Architecture

FinSight AI is a same-origin React SPA backed by a FastAPI JSON API. The built frontend can be served by Vite during development or by FastAPI in production.

```text
Browser
  React 19 + TanStack Query + React Router
        |
        | /api (HttpOnly session cookie)
        v
FastAPI routes
  auth / ledger / budgets / goals / analytics / scenarios
  notifications / bills / AI / research / health
        |
        v
SQLAlchemy services and models
  deterministic finance and ledger rules
        |
        +--> SQLite (default) or PostgreSQL
        +--> optional OpenAI-compatible AI provider
        +--> APScheduler notification checks
```

## Frontend

- `src/App.tsx` owns lazy route loading, guards, titles, and boundary routes.
- `src/components/app-shell.tsx` provides authenticated navigation and global transaction entry.
- `src/lib/api.ts` is the single API client. It includes cookies, normalizes API errors, emits the unauthorized event, and supports blob downloads.
- TanStack Query owns server state, caching, and invalidation.
- Forms use React Hook Form and Zod; calculations are never performed from display strings.
- `src/lib/utils.ts` formats INR, dates, and percentages. Backend datetimes without a timezone are treated as UTC; date-only values remain local calendar dates.
- Route-level lazy imports keep large analytics and chart code out of the initial shell.
- The PWA service worker precaches the app shell and fonts. API requests are always network-only.

## Backend

- `app/api/routes/` contains thin HTTP handlers and ownership checks.
- `app/services/finance.py` owns Decimal helpers, month bounds, and financial calculations.
- `app/services/ledger.py` centralizes transaction querying and CSV behavior.
- `app/services/notifications.py` evaluates deterministic rules and writes in-app notifications.
- `app/services/ai_context.py` builds the calculated, user-scoped context used by the assistant and research lab.
- `app/services/ai_service.py` calls the optional hosted provider or produces a deterministic grounded answer.
- `app/services/research.py` executes baseline/grounded comparisons and rubric scoring.
- `app/models.py` contains SQLAlchemy models; `alembic/` contains the schema migrations.

## Authentication and isolation

- Registration and demo login issue a JWT signed with `SECRET_KEY`; the JWT is
  stored only in an HttpOnly, SameSite=Lax cookie named `finsight_session` and
  is not returned in the response body.
- Each JWT carries the user's `token_version`. Logout increments that version,
  invalidating previously issued sessions. Changing `SECRET_KEY` invalidates
  every session as well.
- Passwords use PBKDF2-HMAC-SHA256, a random per-user salt, and 600,000 iterations.
- Authentication endpoints are rate-limited in-process. Multi-worker
  deployments should replace the limiter with a shared store.
- Unsafe requests with a foreign `Origin` are rejected, and responses include
  standard security headers.
- Every resource query is scoped to the authenticated user. Unauthorized users and foreign resource IDs both return 404 to avoid leaking existence.
- `POST /api/auth/demo` and `/api/auth/demo/reset` are intentionally available for the fictional demo account.

## Financial invariants

- Money is calculated as `Decimal`; floats are only used at the JSON boundary.
- Transaction types are income and expense. Reports treat expenses as positive magnitudes and derive net cash flow explicitly.
- Budgets are monthly and unique per user, category, and month.
- Goal progress uses recorded contributions; projections are estimates, not guarantees.
- Aggregates are calculated by the backend. The UI does not invent or independently recompute authoritative totals.
- INR formatting uses Indian digit grouping. Charts shorten values (for example, Rs 1.5L) only for display.

## Notifications and bills

- APScheduler runs an in-process notification check every `NOTIFICATION_CHECK_MINUTES`.
- Rules cover budget thresholds, unusual spending, recurring payments, bill due dates, goal pace, and summaries.
- Notification preferences and quiet hours are persisted per user.
- Bills are reminders, not payments; users mark them paid explicitly.
- No email or SMS provider exists, so delivery remains in-app.
- The scheduler is process-local. With multiple API workers, enable it in only one dedicated process.

## Grounded AI

1. The intent classifier selects the relevant finance context.
2. The backend computes current figures from the user's ledger.
3. Retrieved knowledge-base passages are added when relevant.
4. The provider receives the question and constructed context.
5. Responses include evidence and limitations; unsupported claims are avoided.
6. If no API key is configured or a provider call fails, a deterministic answer grounded in the same context is returned.

The assistant never receives bank credentials, and no bank connection exists.

## Research lab

Research runs are asynchronous API operations. A run selects seeded question cases, executes each in baseline and grounded mode, stores every response with evidence and rubric scores, and exposes polling plus JSON/CSV export. See [RESEARCH.md](RESEARCH.md).

## Timestamps

Database datetimes are stored in UTC. API datetimes are serialized without an offset, so the frontend normalizes them as UTC. Date-only fields such as transaction dates and bill due dates are not timezone-shifted.

## Known constraints

- No real bank, UPI, payment, email, or SMS integration.
- The research rubric is an automated heuristic and does not replace human evaluation.
- SQLite is suitable for the demo and single-instance use; use PostgreSQL for concurrent production traffic.
- The hosted AI provider is optional and must be assessed for data-processing requirements before production use.
- The demo account is public by design. Restrict it or remove demo access for a private deployment.
