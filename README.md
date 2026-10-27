# FinSight AI · Research Part 1: Grounding benchmarks

This branch holds only the Part 1 research experiments for FinSight AI. The application code lives on `main`, and the literature review lives on `research/multi-agent-finance-assistants`.

Part 1 asks one question: **do FinSight's three grounding components get measurably better when we replace today's simple methods with modern AI ones?** Every experiment runs on real public data, with no curated or synthetic examples.

| File | What it is |
| --- | --- |
| [`part1_grounding_benchmarks.ipynb`](part1_grounding_benchmarks.ipynb) | The full experiment notebook, ready to import into Kaggle |

## Experiments

| Exp | FinSight component | Real dataset | Today's method (baseline) | Methods compared | Primary metric |
| --- | --- | --- | --- | --- | --- |
| **E1** | Question router (`backend/app/services/ai_context.py`) | [Banking77](https://github.com/PolyAI-LDN/task-specific-datasets): 13,083 real online-banking customer queries, 77 intents | FinSight's hashed bag-of-words features with a nearest-intent rule | TF-IDF + logistic regression; `bge-small-en-v1.5` and `bge-m3` embeddings with centroid or logistic regression; full data and 5 / 10 examples per intent | Accuracy, macro-F1 |
| **E2** | Knowledge retrieval (`backend/app/services/knowledge.py`) | [FiQA-2018](https://github.com/beir-cellar/beir) (BEIR): 57,638 real finance forum answers, 648 test questions | 256-dim hashed bag-of-words + 0.35 keyword overlap, ported line by line | BM25; dense `bge-small-en-v1.5`, `bge-m3`; hybrid reciprocal-rank fusion; hybrid + `bge-reranker-base` | nDCG@10, MRR@10, Recall@100 |
| **E3** | Numeric grounding ("proof on every number") | [FinQA](https://github.com/czyssrs/FinQA): 1,147 test questions over real S&P 500 earnings reports | LLM answers directly | LLM writes a Python program; program + verifier that rejects any number not found in the report, retries once, then abstains | Accuracy, coverage, selective accuracy, ungrounded-program rate |

All results include 95% bootstrap confidence intervals, timing per query, and the exact configuration, so they can go straight into the paper's tables.

### Reference points from the literature

- **Banking77:** the dataset paper reports about 93% accuracy for its best full-data intent models, and a drop of about 8 points with 10 examples per intent ([Casanueva et al., 2020](https://arxiv.org/abs/2003.04807)).
- **FiQA:** the BEIR paper reports nDCG@10 = 0.236 for BM25 ([Thakur et al., 2021](https://arxiv.org/abs/2104.08663)).
- **FinQA:** the original paper reports 61.2% execution accuracy for FinQANet against 91.2% for human experts ([Chen et al., 2021](https://arxiv.org/abs/2109.00122)).

These numbers come from different setups, so treat them as context, not as direct comparisons. The fair comparison in each experiment is against the row marked **(current)**, which is what FinSight runs today.

## Run it on Kaggle

1. Open [kaggle.com/code](https://www.kaggle.com/code) and choose **New Notebook**.
2. Choose **File → Import Notebook**, then paste this link into the URL or GitHub field:
   `https://github.com/Sanskar1724/FinSight_AI/blob/research/part-1-grounding-benchmarks/part1_grounding_benchmarks.ipynb`
   If the URL import does not work, download the raw file and upload it instead:
   `https://raw.githubusercontent.com/Sanskar1724/FinSight_AI/research/part-1-grounding-benchmarks/part1_grounding_benchmarks.ipynb`
3. In the right panel, set **Accelerator → GPU T4 x2** and **Internet → On**. Internet needs a phone-verified Kaggle account.
4. For a quick check, set `FAST = True` in the first code cell and choose **Run All**. That takes about 10 minutes.
5. For the real results, set `FAST = False` and use **Save Version → Save & Run All (Commit)**, so the run continues in the background. A full run takes roughly 1–1.5 hours on a T4.
6. Download `part1_results/` from the notebook's **Output** tab.

### Settings worth trying

| Setting | Default | Try |
| --- | --- | --- |
| `LLM_NAME` | `Qwen/Qwen2.5-3B-Instruct` | `Qwen/Qwen2.5-7B-Instruct` with `LLM_4BIT = True` for stronger numeric results |
| `FINQA_N` | 400 | 1147 for the full FinQA test set (about 3× longer) |
| `EMBED_MODELS` | `bge-small-en-v1.5`, `bge-m3` | Add `BAAI/bge-base-en-v1.5` or a finance-tuned embedding model |
| `RERANKER_MODEL` | `BAAI/bge-reranker-base` | `BAAI/bge-reranker-v2-m3` (multilingual, slower) |

## Outputs

| File | Contents |
| --- | --- |
| `summary.csv` | One row per method: primary metric, 95% CI and secondary metrics |
| `results.json` | Configuration, environment, and every table |
| `e1_routing.csv`, `e2_retrieval.csv`, `e3_numeric.csv` | Full per-experiment tables |
| `e3_items.jsonl` | Every FinQA question with the model's direct answer, program, verifier decision, and gold answer, for error analysis |
| `summary.png` | Three bar charts, with today's FinSight method highlighted |

## What counts as an improvement

| Exp | FinSight improves if |
| --- | --- |
| E1 | A learned router beats the hashed-feature baseline in accuracy and macro-F1 with non-overlapping confidence intervals, in both the full and 10-shot settings, at under 20 ms per query |
| E2 | Hybrid + rerank beats today's retriever on nDCG@10 with non-overlapping confidence intervals |
| E3 | Program + verifier beats direct answering on accuracy, and its selective accuracy is clearly higher than direct accuracy, so that when FinSight answers it is right more often |

## Known limits

- None of these datasets are personal ledgers, because no public real household ledger dataset exists. Part 1 tests each component on the closest real public data. A private-ledger benchmark is planned for a later part.
- Banking77 and FiQA are English. Hinglish evaluation comes in a later part.
- E3's answer matching accepts a percentage given as a fraction and the reverse, the same for every arm, and the notebook says so.
- Each LLM run uses greedy decoding with one model. Report the model name and run more than one model before drawing conclusions for the paper.

## Research plan

- **Part 1 (this branch):** grounding components on real public benchmarks: routing, retrieval, numeric verification.
- **Part 2:** agents and memory: tool-calling agent versus router plus specialists versus orchestrator, user memory, and failure-mode labelling.
- **Part 3:** safety, households and India: prompt-injection and leakage tests, Hinglish, and the private-ledger benchmark.
