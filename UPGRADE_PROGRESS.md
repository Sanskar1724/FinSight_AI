# FinSight AI Upgrade Progress

This file records the implementation flow, verification evidence, and push
status for the staged FinSight AI upgrades. Each upgrade is implemented,
tested, committed, and pushed separately.

- Repository: `https://github.com/Sanskar1724/FinSight_AI`
- Branch: `main`
- Working rule: no upgrade is marked complete until its targeted tests and the
  full regression suite pass.
- Financial data rule: no mock success states, no fabricated figures, and no
  secrets or real financial data in commits.

## Status

| Upgrade | Scope | Status |
| --- | --- | --- |
| 1 | Scenario baseline correctness | Complete |
| 2 | Authentication and session security | Planned |
| 3 | Notification lifecycle and links | Planned |
| 4 | AI intent, history, and reliability | Planned |
| 5 | Frontend navigation, state, and accessibility | Planned |
| 6 | Analytics date scope | Planned |
| 7 | Research lifecycle and safe exports | Planned |
| 8 | Automated testing and production readiness | Planned |

## Upgrade 1 - Scenario baseline correctness

**Status:** Complete and pushed.

**Problem:** A scenario baseline divided recorded spending by three even when
only one or two complete months had transactions. One month with INR 30,000 of
expenses produced an INR 10,000 monthly baseline.

**Policy:** A month is observed when it has at least one recorded transaction.
Category spending and income are averaged across observed complete months.
Months without records are excluded rather than treated as zero. Within an
observed month, a category with no spending contributes zero because the
denominator is the number of observed months. If no complete month has records,
the current partial month is used as a fallback. The app cannot infer whether
an unrecorded month had no activity or missing records, and the API response
now states this explicitly.

**Implementation:**

- Added `average_monthly_baseline()` in `backend/app/services/finance.py`.
- Updated the scenario API to use the shared observed-month calculation and
  removed the fixed divisor.
- Aligned the AI scenario path with the same baseline semantics.
- Updated scenario assumptions and frontend explanatory copy.
- Added regression tests for one, two, and three months, date boundaries,
  current-month exclusion, missing months, empty data, category-level
  consistency, and API/AI agreement.

**Verification:**

- `pytest -q`: 54 passed, 1 existing Starlette/httpx deprecation warning.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: no errors; LF/CRLF warnings only.

**Files changed:**

- `backend/app/api/routes/scenarios.py`
- `backend/app/services/ai_context.py`
- `backend/app/services/ai_service.py`
- `backend/app/services/finance.py`
- `backend/tests/test_budgets_goals_scenarios.py`
- `backend/tests/test_finance.py`
- `frontend/src/pages/scenarios.tsx`

**Known limitation:** The ledger has no coverage metadata, so the system cannot
distinguish a month with no activity from a month with missing records. Both
are excluded and disclosed in the response assumptions.

## Upgrade 2 - Authentication and session security

**Status:** Planned.

Planned scope: replace client-readable bearer-token exposure with a safer
session flow where practical, add token revocation/logout invalidation, tighten
cookie and CSRF behavior, add authentication rate limiting, and add security
headers. Tests must cover revoked sessions, cross-user isolation, CSRF
behavior, and rate-limit responses.

## Upgrade 3 - Notification lifecycle and links

**Status:** Planned.

Planned scope: fix stale or duplicate notifications, broken action links,
quiet-hours handling for critical alerts, exact threshold boundary behavior,
and global notification preferences. Tests must cover lifecycle transitions,
link targets, quiet hours, and exact 100 percent boundaries.

## Upgrade 4 - AI intent, history, and reliability

**Status:** Planned.

Planned scope: correct merchant/period intent handling, preserve useful session
history, align deterministic and hosted answers, add bounded rate limiting, and
ensure unsupported questions fail safely. Tests must cover intent routing,
history isolation, fallback behavior, and rate limits.

## Upgrade 5 - Frontend navigation, state, and accessibility

**Status:** Planned.

Planned scope: make deep links and query parameters reliable, remove assistant
request races, fix stale state transitions, and improve keyboard and screen
reader behavior. Tests must cover route state, race-prone flows, and accessible
labels.

## Upgrade 6 - Analytics date scope

**Status:** Planned.

Planned scope: make analytics date ranges explicit and consistent across
summary, comparison, category, and trend views. Tests must cover inclusive
boundaries, partial periods, empty ranges, and cross-view totals.

## Upgrade 7 - Research lifecycle and safe exports

**Status:** Planned.

Planned scope: make research runs durable across workers/restarts where the
deployment supports it, validate lifecycle transitions, and ensure exports are
safe and scoped to the requesting user. Tests must cover restart behavior,
authorization, CSV escaping, and export completeness.

## Upgrade 8 - Automated testing and production readiness

**Status:** Planned.

Planned scope: add CI gates, expand end-to-end coverage, verify PostgreSQL
compatibility and migration behavior, and document production limitations.
Tests must run the full backend suite, frontend typecheck/lint/build, and
critical user journeys in CI.
