# Contributing to FinSight AI

Thanks for wanting to help. FinSight AI is a personal finance assistant for India (and later the rest of the world) where **every number can be checked**. It is also a research project that will end in a published paper. You can help with code, research, data, design, or just by trying the app and telling us what you think.

This guide covers what the project is, where help is needed, and how to send your work.

**Questions?** Open an [issue](https://github.com/Sanskar1724/FinSight_AI/issues) or message San ([@Sanskar1724](https://github.com/Sanskar1724)) directly.

---

## 1. The big picture

**The goal:** one app that brings together what people use CRED, mutual fund apps, and Zerodha for, with an AI assistant that answers from your own records and shows the proof behind every figure.

**The research:** we test which AI design actually gives correct answers on personal finance questions. The work is split into three parts:

| Part | Question | Status |
| --- | --- | --- |
| 1. Grounding | Which search, routing, and number-checking methods give correct answers? (Banking77, FiQA, FinQA) | Done. Best results: `bge-m3` embeddings, computing numbers with code, and a "verified" badge when two methods agree. |
| 2. Agents and memory | Do several specialist agents beat one agent? Does conversation memory help? (TAT-QA, ConvFinQA) | Running. So far one agent with a calculator beats the multi-agent setups, and transcript memory helps follow-up questions. |
| 3. Indian personal-ledger test set | A small, real test set of Indian personal transactions with questions in English and Hinglish | Next. Help wanted. |

**The demo app:** a focused set of four or five features for the paper:

1. **Statement reader**: upload a bank statement or CAS PDF and get a clean ledger.
2. **Proof on every number**: each answer shows the records and the calculation behind it.
3. **Scam shield**: spot suspicious messages, UPI requests, and transactions.
4. **Hinglish**: ask questions the way people actually talk.
5. **WhatsApp** (maybe): ask the assistant from WhatsApp.

**The plan from here:** finish Part 2, build Part 3 and the demo app side by side, run a small user trust check, write the paper, and publish on arXiv and then TMLR.

---

## 2. Where you can help

Pick whatever fits your skills. Comment on (or open) an issue first so two people don't do the same thing.

### Code (React + FastAPI)

- Build one of the demo features above.
- Pick an open item from the [roadmap](README.md#roadmap): browser end-to-end tests, PostgreSQL in CI, dark mode, the Zod 4 upgrade.
- Fix bugs, improve accessibility, or add tests.

### Research (Python notebooks on Kaggle)

- Re-run a notebook on Kaggle and check that you get the same numbers.
- Try a new model or method in an experiment and report whether the benchmark improved.
- Read papers and suggest related work we are missing.

### The Indian personal-ledger test set (Part 3)

- Write realistic questions about a ledger in English and Hinglish ("is mahine Swiggy pe kitna gaya?").
- Check the correct answer for each question by hand.
- Help find **public** data sources we can build on.

### The user trust check

We want to know whether people in India would trust an app like this. We plan to talk to 10 to 15 people.

- Try the app yourself and write down what confused you or what you didn't trust.
- Help find people to interview, or help write and run the short interview.

### Docs, design, and translation

- Improve the README, guides, and screenshots.
- Suggest UI improvements or design new screens.
- Help with Hindi and Hinglish wording in the app.

---

## 3. Ground rules

These keep the research honest and the project safe. Please read them before you start.

1. **Real public data only.** Research uses real, public datasets. Never make up, curate by hand, or generate synthetic data for benchmarks, and never invent figures in results.
2. **No private financial data in the repo.** Never commit real bank statements, account numbers, PAN, Aadhaar, phone numbers, or anyone's personal transactions. If you want to donate your own data to the test set, talk to San first. It must be anonymised and given with consent.
3. **No secrets.** Never commit API keys, passwords, or `.env` files. Use `backend/.env.example` as the template.
4. **Free tools only.** The project runs on free tools: local open models, Kaggle GPUs, and free API tiers. Don't add anything that needs a paid account.
5. **Not financial advice.** The app is a planning tool. Features must not promise returns or tell people what to buy.
6. **Only San merges.** Nothing goes into `main`, or into any research branch, without San reviewing and merging it.

---

## 4. Set up the app

You need **Python 3.12+**, **Node.js 20.19+** (22 recommended), and **Git**.

### Get the code

If San has added you as a collaborator, clone the repo directly:

```bash
git clone https://github.com/Sanskar1724/FinSight_AI.git
cd FinSight_AI
```

If not, click **Fork** on GitHub first, then clone your fork:

```bash
git clone https://github.com/<your-username>/FinSight_AI.git
cd FinSight_AI
git remote add upstream https://github.com/Sanskar1724/FinSight_AI.git
```

### Start the API (terminal 1)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Start the web app (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and click **Explore the live demo**, or sign in with `demo@finsight.local` / `Demo@12345`. The demo data is fictional.

### Run the checks before you push

```bash
# backend (from backend/, with the virtual environment active)
python -m pytest -q

# frontend (from frontend/)
npm run lint
npm run typecheck
npm run build
```

CI runs the same checks on every pull request, so it saves time to run them first.

---

## 5. Set up the research notebooks

Each research part lives on its own branch as a Jupyter notebook (`.ipynb`) that runs on Kaggle's free GPUs.

| Branch | What's on it |
| --- | --- |
| `research/multi-agent-finance-assistants` | The research report that shaped the plan |
| `research/literature-review` | Related work (about 30 papers) and the gaps we target |
| `research/part-1-grounding-benchmarks` | Part 1 notebook (E1 to E3) |
| `research/part-2-agents-and-memory` | Part 2 notebook (E4, E5) |

To run a notebook:

1. Download the `.ipynb` file from its branch on GitHub.
2. On [Kaggle](https://www.kaggle.com/code), click **New Notebook → File → Import Notebook** and upload it.
3. Under **Settings**, turn on a **GPU** accelerator and **Internet**.
4. Run all cells. Each notebook downloads its own public datasets.
5. Download the results folder or zip at the end and share it in your pull request or issue.

Every experiment runs on a **local open model** (the main, reproducible result) and a **free API model** (for comparison). If you use an API model, put your key in Kaggle's **Add-ons → Secrets**, never in the notebook.

When you report results, include the model, the number of questions, the score, and the confidence interval if the notebook prints one. Report results that didn't improve too. A negative result is still a result.

---

## 6. Branches

Branch names say what is on the branch. Use lowercase words joined by hyphens, and one branch per piece of work.

| Kind of work | Pattern | Example |
| --- | --- | --- |
| New app feature | `feature/<what>` | `feature/statement-reader` |
| Bug fix | `fix/<what>` | `fix/budget-rounding` |
| Docs | `docs/<what>` | `docs/hinglish-guide` |
| Tests or CI | `test/<what>` | `test/e2e-login` |
| Research | `research/<part-and-topic>` | `research/part-3-personal-ledger-test-set` |

Rules:

- **`main` holds the app code only.** Branch app work from `main`.
- **Research branches hold only their own research files and their own README**, not the app code. To add to an existing research part, branch from that research branch (for example `research/part-2-hinglish-prompts` from `research/part-2-agents-and-memory`). For a brand new research part, ask San first.
- **Don't mix work.** A notebook doesn't go in an app branch, and an app change doesn't go in a research branch.
- **Never merge anything yourself**, including into your own branches from other people's work, unless San asks.

---

## 7. Commits

Write short, clear commit messages that say what changed:

```text
feat(ledger): read HDFC statement PDFs into transactions
fix(budgets): round projections to the nearest rupee
docs: add Kaggle setup steps to the research README
test(auth): cover password reset with an expired token
```

Common prefixes: `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `research`.

Commit under your own name and email, and keep each commit to one change.

---

## 8. Pull requests

1. **Open or claim an issue** so San knows what you are working on.
2. **Create your branch** from the right base (see [Branches](#6-branches)).
3. **Make your change** and run the checks.
4. **Push your branch** and open a pull request:
   - App work: into `main`.
   - Research work: into the research branch you started from.
5. **Describe your pull request**: what changed, why, how you tested it, and screenshots for UI changes or result tables for research.
6. **Wait for review.** San will review it, may ask for changes, and merges it when it's ready.

Keep pull requests small. One feature or one fix is much easier to review than five.

---

## 9. Ideas that help the most right now

If you're not sure where to start, these are the most useful:

- **Statement reader**: turn a bank statement PDF into ledger rows (use public sample statements or your own, never committed).
- **Hinglish questions** for the Part 3 test set, each with a checked answer.
- **Re-run Part 2** on Kaggle and confirm the numbers.
- **Try the app for 15 minutes** and write down everything that made you trust it less.
- **Scam shield**: collect public examples of UPI and SMS scams (from bank or government warnings) to test against.

Thank you for helping!
