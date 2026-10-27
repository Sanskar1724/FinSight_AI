# FinSight AI research

This branch holds only the research behind FinSight AI's next stage: a unified personal finance assistant with outside platform integrations, household-level user management, and specialist bots, built so the work can be published as a paper.

Research brief 01 (27 Oct 2026) answers four questions:

1. How do industry and academia already build finance assistants, and where do they fall short?
2. Which benchmarks and metrics exist for finance LLMs and agents?
3. What architecture should FinSight AI grow into, starting from the code in this repo, and where can it measurably win?
4. Which research gaps can the paper claim, and what should the paper look like?

No application code was changed for this brief.

## Contents

| Path | What it is |
| --- | --- |
| [`REPORT.md`](REPORT.md) | The full report (about 5,000 words), with an inline source link on every claim. Start here. |
| [`report.html`](report.html) | The same report as a styled page with a contents rail. Open it in a browser. |
| [`notes/industry_products.md`](notes/industry_products.md) | Bank assistants, fintech agents, robo-advisors (US and India), regulator actions. |
| [`notes/account_aggregation.md`](notes/account_aggregation.md) | Plaid and US Section 1033, UK and EU open banking, India's Account Aggregator, UPI, BBPS, CAS, DPDP, transaction categorization. |
| [`notes/academic_agents.md`](notes/academic_agents.md) | Finance foundation models, agent frameworks, personal-finance LLM studies, accuracy techniques, surveys. |
| [`notes/benchmarks.md`](notes/benchmarks.md) | Finance QA sets, benchmark suites, agent benchmarks, safety benchmarks, evaluation methods, Indian benchmarks. |
| [`notes/architecture_and_gaps.md`](notes/architecture_and_gaps.md) | Orchestration patterns, MCP and A2A, grounding, security and regulation, user management, open research gaps. |
| [`build_report.py`](build_report.py) | Rebuilds `report.html` from `REPORT.md`: `pip install markdown`, then `python build_report.py REPORT.md report.html`. |

The notes are the raw evidence the report was written from. Each one is split into a takeaway, cited findings, inferences, and gaps. Figures marked as unverified or vendor-sourced in the notes should be re-checked before they go into the paper.

## Key findings

- **Keep one assistant in front.** The best-documented bank assistants (Wells Fargo's Fargo, Bank of America's Erica) show users one persona, use the LLM only to understand the request, and leave every calculation to deterministic systems. FinSight's Decimal engine (`backend/app/services/finance.py` on `main`) already works this way.
- **Treat multi-agent as a hypothesis.** Published studies find multi-agent LLM systems failing on 41–87% of tasks, often with small gains over a single agent, and finance trading agents lose most of their reported edge under realistic testing. The paper should test specialists against simpler designs with an ablation rather than assume they help.
- **The open gap is a private-ledger benchmark.** To our knowledge, no public benchmark scores an assistant on a person's own transactions with checkable gold answers, and none covers Indian retail finance (INR budgeting, UPI narrations, tax regime choice, SIPs, Hinglish).
- **Integrations follow the licence boundary.** Only RBI, SEBI, IRDAI or PFRDA regulated entities can receive Account Aggregator data. Start with bank statements and CAS PDFs, prototype AA in a sandbox, then go live through a regulated partner.
- **Fix the evaluation first.** The current lexical rubric in `backend/app/services/research.py` favours grounded answers by construction (for example, automatic grounding credit for refusals and a no-context baseline). Phase 0 replaces it with independent gold answers, a calibrated LLM-judge jury, pass^k, cost and latency logging, and confidence intervals.

## Proposed architecture in one paragraph

A hybrid router (today's regex `detect_intent` plus an LLM for ambiguous questions) sends each question to a specialist: spending and cash flow, budgets and bills, goals and scenarios, anomaly sentinel, ingestion and categorization, knowledge and literacy, and later a confirm-then-act action agent. Every specialist calls the existing engine through typed, read-only tools. A numeric-faithfulness verifier, grown from `extract_amounts` and `_all_context_amounts` in `research.py`, checks that every number in an answer matches a tool output before the user sees it. Users belong to households with owner, partner, dependent and advisor roles, and each agent receives a short-lived, down-scoped token with every tool call logged. See section 3 of the report for the module-by-module map and the six build phases.

## Paper direction

Working title: *Do Personal Finance Assistants Need Many Agents? A Verified-Ledger Benchmark and Ablation.* Planned contributions are an India-context synthetic household-ledger benchmark with independently computed gold, a numeric-faithfulness metric and verifier, an ablation of single-agent, routed and orchestrated designs (arms A0–A7) with failure-mode labels and cost, a household consent model evaluated for leakage, and FinSight AI itself as the open reference system. Section 4 of the report lists the research questions, experiments, metrics, threats to validity and target venues.
