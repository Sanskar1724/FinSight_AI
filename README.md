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
| **E3** | Numeric grounding ("proof on every number") | [FinQA](https://github.com/czyssrs/FinQA): 1,147 test questions over real S&P 500 earnings reports | LLM answers directly (after brief reasoning) | Reason-then-program; program + grounding check (retry once, then abstain); agreement check (answer only when direct and program agree); agreement + grounding | Accuracy, coverage, right-when-answering (selective accuracy) |

All results include 95% bootstrap confidence intervals, timing per query, and the exact configuration, so they can go straight into the paper's tables.

## Technical approach

```text
part1_grounding_benchmarks.ipynb
├── 0 Configuration      FAST mode, seeds, model names, sample sizes
├── 1 Setup              installs, downloads with a local cache, bootstrap CIs, result writers
│   └── FinSight port    exact copy of knowledge.py hashing (256-dim signed feature hashing,
│                        unigrams + bigrams, log term weights, L2 norm, +0.35 keyword overlap)
├── E1 Routing           Banking77 → features → classifier → accuracy / macro-F1
├── E2 Retrieval         FiQA → index → rank top 100 → nDCG@10 / MRR@10 / Recall@100
├── E3 Numeric           FinQA → LLM arms → sandboxed execution → checks → scoring
└── Summary              summary.csv, results.json, per-item files, summary.png
```

**E1 · Routing**
- **Features:** FinSight hashed bag-of-words, TF-IDF (word 1–2-grams plus character 3–5-grams), and sentence embeddings (`bge-small-en-v1.5`, `bge-m3`, L2-normalised, fp16 on GPU).
- **Classifiers:** nearest intent centroid (cosine), and multinomial logistic regression (C = 10).
- **Regimes:** full training data, plus 5 and 10 examples per intent, each averaged over 3 seeded draws.
- **Timing:** time per query includes encoding.

**E2 · Retrieval**
- **FinSight (current):** hashed cosine + 0.35 × query-token overlap, scored in sparse matrix form.
- **BM25:** a sparse-matrix implementation (k1 = 1.2, b = 0.75).
- **Dense:** bi-encoder cosine; `bge-small` uses its query instruction; document embeddings are cached to disk.
- **Hybrid:** reciprocal-rank fusion (k = 60) of BM25 and the best dense run.
- **Rerank:** cross-encoder over the hybrid top 50, with the tail kept so Recall@100 stays comparable.
- **Robustness:** every method runs inside an error guard, and results are saved after each step.

**E3 · Numeric grounding**
- **Model and decoding:** one instruction-tuned LLM (Qwen 2.5 7B in 4-bit, with a 3B fp16 fallback) with greedy decoding. Prompts are batched by length, and every generation is cached.
- **Context:** FinQA gold supporting facts (`gold`) or the whole report (`full`).
- **Arm A:** the model reasons, then prints `Answer: <number>`.
- **Arm B:** the model reasons, then writes Python that sets `ans`, run in a sandbox with restricted builtins, no imports and a 3-second time limit.
- **Arm C:** B plus a grounding check. Every numeric constant in the program must appear in the context, allowing for small constants, % and fraction forms, and 10^3 / 10^6 / 10^9 scaling. A failure triggers one retry with the reason stated; a second failure means the system abstains.
- **Arms D and E:** answer only when A agrees with B (D) or with C (E), within 1% relative tolerance, with %/fraction equivalence.
- **Scoring:** FinQA execution accuracy with 1% relative tolerance, applied the same way to all arms.
- **Metrics:** accuracy, coverage, and right-when-answering, each with a 95% bootstrap CI.

**Reproducibility:** fixed seed 13, pinned dataset sources, model names recorded in `results.json`, and all raw generations saved in `e3_items.jsonl`.

### Reference points from the literature

- **Banking77:** the dataset paper reports about 93% accuracy for its best full-data intent models, and a drop of about 8 points with 10 examples per intent ([Casanueva et al., 2020](https://arxiv.org/abs/2003.04807)).
- **FiQA:** the BEIR paper reports nDCG@10 = 0.236 for BM25 ([Thakur et al., 2021](https://arxiv.org/abs/2104.08663)).
- **FinQA:** the original paper reports 61.2% execution accuracy for FinQANet against 91.2% for human experts ([Chen et al., 2021](https://arxiv.org/abs/2109.00122)).

These numbers come from different setups, so treat them as context, not as direct comparisons. The fair comparison in each experiment is against the row marked **(current)**, which is what FinSight runs today.

## Results (Part 1 complete, 27 Oct 2026, Kaggle Tesla T4)

**E1 · Routing (Banking77, 3,080 test queries), accuracy with 95% CI**

| Method | Full data | 10 per intent | 5 per intent |
| --- | --- | --- | --- |
| FinSight hashed BoW + centroid (current) | 65.5% (63.8–67.2) | 52.5% | 45.1% |
| TF-IDF word+char + logistic regression | 91.2% | 74.3% | 64.5% |
| bge-small-en-v1.5 + logistic regression | 93.3% (92.5–94.3) | 86.8% | 82.8% |
| bge-m3 + logistic regression | 93.4% (92.5–94.3) | 87.5% | 83.8% |

**E2 · Retrieval (FiQA-2018, 57,638 documents, 648 test queries)**

| Method | nDCG@10 (95% CI) | MRR@10 | Recall@100 |
| --- | --- | --- | --- |
| FinSight hashed BoW + overlap (current) | 0.127 (0.109–0.144) | 0.173 | 0.329 |
| BM25 | 0.236 (0.211–0.260) | 0.294 | 0.509 |
| Dense bge-small-en-v1.5 | 0.399 (0.373–0.426) | 0.484 | 0.688 |
| **Dense bge-m3** | **0.410 (0.382–0.438)** | **0.500** | **0.708** |
| Hybrid RRF (BM25 + bge-m3) | 0.361 (0.332–0.387) | 0.441 | 0.694 |
| Hybrid + rerank (bge-reranker-base, top 50) | 0.351 (0.324–0.377) | 0.421 | 0.694 |

Our BM25 reproduces the BEIR paper's 0.236 exactly. Dense bge-m3 is 3.2× today's retriever. Equal-weight fusion with the much weaker BM25 and a base-size reranker both lowered quality on FiQA.

**E3 · Numeric grounding (FinQA test, 300 questions, gold supporting-fact context)**

| Arm | Accuracy (95% CI) | Coverage | Right when answering (95% CI) |
| --- | --- | --- | --- |
| A · Direct answer (with reasoning) | 48.7% (43.3–54.3) | 100% | 48.7% |
| B · Reason, then program | 71.0% (66.0–76.0) | 98.3% | 72.2% (67.1–77.0) |
| C · Program + grounding check | 71.7% (66.7–76.7) | 98.7% | 72.6% (67.6–77.7) |
| D · Agreement (A = B) | 39.7% | 48.0% | 82.6% (76.4–88.2) |
| E · Agreement + grounding (A = C) | 40.0% | 48.3% | 82.8% (77.2–88.3) |

- Computing through a program beats stating the answer by about 22 points.
- The grounding check adds little, because errors are mostly a wrong row or formula, not invented numbers.
- Agreement between two routes gives a high-confidence tier: about 83% correct on the half of questions where the routes agree.

Gold context is an oracle-retrieval setting, so these numbers are not directly comparable with the original FinQA paper's full-pipeline 61.2%.

An earlier run (Qwen 2.5 3B, full report context, code arms without a reasoning step) gave direct 59.0%, program 48.5% and program + check 46.8%. Letting the code arms reason first reversed that result.

**Decisions for FinSight:**
- Use an embedding router (bge-small for English, bge-m3 for Hinglish).
- Use bge-m3 dense retrieval.
- Compute every number through code, and show a "verified" badge when two routes agree.

## Run it on Kaggle

1. Open [kaggle.com/code](https://www.kaggle.com/code) and choose **New Notebook**.
2. Choose **File → Import Notebook**, then paste this link into the URL or GitHub field:
   `https://github.com/Sanskar1724/FinSight_AI/blob/research/part-1-grounding-benchmarks/part1_grounding_benchmarks.ipynb`
   If the URL import does not work, download the raw file and upload it instead:
   `https://raw.githubusercontent.com/Sanskar1724/FinSight_AI/research/part-1-grounding-benchmarks/part1_grounding_benchmarks.ipynb`
3. In the right panel, set **Accelerator → GPU T4 x2** and **Internet → On**. Internet needs a phone-verified Kaggle account.
4. For a quick check, set `FAST = True` in the first code cell and choose **Run All**. That takes about 10 minutes.
5. For the real results, set `FAST = False` and use **Save Version → Save & Run All (Commit)**, so the run continues in the background. A full run takes about 50–60 minutes on one T4. Once E1 is done, set `RUN_E1_ROUTING = False` to skip it.
6. Download `part1_results/` from the notebook's **Output** tab.

### Settings worth trying

| Setting | Default | Try |
| --- | --- | --- |
| `LLM_NAME` | `Qwen/Qwen2.5-7B-Instruct` in 4-bit (falls back to 3B fp16 if 4-bit loading fails) | Any instruction-tuned model on Hugging Face |
| `FINQA_CONTEXT` | `gold` (annotated supporting facts) | `full` for the whole report (about 10× slower) |
| `FINQA_N` | 300 | 1147 for the full FinQA test set (about 4× longer) |
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
| E3 | An agreement or grounding arm is right-when-answering clearly above the direct arm's accuracy (non-overlapping CIs) at a coverage FinSight can live with (for example ≥ 70%) |

## Known limits

- None of these datasets are personal ledgers, because no public real household ledger dataset exists. Part 1 tests each component on the closest real public data. A private-ledger benchmark is planned for a later part.
- Banking77 and FiQA are English. Hinglish evaluation comes in a later part.
- E3's answer matching accepts a percentage given as a fraction and the reverse, the same for every arm, and the notebook says so.
- Each LLM run uses greedy decoding with one model. Report the model name and run more than one model before drawing conclusions for the paper.

## Research plan

- **Part 1 (this branch):** grounding components on real public benchmarks: routing, retrieval, numeric verification.
- **Part 2:** agents and memory: tool-calling agent versus router plus specialists versus orchestrator, user memory, and failure-mode labelling.
- **Part 3:** safety, households and India: prompt-injection and leakage tests, Hinglish, and the private-ledger benchmark.
