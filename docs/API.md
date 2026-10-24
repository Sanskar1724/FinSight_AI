# API guide

Interactive, authoritative documentation is available at `/api/docs` (Swagger UI), `/api/redoc`, and `/api/openapi.json`.

## Conventions

- Base path: `/api`.
- Authentication: the HttpOnly `finsight_session` cookie. The API does not return bearer tokens in response bodies; browser requests use same-origin cookies. Logout revokes the user's issued sessions.
- JSON errors use `{ "detail": "..." }`; validation errors use FastAPI's structured detail array.
- Dates use `YYYY-MM-DD`. Datetimes use UTC and may omit a trailing `Z`.
- Money values are JSON numbers rounded to two decimal places at the API boundary.
- List endpoints are user-scoped. Missing and foreign resource IDs both return `404`.
- Protected endpoints return `401` without a valid session.
- Transaction CSV export is available at `/api/transactions/export`.
- Research export supports `?format=json` and `?format=csv`.

## Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create an account and session. |
| POST | `/auth/login` | Sign in. |
| POST | `/auth/demo` | Create/repair and enter the fictional demo account. |
| POST | `/auth/logout` | Revoke issued sessions and clear the cookie. |
| GET | `/auth/me` | Return the current user. |
| POST | `/auth/demo/reset` | Replace demo data with the seeded dataset. Demo account only. |

Authentication endpoints are rate-limited per client address. Responses use
`429` with `Retry-After` when the limit is exceeded. Mutating requests with a
foreign `Origin` header are rejected with `403`. The session cookie is
HttpOnly, SameSite=Lax, and Secure when `COOKIE_SECURE=true` or
`ENVIRONMENT=production`.

## Reference data and system

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Database, AI, and version readiness. |
| GET | `/` | API identity, version, and disclaimer. |
| GET | `/categories` | Seeded income/expense categories. |

## Ledger

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/transactions` | Filtered, searched, sorted, paginated ledger. |
| POST | `/transactions` | Create a transaction. |
| GET | `/transactions/{id}` | Fetch one transaction. |
| PATCH | `/transactions/{id}` | Update a transaction. |
| DELETE | `/transactions/{id}` | Delete a transaction. |
| GET | `/transactions/export` | Export the filtered ledger as CSV. |
| POST | `/transactions/import/preview` | Validate and preview a CSV upload. |
| POST | `/transactions/import` | Commit a validated CSV import. |

List filters include `start`, `end`, `type`, `category_id`, `search`, `flagged`, `sort`, `page`, and `page_size`. Sort values use `<field>_<direction>`, for example `date_desc` or `amount_asc`.

## Dashboard, analytics, and scenarios

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard` | Current-month summary, trends, budgets, goals, and activity. |
| GET | `/analytics` | Category, trend, recurring, anomaly, and projection data. |
| POST | `/analytics/recurring/{merchant_key}/feedback` | Confirm or reject a recurring pattern. |
| POST | `/analytics/anomalies/{transaction_id}/feedback` | Confirm or dismiss an anomaly. |
| GET | `/analytics/report` | Download the analytics report. |
| POST | `/scenarios/simulate` | Calculate an income, expense, or goal what-if scenario. |

## Budgets and goals

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/budgets` | List monthly budgets and status. |
| POST | `/budgets` | Create a budget. |
| PATCH | `/budgets/{id}` | Update a budget. |
| DELETE | `/budgets/{id}` | Delete a budget. |
| POST | `/budgets/copy-previous` | Copy the prior month's budgets. |
| GET | `/goals` | List goals with progress and pace. |
| POST | `/goals` | Create a goal. |
| PATCH | `/goals/{id}` | Update a goal. |
| DELETE | `/goals/{id}` | Delete a goal. |
| POST | `/goals/{id}/contributions` | Add a contribution. |
| DELETE | `/goals/{id}/contributions/{contribution_id}` | Remove a contribution. |

## Notifications and bills

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/notifications` | Filter notifications and read state. |
| GET | `/notifications/unread-count` | Sidebar unread count. |
| POST | `/notifications/read-all` | Mark all notifications read. |
| POST | `/notifications/evaluate` | Run deterministic checks for the current user. |
| GET | `/notifications/preferences` | Read notification preferences. |
| PUT | `/notifications/preferences` | Update preferences, thresholds, and quiet hours. |
| POST | `/notifications/{id}/read` | Mark one notification read. |
| POST | `/notifications/{id}/unread` | Mark one notification unread. |
| DELETE | `/notifications/{id}` | Delete a notification. |
| GET | `/bills` | List bill reminders. |
| POST | `/bills` | Create a bill reminder. |
| PATCH | `/bills/{id}` | Edit or mark a bill paid. |
| DELETE | `/bills/{id}` | Delete a bill reminder. |

## AI assistant

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/ai/status` | Provider and configuration status. |
| GET | `/ai/suggestions` | Context-aware suggested prompts. |
| POST | `/ai/chat` | Ask a grounded question. |
| GET | `/ai/sessions` | List conversation sessions. |
| GET | `/ai/sessions/{id}` | Read a conversation. |
| DELETE | `/ai/sessions/{id}` | Delete a conversation. |

## Research lab

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/research/cases` | List the 28 seeded research cases. |
| POST | `/research/runs` | Start an asynchronous run from selected case IDs; returns `202`. |
| GET | `/research/runs` | List user runs and summaries. |
| GET | `/research/runs/{id}` | Poll run status and case-level responses. |
| GET | `/research/runs/{id}/export` | Export run and scores as JSON or CSV. |
| DELETE | `/research/runs/{id}` | Delete a run and its responses. |

See [RESEARCH.md](RESEARCH.md) for modes, scoring, and limitations.
