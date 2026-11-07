# FinSight_AI literature review

This branch holds the related-work review for the FinSight_AI research paper (November 2026). It contains only the review and this README, with no app code.

## What's here

| File | Contents |
|---|---|
| [`related_work.md`](related_work.md) | The full review: paper tables, common patterns, research gaps, and how FinSight's experiments map onto each gap. It is written so it can be turned into the paper's related-work section. |

## Scope

The review covers the six research areas that FinSight's experiments touch:

1. **Numeric grounding on financial QA:** FinQA, TAT-QA, ConvFinQA, program-of-thought, calculator and critic agents, and agreement-based confidence.
2. **Intent routing:** Banking77, few-shot sentence encoders, and LLM vs encoder vs hybrid routers.
3. **Financial retrieval:** FiQA, BEIR, bge-m3, and FinMTEB.
4. **Conversational memory:** MemGPT, LoCoMo, LongMemEval, Mem0, and FinMem.
5. **Scam and fraud detection:** Fraud-R1, FraudSMSWalker, and recent LLM scam benchmarks.
6. **Indian and Hinglish finance:** GLUECoS, LinCE, COMI-LINGUA, IndiaFinBench, FIND/FinVQA, and a multilingual Indian fintech assistant (CIKM 2025).

It also cites multi-agent evidence (MAST and the EMNLP 2025 finance-agent survey). It builds on the earlier report on [`research/multi-agent-finance-assistants`](../../tree/research/multi-agent-finance-assistants) and does not repeat that report's industry, account-aggregation or regulation sections.

## Size and verification

- The tables have **37 entries (about 35 papers)**. Each entry gives the venue, year, dataset, method and headline result.
- Entries marked ✔ were checked against the paper's abstract or results page. Entries marked ◐ are well-known papers whose numbers come from the original publication and were not re-read. Check every ◐ number against the PDF before submission.
- Only real, citable papers are included.

## Main findings

- **The topic is crowded at the component level but open at the system level.** Many papers cover corporate-filing QA and trading agents. No paper evaluates an assistant on a person's own ledger with verified numbers, especially in India or in Hinglish.
- **Code should do the maths.** Every strong numeric result since 2022 executes code or uses a calculator instead of letting the model compute.
- **Multi-agent gains are often overstated.** The best-known critic-agent gains used oracle labels. Without them, critics do not beat chain-of-thought (Tan et al., 2025).
- **Small encoders route nearly as well as LLMs,** at a fraction of the latency.
- **Memory works best as extracted, time-stamped facts,** not full transcripts.

## The 9 gaps (G1–G9)

| # | Gap | FinSight evidence so far |
|---|---|---|
| G1 | No numeric-grounding study over a person's own ledger | E3: 48.7% → 71.0% with reason-then-program (FinQA) |
| G2 | No coverage–accuracy trade-off for "verified" finance answers | E3: agreement check is 82.6% right while answering 48% of questions |
| G3 | Multi-agent finance QA gains rely on oracle triggers | E4: router + specialists vs single agent on TAT-QA (table pending) |
| G4 | Few-shot routing not tested on personal-finance or Hinglish intents | E1: bge-m3 93.4% vs 65.5% rule-based (Banking77) |
| G5 | Hybrid search and reranking are assumed to help in finance | E2: bge-m3 nDCG@10 0.410 vs BM25 0.236; hybrid and rerank were worse |
| G6 | No memory study for multi-turn personal-finance follow-ups | E5: transcript memory 64.4% vs 53.7% with no memory (ConvFinQA); structured arm needs a rerun |
| G7 | Scam detection ignores Indian payment rails and Hinglish | Not started |
| G8 | Indian finance LLM work stops at regulation, exams or a single product | Not started |
| G9 | No integrated system evaluated end to end | Planned for Part 3 |

## Proposed main contribution

The main contribution is a **small Indian personal-ledger benchmark** built from real public data. It would include Hinglish questions and gold numbers computed by FinSight's deterministic engine. The paper would use it to evaluate the full pipeline: embedding routing, program-executed answers, agreement-based verification shown as a risk–coverage curve, and structured memory.

## Related branches

| Branch | Contents |
|---|---|
| [`research/multi-agent-finance-assistants`](../../tree/research/multi-agent-finance-assistants) | The October 2026 research report on industry systems, benchmarks, architecture and paper gaps |
| [`research/part-1-grounding-benchmarks`](../../tree/research/part-1-grounding-benchmarks) | Part 1 notebook: E1 routing (Banking77), E2 retrieval (FiQA), E3 numeric grounding (FinQA) |
| [`research/part-2-agents-and-memory`](../../tree/research/part-2-agents-and-memory) | Part 2 notebook: E4 router + specialists vs single agent (TAT-QA), E5 memory (ConvFinQA) |
