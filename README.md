# FinSight AI · Research Part 3: A personal-ledger test set (English + Hinglish)

This branch holds only the Part 3 research experiments for FinSight AI. The application code lives on `main`, Part 1 on `research/part-1-grounding-benchmarks`, Part 2 on `research/part-2-agents-and-memory`, and the literature review on `research/literature-review`.

Parts 1 and 2 tested FinSight's building blocks on **corporate** finance data. The literature review found the gap this part fills: **no benchmark tests an assistant on a person's own transactions with checked numbers, and none asks those questions in Hinglish** (gaps G1, G2 and G8 in `related_work.md`). Part 3 builds that test set from real public bank transactions and runs Part 1 and Part 2's winning methods on it.

| File | What it is |
| --- | --- |
| [`part3_local_gpu.ipynb`](part3_local_gpu.ipynb) | Builds the test set and runs every arm on the local model (Kaggle GPU T4 x2) |
| [`part3_api_cpu.ipynb`](part3_api_cpu.ipynb) | The same notebook with only the API model (no GPU), to run at the same time as the local one |

## Data: real public transactions only

| Ledger | Source | What it is | Licence |
| --- | --- | --- | --- |
| **Indian bank statements** | Kaggle [`apoorvwatsky/bank-transaction-data`](https://www.kaggle.com/datasets/apoorvwatsky/bank-transaction-data) | Real extracted statements of several Indian bank accounts in INR: date, narration, withdrawal, deposit, running balance | As on the Kaggle page; the test set is rebuilt from the source, not redistributed |
| **MoneyData** | Firat, Vytla, Singh, Jiang and Laramee, *MoneyVis*, EuroVis 2023; Mendeley Data [`10.17632/dnxtg6n4rv`](https://data.mendeley.com/datasets/dnxtg6n4rv/1) | One real person's anonymised UK retail current account over 7 years (6,500+ transactions, names replaced with pseudonyms by the authors) | CC BY 4.0 |

No public dataset is real, Indian and personal at once. The Indian ledger brings Indian narrations and amounts, and MoneyData brings a genuinely personal account, so a result that holds on both is not an artefact of one source. Synthetic statement sets (for example `AgamiAI/Indian-Bank-Statements`) are deliberately not used.

**How to run:** in Kaggle, import the notebook, click **Add Input** and add "Bank Transaction Data" by apoorvwatsky, and turn **Internet on**. MoneyData is downloaded from Mendeley's public API. If that download fails, download `laramee26openBankTransactionData.xlsx` from the Mendeley page, upload it as a private Kaggle dataset and add it as an input. The loader prints the columns it chose for each file; if one is wrong, set `columns=` for that ledger in `DATASETS`. For the API notebook, add your key as a Kaggle secret named `LLM_API_KEY`.

## How the test set is built

1. **Statements.** Each account is cut into calendar months, which is what a user uploads. A month with more than 80 rows is cut at the last whole day that fits ("1 to 12 March 2018"). Some statements cover two whole consecutive months, so month-to-month questions are possible.
2. **Questions.** For each statement, three question types are drawn from ten: money out, money in, net flow, number of debits, largest debit, average debit, spending on a word in the description, balance at the end of a day, change from one month to the next, and percentage change. Each type has two English and two Hinglish wordings, for example *"What were my total debits in December 2017?"* and *"December 2017 mein kul kitne ke debits hue?"*.
3. **Gold answers** are computed in code from the real rows with exact `Decimal` arithmetic. Every English question has a Hinglish twin with the same gold answer over the same rows, so the language gap is measured on paired items.
4. **Output:** `ledger_qa_items.jsonl` is the test set itself (statement text, both questions, gold answer, type).

The rows are real and every number is checkable, but the question **wording is templated**. A second slice, with questions written by real people in the 10–15 person user check, can be added without code changes: put one JSON object per line in a file (`{"statement": "<statement id>", "lang": "hi", "question": "...", "gold": "1234.50", "kind": "money"}`) and set `EXTRA_QUESTIONS_PATH`.

The gold answers were checked by an independent re-implementation of all ten question types, written as programs over the statement rows, which matched the gold on every item in a test run of the pipeline.

## Experiments

| Exp | Question | Arms | Primary metric |
| --- | --- | --- | --- |
| **E6** | Which method answers questions about a person's own statement correctly, in English and Hinglish, and when can an answer be marked *verified*? | **S1** direct answer · **S2** single agent + calculator (Part 2's best) · **P1** reason, then program with copied numbers (Part 1's best) · **T1** code over the ledger: the program reads the rows itself and may not type amounts in (FinSight's engine design) | Strict accuracy, English vs Hinglish (paired), tokens |
| **E6 badge** | Does agreement between T1 and another arm make a trustworthy "verified" badge? | T1 kept when S1, P1, or any other arm agrees | Accuracy when verified, coverage, risk–coverage curve |
| **E7** | Does transcript memory (Part 2's winner) still help on follow-ups about one's own spending? | No memory · Transcript, both with T1 | Accuracy on turns 3–4, which need turns 1–2 |

E7's conversations are four turns over a two-month statement, entirely in English or entirely in Hinglish: spending in month 1, "and in month 2?", how much more in the first month, and the total of both. The transcript holds the assistant's own earlier answers, never the gold ones.

**Scoring is strict**, because these are a person's own money: an amount is right only within 0.50 (rupee or pound) of the gold, a count must be exact, and a percentage must be within 0.1 points. Part 1's looser 1% rule is reported alongside for comparison. The answer parser accepts ₹, Rs, INR, £, Indian digit grouping (1,23,456) and "lakh"/"crore", so an answer in Indian style is not marked wrong.

## Technical approach

```
part3_local_gpu.ipynb
├── 0  Configuration    ledgers, models, API settings, sizes, FAST switch
├── 1  Setup            packages, output folder, bootstrap and paired-bootstrap CIs
├── 2  Load ledgers     find or download files, guess columns, signed or split amounts, balance-consistency check
├── 3  Test set         monthly statements, EN + Hinglish templates, Decimal gold answers, ledger_qa_items.jsonl
├── 4  Shared tools     Part 1/2's sandboxed program runner and calculator, Indian-format answer parser, strict scorer
├── 5  LLM backends     local Qwen 2.5 7B (4-bit) and an OpenAI-compatible API (default Gemini 3.5 Flash-Lite), one cache
├── E6 Ledger QA        four arms × two languages, verified badge, risk–coverage, breakdowns by type, ledger, length
├── E7 Memory           four-turn follow-up conversations, no memory vs transcript
└── Summary             summary.csv, results.json, summary.png, part3_results.zip
```

Both backends use the same system prompt, the same messages and greedy decoding. The API notebook answers the first `API_E6_N` questions per ledger of the same seeded sample, so its results pair with the local run. Every generation is cached with its token counts, so a run stopped by a rate limit resumes where it stopped.

**Default sizes:** up to 120 statements per ledger with 3 questions each; the local model answers 150 questions per ledger in each language (600 answers per arm), the API 40 per ledger. E7 uses 30 two-month statements per ledger, each as an English and a Hinglish conversation. Set `FAST = True` for a quick end-to-end check.

## Outputs

| File | Contents |
| --- | --- |
| `ledger_qa_items.jsonl` | The test set |
| `e6_items.jsonl` | Every E6 answer: predictions, correctness (strict and loose), tokens, program errors, agreement count |
| `e7_items.jsonl` | Every E7 turn |
| `summary.csv` | One row per backend and arm, with 95% bootstrap CIs and the Hinglish-minus-English gap |
| `results.json` | Data statistics (rows, accounts, balance consistency), all breakdowns, risk–coverage curves |
| `summary.png` | E6 accuracy by language, the verified-badge risk–coverage curve, E7 accuracy by turn |

Upload `part3_results.zip` (and `part3_api_results.zip`) after a run so the results can be committed here as paper evidence.

## What each result would mean for the app

- **T1 beats P1 and S2:** reading rows with code is better than copying numbers, so the app's engine should run queries over the parsed ledger, not over text pasted into the prompt.
- **A large Hinglish gap:** the Hinglish feature needs more than a reply translation, for example normalising the question to English before the engine runs.
- **Badge accuracy near 100% at useful coverage:** the "verified" badge can be shown with a stated error rate.
- **Transcript beats no memory on turns 3–4:** confirms Part 2's choice of plain transcript memory for personal follow-ups.
