# Feature: bank, credit card and UPI app statement import

This branch holds only the code for the statement PDF import feature of [FinSight AI](https://github.com/Sanskar1724/FinSight_AI). It was merged into `main` in [PR #2](https://github.com/Sanskar1724/FinSight_AI/pull/2). The full app lives on `main`, and the files here are the versions that were merged.

## What it does

- **Reads statement PDFs:** bank statements (SBI, HDFC, ICICI, Axis, Kotak and most others), credit card statements, and UPI app exports (PhonePe, Google Pay, Paytm, Navi, Amazon Pay, BHIM, CRED and others). Password-protected PDFs open with the password. The PDF and password are read in memory and never stored.
- **Finds the columns:** withdrawal, deposit, balance or amount columns come from the table header. Without a header, the running balance decides whether money went in or out. Dates like `01/10/26`, `01-Oct-2026`, `1 Oct 2026` and `Oct 01, 2026`, `Cr`/`Dr` and DEBIT/CREDIT markers, `₹`/`Rs.`/`INR` amounts and wrapped descriptions are handled.
- **Checks the numbers:** each row is checked against the printed running balance, and opening plus credits minus debits against the closing balance. The preview says "Verified", "Some rows do not match" or "Could not check".
- **Reads the descriptions:** UPI, NEFT, IMPS, POS, NACH, ATM, interest and charges rows, plus "Paid to" / "Received from" lines from UPI apps, become a clean merchant and payment method. The category comes from the user's own past choice for that merchant first, then from keyword rules.
- **Avoids double counting:** transfers (ATM withdrawals, card bill payments) are unticked. Rows already in the ledger are skipped, and a UPI app payment already imported from a bank statement (same amount within a day) is flagged. Two equal payments on the same day in one statement are both kept.
- **Review screen:** untick rows, rename merchants, change categories, flip money in or out, and pick the account before importing.

Tested on a real Navi export (92 rows, all amounts matched). Navi draws every character twice, which the reader removes.

## Files

| Area | File | Change |
| --- | --- | --- |
| Reader | `backend/app/services/statement_pdf.py` | PDF reading, columns, dates, amounts, balance check, bank and UPI app detection |
| Descriptions | `backend/app/services/narration.py` | Merchant, payment method, transfer and category rules |
| Preview and import | `backend/app/services/statement_import.py` | Suggested rows, duplicates, account match, saving |
| API | `backend/app/api/routes/statements.py`, `backend/app/main.py`, `backend/app/core/config.py` | `/api/statements/preview` and `/api/statements/import`, router, 10 MB limit |
| Schemas | `backend/app/schemas.py` | Preview and import request and response types |
| Dependencies | `backend/requirements.txt` | `pdfplumber`, and `reportlab` for the tests |
| Tests | `backend/tests/test_statements.py`, `backend/tests/statement_fixtures.py` | 20 tests on generated bank, card and UPI app style PDFs |
| UI | `frontend/src/components/statement-import-dialog.tsx` | Upload, password, preview and result |
| UI | `frontend/src/pages/transactions.tsx`, `pages/overview.tsx`, `components/command-palette.tsx`, `lib/api.ts`, `lib/types.ts` | Entry points, error codes and types |

## API

- `POST /api/statements/preview`: multipart `file` and optional `password`. Returns `statement_type` (`bank`, `credit_card` or `upi_app`), suggested rows, a balance check and a suggested account. Errors carry a `code` such as `password_required`, `password_incorrect`, `no_text` or `not_pdf`.
- `POST /api/statements/import`: the reviewed `rows` and an optional `account_id`. Duplicates are skipped.

## Testing

All 121 backend tests pass, and the frontend lint, typecheck and build pass.

These files need the rest of the app to run, so use `main` for that.
