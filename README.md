# Feature: accounts, transfers and net worth

This branch holds only the code for the accounts feature of [FinSight AI](https://github.com/Sanskar1724/FinSight_AI). It was merged into `main` in [PR #1](https://github.com/Sanskar1724/FinSight_AI/pull/1). The full app lives on `main`, and the files here are the versions that were merged.

## What it does

- **Accounts:** bank, credit card, wallet, cash and loan accounts, each with an optional provider name, last 4 digits and credit limit.
- **Balances from the ledger:** a balance is never stored. It is the opening balance on a chosen date plus every linked transaction and transfer from that date on. Credit cards and loans count as money owed.
- **Transfers:** card bill payments, ATM withdrawals and wallet top-ups move money between your own accounts. They change balances but are not counted as income or spending, so budgets and analytics stay the same.
- **Net worth:** what you have minus what you owe, across active accounts. Transactions not linked to an account are counted so you can review them.
- **Transactions:** an optional account on each entry, an account filter, an account column in CSV export, and account linking on CSV import. Merchant suggestions also suggest the last account used.
- **Demo data:** fictional savings, credit card and cash accounts, with monthly card payments and ATM withdrawals.

## Files

| Area | File | Change |
| --- | --- | --- |
| Database | `backend/alembic/versions/e3a9c7d2b4f1_add_accounts_and_transfers.py` | New tables `accounts` and `account_transfers`, and `transactions.account_id` |
| Models | `backend/app/models.py` | `Account` and `AccountTransfer` models, and `Transaction.account` |
| Schemas | `backend/app/schemas.py` | Account, net worth and transfer request and response types |
| Logic | `backend/app/services/accounts.py` | Balance and net worth calculation |
| API | `backend/app/api/routes/accounts.py` | `/api/accounts`, `/api/accounts/net-worth` and `/api/accounts/transfers` |
| API | `backend/app/api/routes/transactions.py`, `backend/app/services/csv_import.py`, `backend/app/main.py` | Account on transactions, filter, export and import, and router registration |
| Demo | `backend/app/seed.py` | Demo accounts and transfers |
| Tests | `backend/tests/test_accounts.py`, `test_transactions_csv.py`, `test_ai_research.py` | 7 account tests, the suggestion test update, and a date-independent budget risk test |
| UI | `frontend/src/pages/accounts.tsx`, `components/account-dialogs.tsx`, `lib/accounts.ts` | Accounts page, and account and transfer dialogs |
| UI | `frontend/src/pages/overview.tsx`, `pages/transactions.tsx`, `components/transaction-dialog.tsx`, `components/csv-import-dialog.tsx` | Net worth strip, account filter and picker, and CSV account linking |
| UI | `frontend/src/App.tsx`, `lib/navigation.ts`, `lib/types.ts` | Route, menu entry and types |

## API

- `GET /api/accounts`: accounts with balances, plus the net worth summary
- `POST /api/accounts`, `PATCH /api/accounts/{id}`, `DELETE /api/accounts/{id}` (delete keeps the transactions and unlinks them)
- `GET /api/accounts/net-worth`
- `GET /api/accounts/transfers`, `POST /api/accounts/transfers`, `DELETE /api/accounts/transfers/{id}`
- `GET /api/transactions?account_id=` (0 means not linked) and `POST /api/transactions/import?account_id=`

## Testing

All 101 backend tests pass, and the frontend lint, typecheck and build pass. CI's `alembic check` confirms the migration matches the models on PostgreSQL.

These files need the rest of the app to run, so use `main` for that.
