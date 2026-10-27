# Make FinSight_AI's agents earn their place

FinSight_AI should grow into a multi-agent personal finance assistant in a specific way: one assistant persona in front, a router that hands questions to specialist agents, every agent calling one shared deterministic Decimal engine through typed tools, and a numeric-faithfulness verifier checking every answer before the user sees it. The multi-agent layer should be treated as a hypothesis to test, not as the contribution itself. That design follows what the best-documented industry systems already do. Wells Fargo's Fargo uses an LLM only for intent and entity extraction, and "the bank's APIs do not pass through the LLM" ([VentureBeat](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)). It also takes the evidence against free-form multi-agent systems seriously: across 1,642 traces from seven frameworks, those systems failed on **41–86.7% of tasks**, often with "minimal" gains over single-agent baselines ([MAST, arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)). The publishable gap is clear and, as far as these notes could find, open. Public finance benchmarks test corporate filings (FinanceBench, FinQA, Vals Finance Agent), trading (InvestorBench) or Chinese and regulatory QA. None tests an agent over a **private, per-user ledger** with verified gold numbers, consent and role constraints, Indian payment rails, and a component-by-component multi-agent ablation. The repository already holds most of the pieces for such a paper: a deterministic engine (`backend/app/services/finance.py`), a grounded assistant with evidence (`ai_context.py`, `ai_service.py`), and a research lab (`research.py`, `docs/RESEARCH.md`). What it lacks is evaluation rigor (a lexical rubric over 28 cases), real integrations (CSV only), and user management beyond single accounts. The recommended paper is a benchmark-plus-system paper. Its headline claim would be that verified, tool-grounded routing beats both LLM-only and free-form multi-agent designs on accuracy, consistency, leakage and cost, with honest reporting wherever multi-agent orchestration does not help.

## Industry converged on "LLM as interface, deterministic systems as authority"

### Bank assistants hide specialists behind one persona

Bank assistants run at very large scale, and their designs are conservative. Bank of America's Erica had **20.6 million users and nearly 700 million interactions in 2025**, but BofA discloses no model, vendor or resolution rate ([BofA Newsroom](https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/03/bofa-ai-and-digital-innovations-fuel-30-billion-client-interacti.html)). Wells Fargo's Fargo is the best-documented architecture:

1. Speech-to-text runs on the device.
2. A small model detects PII, and the text is scrubbed and tokenized.
3. Gemini Flash 2.0 performs only intent and entity extraction.
4. All computation stays on bank systems.

The bank calls itself "the filters in front and behind". Interactions grew from 21.3M in 2023 to **245.4M in 2024** ([VentureBeat](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)). Wells Fargo's genuinely multi-agent work happens behind the scenes. A LangGraph-based network re-underwrote 15 years of loan documents with one job per agent (retrieve, extract, match to system of record, calculate), and a human reviewed only the final output ([VentureBeat](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)). Intuit likewise runs "select AI agents across its platform", but users see one Intuit Assist ([TechCrunch](https://techcrunch.com/2025/11/18/intuit-signs-100m-deal-with-openai-to-bring-its-apps-to-chatgpt)). The researchers found **no consumer product that shows users multiple named bots**. In practice, multi-agent design is an internal implementation choice.

Indian bank assistants are narrower still. HDFC's EVA, built by Senseforth in 2017, answers FAQ-style questions about products, fees and IFSC codes ([Analytics India Magazine](https://www.analyticsindiamag.com/hdfc-banks-eva-becomes-indias-largest-smartest-chatbot/)). Coverage of SBI's YONO 2.0 mentions a unified code base for about 100M customers but no AI assistant features ([The Week/PTI](https://www.theweek.in/wire-updates/business/2025/12/14/dcm18-biz-sbi-yono.html)). The researchers found no public evidence of LLM-based advisory features in Indian bank apps.

### Fintechs moved from chat to action, but none publishes how it checks numbers

From 2025 to 2026, fintech assistants started taking actions. Products separate information from action and limit actions to narrow, reversible operations:

- **Revolut AIR** (April 2026) reads only data the user can already see. It can manage subscriptions, freeze cards and buy eSIMs, and Revolut claims zero data retention ([Revolut](https://www.revolut.com/news/revolut_enters_new_era_of_money_intelligence_with_launch_of_ai_assistant/)).
- **Robinhood Cortex** helps build trades but **does not execute them** ([Benzinga](https://www.benzinga.com/25/03/44530226/robinhood-launches-ai-investment-tool-cortex-to-expand-market-analysis-access-a-premium-research-assistant-right-)).
- **Public's "Agentic Brokerage"** splits into Research, Creation and Action pillars, and its announcement describes no guardrails ([FX News Group](https://fxnewsgroup.com/forex-news/retail-forex/public-introduces-new-phase-of-its-ai-vision-agentic-brokerage/)).

A second pattern has appeared in the same period: general LLMs acting as hubs that pull in finance apps.

- **Intuit** put TurboTax, Credit Karma and QuickBooks inside ChatGPT under a deal worth over $100M ([TechCrunch](https://techcrunch.com/2025/11/18/intuit-signs-100m-deal-with-openai-to-bring-its-apps-to-chatgpt)).
- **ChatGPT's personal finance experience** (May 2026) links accounts through Plaid's more than 12,000 institutions, and OpenAI says it is "not a replacement for professional financial advice" ([PYMNTS](https://www.pymnts.com/artificial-intelligence-2/2026/chatgpt-connects-financial-accounts-to-deliver-personal-finance-insights/)).
- **Monarch MCP** (October 2026) exposes a user's Monarch data to Claude and ChatGPT ([Monarch](https://www.monarch.com/whats-new)).

**None of these products publishes how it verifies the numbers its assistant states.** That gap is the most defensible position a research prototype can claim.

### Robo-advisors are rules engines, and Indian "robos" are mostly distribution platforms

US robo-advisors are SEC-registered advisers running rules-based allocation, rebalancing and tax-loss harvesting. Their growth is increasingly in cash: **53% of Wealthfront's $88.2B platform assets** were cash management as of July 2025 ([Renaissance Capital](https://www.renaissancecapital.com/IPO-Center/News/115274/investing-robo-advisor-wealthfront-sets-terms-for-450-million-ipo)). India's leaders are mainly execution and distribution platforms for direct mutual funds rather than discretionary advisers. Groww's clients held ₹1.1 trillion in MF AUM, and Groww captures about 39% of direct-plan SIP inflows ([Business Standard](https://www.business-standard.com/amp/markets/mutual-fund/groww-drhp-reveals-mf-clout-125091701274_1.html)). Regulation constrains what FinSight_AI can claim:

- SEBI's December 2024 amendment requires investment advisers to disclose their use of AI ([Taxmann](https://taxmann.com/post/blog/sebi-mandates-investment-advisers-to-disclose-use-of-ai-tools-to-clients-in-providing-investment-advice)).
- SEBI's February 2025 amendment makes regulated entities **"solely responsible" for AI output** ([Lexplosion](https://lexplosion.in/sebi-issues-guidelines-on-ai-usage-entities-using-ai-ml-tools-responsible-for-data-security-ai-generated-outputs-and-compliance-with-applicable-laws/)).
- The SEC fined Delphia and Global Predictions for "AI washing" ([SEC 2024-36](https://www.sec.gov/newsroom/press-releases/2024-36)).

The paper and the product must therefore never claim abilities the engine lacks. FinSight's existing `unsupported_advice` refusal intent is an asset here, not a limitation.

### Account aggregation: the US is a cautionary tale and India's AA is the right rail but a licensed one

In the US, aggregation still mixes credential scraping with token-based APIs. The rules are unsettled:

- The CFPB's Section 1033 rule is **enjoined and under reconsideration**, so its April 2026 compliance date triggered nothing ([Cozen O'Connor](https://www.cozen.com/news-resources/publications/2026/section-1033-compliance-date-open-banking-rule-enjoined-and-under-reconsideration)).
- FDX is the recognized standard-setter through 2030 ([Open Banking Tracker](https://www.openbankingtracker.com/guides/section-1033-status)).
- JPMorgan now charges Plaid for data that used to be free ([Banking Dive](https://www.bankingdive.com/news/plaid-pay-jpmorgan-data-open-banking-fintech/760264/)).
- Plaid paid **$58M** to settle claims that it collected bank credentials through login screens styled like banks' own ([JURIST](https://www.jurist.org/news/2021/08/plaid-agrees-to-pay-58-million-in-data-privacy-class-action-lawsuit/)).

The UK shows what a mandated API regime looks like at maturity: 18.8M user connections and **99.80% weighted API availability** in June 2026 ([Open Banking Ltd](https://www.openbanking.org.uk/news/open-banking-surpasses-one-billion-payments-and-100-billion-api-calls/)). The EU's PSD3/PSR targets PSD2's shortcomings. It requires permission dashboards and API performance "at least as good as" the bank's own app, but most rules apply only from about 2028 ([Open Banking Tracker](https://www.openbankingtracker.com/guides/psd3-psr-readiness)).

India's Account Aggregator (AA) framework is consent-native and large:

- More than **500M fulfilled consents** and more than 310M customer-linked accounts by September 2026 ([Sahamati](https://sahamati.org.in/media-article/account-aggregator-crosses-500-million-consents-as-india-marks-5th-aa-foundation-day/)).
- About 7.69M personal-finance-management customers were served in FY25 ([Business Standard](https://www.business-standard.com/amp/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html)).

It has three shortcomings that matter for FinSight:

- **Only regulated entities can be data users (FIUs).** They must be regulated by RBI, SEBI, IRDAI or PFRDA ([Setu docs](https://docs.setu.co/data/account-aggregator/licenses-and-go-live/licenses)).
- **Coverage is uneven.** A vendor blog, which sells a competing product, reports that only about 40% of banks expose fixed deposits and that joint and NRE accounts are unsupported ([CASParser](https://casparser.in/blog/state-of-account-aggregator-2026/)).
- **Reliability is uneven.** Fetches can fail or be 1–2 days stale ([Fold docs](https://docs.fold.money/introduction-to-aa-for-fintechs)).

RBI has ordered AA interoperability by 31 December 2026, but the architecture and liability rules are still unresolved ([MediaNama](https://www.medianama.com/2026/10/223-sahamati-bg-mahesh-rbi-account-aggregator-interoperability/)). UPI handles about 24B transactions a month ([StartupTalky](https://startuptalky.com/india-upi-transactions-september-2026/)). The researchers believe it offers no read API to third-party personal-finance apps but could not verify this, so UPI visibility realistically comes through bank statements. India's DPDP Rules make FinSight a data fiduciary. Consent-manager registration begins around November 2026, and the main duties (notice, consent, 72-hour breach reporting, erasure) start around **May 2027** ([MirvoLegal](https://www.mirvolegal.com/insights/dpdp-rules-2025-compliance-timeline/)).

Integration also depends on categorizing transactions, and that remains hard. Intuit's 2025 QuickBooks paper reports **68.67% top-1 few-shot** and **45.52% zero-shot** accuracy ([arXiv 2506.09234](https://arxiv.org/pdf/2506.09234)). Plaid claims only relative gains of "up to 10%" ([Plaid](https://plaid.com/blog/ai-enhanced-transaction-categorization/)). The researchers found no Indian categorization benchmark.

### Academic agents target trading, and their headline results do not survive scrutiny

Academic finance agents almost all target trading or equity research:

- **TradingAgents** uses analyst, debating-researcher, trader and risk roles ([arXiv 2412.20138](https://arxiv.org/abs/2412.20138)).
- **FinCon** uses a manager-analyst hierarchy ([arXiv 2407.06567](https://arxiv.org/abs/2407.06567)).
- **FinMem** uses layered memory ([arXiv 2311.13743](https://arxiv.org/abs/2311.13743)).
- **FinRobot** is a layered agent platform ([arXiv 2405.14767](https://arxiv.org/abs/2405.14767)).

Critics have since taken these results apart. "The Alpha Illusion" finds that **35 of 40 system-by-friction-component cells are unmodelled** across five well-known frameworks. In the authors' reproduction, TradingAgents' Sharpe ratio falls from 0.43 to 0.22 after costs, below buy-and-hold. The paper also cites evidence that multi-agent debate wins only **about 20% of the time across 36 configurations** ([arXiv 2605.16895](https://arxiv.org/abs/2605.16895)). FINSABER reports that FinMem's return drops by about 72% once the test window passes the model's knowledge cutoff ([arXiv 2505.07078](https://arxiv.org/html/2505.07078v5)). The Alpha Illusion's prescription matches FinSight's existing design: use LLMs as **"auditable upstream information interfaces"**, with calculation and risk in independent modules that can override them ([arXiv 2605.16895](https://arxiv.org/abs/2605.16895)).

On personal finance specifically, three independent lines of evidence say unconstrained LLMs are unreliable advisers, and users cannot tell when they are wrong:

- **Literacy tests.** Ten models averaged **68.47%** on literacy tests ([arXiv 2412.19784](https://arxiv.org/pdf/2412.19784)).
- **Simulated advice.** GPT-5.2's advice in a life-cycle simulation relied on heuristics, never rebalanced, and varied by a median of about **$3,220 in annual consumption** across repeated identical queries. Roughly a third of the gender equity gap was supply-side bias ([arXiv 2608.01607](https://arxiv.org/html/2608.01607v1)).
- **User trust.** In a 64-person lab study, user trust was insensitive to advice quality and sometimes moved inversely with it ([arXiv 2504.05862](https://arxiv.org/abs/2504.05862v2)).

The closest system analogue to FinSight is VeNRA. It parses documents into a typed fact ledger, has the LLM write code against that ledger, and uses a roughly 3B "Sentinel" model to audit execution traces ([arXiv 2603.04663](https://arxiv.org/html/2603.04663v1)).

| Approach | Representative | What it solves | Where it falls short for FinSight's problem |
|---|---|---|---|
| Bank NLU assistant | Fargo, Erica, EVA | Scale; PII kept from the LLM; deterministic APIs | Single institution; no cross-account view; no public evaluation |
| Fintech agent | Revolut AIR, Cleo, Cortex | Actions, voice, memory | No published numeric verification; Cleo paid a $17M FTC settlement over deceptive claims ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/cash-advance-company-cleo-ai-agrees-pay-17-million-result-ftc-lawsuit-charging-it-deceives-consumers)) |
| LLM hub plus aggregator | ChatGPT + Plaid, Monarch MCP | Breadth of data and apps | Liability unclear; "not a replacement for professional financial advice"; US-centric |
| Robo-advisor | Wealthfront, Groww | Rules-based allocation, distribution | Narrow scope; little conversational grounding |
| Aggregation rail | Plaid, UK OB, India AA | Data access | Licensing (FIU), coverage gaps, fees, breakage |
| Academic agent | TradingAgents, FinCon, FinMem | Role specialization, memory | Trading-only; results collapse under realistic evaluation |
| Verified-ledger system | VeNRA | Typed facts, code execution, sentinel | Corporate documents, not household ledgers |

## Twenty-plus finance benchmarks exist, and none scores a household ledger

### Document QA is about corporate filings

Classic numerical QA sets now serve mainly as regression checks:

- **FinQA:** 8,281 questions; at publication, human experts scored about 91% execution accuracy against about 61% for the best model ([arXiv 2109.00122](https://arxiv.org/abs/2109.00122)).
- **ConvFinQA:** a multi-turn extension of FinQA ([arXiv 2210.03849](https://arxiv.org/abs/2210.03849)).
- **TAT-QA:** 16,552 questions over hybrid table-plus-text contexts ([arXiv 2105.07624](https://arxiv.org/abs/2105.07624)).

A 7B RL-trained model, Fin-R1, reports 76.0 on FinQA and 85.0 on ConvFinQA ([arXiv 2503.16252](https://arxiv.org/abs/2503.16252v2)). The harder sets are long-document and analyst-style:

- **FinanceBench:** GPT-4-Turbo with retrieval answered incorrectly or refused **81%** of questions in the original study ([arXiv 2311.11944](https://arxiv.org/pdf/2311.11944)).
- **FinanceQA:** frontier models scored 31–49% exact match. On questions that require the model to generate its own assumptions, every model scored only **2.2–4.3%** ([arXiv 2501.18062](https://arxiv.org/pdf/2501.18062)).
- **DocFinQA:** pairs each question with a full filing averaging about 123k words ([arXiv 2401.06915](https://arxiv.org/html/2401.06915v3)).
- **SEC-QA:** program-of-thought or agentic methods reach up to 80% exact match, against 30–55% for generic RAG ([arXiv 2406.14394](https://arxiv.org/html/2406.14394v1)).

Every one of these sets is built on US corporate disclosures. None contains bank statements, UPI narrations, payslips or budgets.

### Broad suites are mostly classification, extraction and QA

FinBen covers 36 datasets across 24 tasks ([arXiv 2402.12659](https://arxiv.org/abs/2402.12659)). FinMTEB evaluates embeddings and is directly useful for replacing FinSight's hashed retriever ([arXiv 2502.10990](https://arxiv.org/abs/2502.10990)). FinSearchComp's three task types (time-sensitive fetching, simple historical lookup, complex investigation) give a good template for difficulty tiers, and its LLM judge agreed with humans about 95% of the time ([arXiv 2509.13160](https://arxiv.org/html/2509.13160v1)). Many suites are Chinese-language: FinEval, CFLUE, BizFinBench, FinGAIA.

### Agent benchmarks have no banking or personal-finance domain

The Vals AI Finance Agent Benchmark v2.1 is the most current independent finance-agent leaderboard:

- 449 private test questions, plus a public set of 27.
- Severity-weighted partial credit, with "dealbreaker" facts that zero out an answer.
- A three-LLM jury grades answers.
- Cost and latency are reported for each test.

On 26 October 2026 the leaders were clustered at **67–68%**, with costs ranging up to **$8.91 per test** ([Vals AI](https://www.vals.ai/benchmarks/fabv2-1)). tau2-bench introduced dual-control simulated users and **pass^k**, the probability that all k independent trials succeed. Dual control cut pass^1 by 18–25% ([arXiv 2506.07982](https://arxiv.org/pdf/2506.07982)), but the benchmark has no banking domain, and its telecom scores are near ceiling on aggregator leaderboards whose rows are not comparable with one another ([benchlm.ai](https://benchlm.ai/benchmarks/tau2-bench)). FinGAIA's best agent scored 48.9% against 84.7 for financial experts ([arXiv 2507.17186](https://arxiv.org/html/2507.17186v2)).

### Safety and Indian benchmarks

Safety benchmarks exist for detecting financial hallucinations and for prompt injection:

- **PHANTOM** tests hallucination detection in long-context financial QA ([NeurIPS 2025](https://neurips.cc/virtual/2025/poster/121830)).
- **AgentDojo** has 629 security cases, including a banking suite ([arXiv 2406.13352](https://arxiv.org/abs/2406.13352)).
- **InjecAgent** has 1,054 indirect-injection cases, some involving unauthorized transfers ([arXiv 2403.02691](https://arxiv.org/abs/2403.02691)).
- **AgentLeak** measures privacy leakage through inter-agent messages and shared memory, not only through final outputs ([arXiv 2602.11510](https://arxiv.org/html/2602.11510v1)).

The researchers found **no benchmark for advice suitability, lending fairness or household consent**. For India, IndiaFinBench is the only verified public benchmark grounded in Indian regulation: 406 SEBI and RBI questions, best model 89.7%, non-specialist human 69.0% ([arXiv 2604.19298](https://arxiv.org/abs/2604.19298)). Nothing covers ITR regime choice, UPI disputes or INR household budgeting.

### Evaluation practice has moved past FinSight's lexical rubric

Current finance evaluations use four practices that FinSight's lab does not yet use:

- **Calibrated LLM judges.** Rubric judges or juries are checked against human labels. SECQUE-Judge reached F1 0.85 agreement with humans ([arXiv 2504.04596](https://arxiv.org/abs/2504.04596)).
- **Refusal as a separate outcome.** FinanceBench grades answers as correct, incorrect or refused ([arXiv 2311.11944](https://arxiv.org/pdf/2311.11944)).
- **Faithfulness metrics.** RAGAS-style faithfulness and context precision ([arXiv 2309.15217](https://arxiv.org/abs/2309.15217)).
- **Reliability, cost and latency.** pass^k for reliability, and cost and latency reported next to accuracy ([Vals AI](https://www.vals.ai/benchmarks/fabv2-1)).

MAST adds a failure taxonomy that can be applied to traces. It has 14 modes in three categories, human agreement of κ=0.88, and an LLM judge at 94% accuracy ([arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)).

| Benchmark or metric | What it measures | FinSight relevance |
|---|---|---|
| FinanceBench-150 (open subset) | Filing QA: correct / incorrect / refused | Cheap external sanity number; not FinSight's domain |
| Vals Finance Agent (public 27) | Analyst agent tasks with cost and latency | External agent sanity check; FinSight will not lead it |
| FinanceQA assumption subset | Surfacing assumptions | Tests FinSight's `missing_data` / `ambiguous` handling |
| IndiaFinBench | SEBI/RBI interpretation and numerics | Knowledge-agent RAG over Indian regulation |
| MoneyCounts/NFEC literacy | Personal-finance knowledge | Literacy agent; compare with the 68% mean |
| FinMTEB | Embedding retrieval quality | Choosing a replacement for hashed embeddings |
| AgentDojo banking, InjecAgent | Attack success rate, utility under attack | Injection via uploaded statements and KB text |
| AgentLeak | Inter-agent privacy leakage | Required once specialists share memory |
| pass^k, MAST labels, judge κ | Reliability, failure modes, evaluation validity | Core of the ablation study |

## A routed, verified architecture grows directly from FinSight's existing modules

### The current repo is already a "routing workflow"

Anthropic separates *workflows*, where code paths are predefined, from *agents*, where the LLM directs its own tool use. It advises starting with the simplest workflow that works and moving to orchestrator-workers only for parallel, context-heavy tasks ([Anthropic, Building effective agents](https://www.anthropic.com/research/building-effective-agents)). FinSight is already a routing workflow:

- `detect_intent` in `backend/app/services/ai_context.py` classifies about 20 intents with regex.
- `build_context` computes user-scoped figures from `finance.py` and `ledger.py`.
- `backend/app/services/ai_service.py` either narrates those figures through an optional LLM or returns `deterministic_answer`.
- Around line 499, `ai_service.py` falls back to the deterministic answer if an exact-intent LLM reply contains no digit. This is a primitive verification gate.

The research lab already contains the seed of a numeric-faithfulness metric. `extract_amounts`, `required_amounts` and `_all_context_amounts` in `backend/app/services/research.py` compute which rupee amounts in a response were never present in the evidence.

The same lab also shows why its current scores cannot carry a paper:

- **Refusal intents get automatic grounding credit.** `evaluate_response` assigns grounding 5.0 to every refusal-type intent.
- **The invented-figure penalty is gated.** It applies only when the response contains "you" or "your".
- **Refusals are detected by substring.** `REFUSAL_MARKERS` includes common words such as "never" and "cannot".
- **The baseline is a straw man.** It answers with no context, so the grounded mode wins partly by construction.

### Every agent maps to existing code

Anthropic's own data argues against putting agents everywhere. Personal-finance questions mostly read the same ledger, which is the "shared context, many dependencies" case Anthropic calls a poor fit for multi-agent ([Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)). Multi-agent systems in that study also used about **15× the tokens** of chat ([Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)). The design below therefore keeps one persona, one engine and one verifier. "Agents" are specialist prompt-and-tool bundles behind a router. Orchestrator-workers are allowed only for compound questions such as "Can I afford X given my goals, bills and tax?".

| Agent / layer | Grows out of | What to build | Metric it should move |
|---|---|---|---|
| **Router / supervisor** | `ai_context.detect_intent` (regex, about 20 intents) | Hybrid: keep regex as the trusted first pass, add an LLM classifier only for `general`/`ambiguous`; emit a plan of tool calls; detect compound questions | Intent accuracy and macro-F1 on a labelled set; MAST FC1 rate (spec disobedience, step repetition) |
| **Typed tool layer** | `finance.py` (budgets, goals, forecasts with backtest, recurring, anomalies, scenarios), `ledger.py` | Expose engine functions as typed, read-only tools with poka-yoke parameters (month bounds, category IDs) and Decimal outputs carrying provenance IDs | Exact-answer accuracy against independent gold; tool-call error rate |
| **Spending & cash-flow analyst** | `total_spending`, `comparison`, `merchant`, `cash_flow` intents | Specialist prompt plus tools; no free text-to-SQL. BookSQL shows ledger text-to-SQL is far from solved ([arXiv 2406.07860](https://arxiv.org/abs/2406.07860)) | Numeric Faithfulness Rate (NFR); pass^k |
| **Budget & bills agent** | Budget burn-rate in `finance.py`; `Bill` model; `notifications.py` rules | Bill calendar tools; BBPS bill-fetch via a partner later ([Setu BillPay](https://docs.setu.co/payments/billpay/v1/api-integration/apis)) | Budget-status accuracy; alert precision and dismiss rate |
| **Goals & scenario planner** | Goal projections, observed-month scenario baselines, `routes/scenarios.py` | Multi-step "what-if" with assumptions stated explicitly | Assumption-surfacing rate (FinanceQA-style); run-to-run variance (target zero for numbers) |
| **Anomaly / fraud sentinel** | Anomalies in `finance.py`; `AnomalyFeedback` model | Use feedback as labels; explain each flag with evidence | Precision and recall against `AnomalyFeedback` labels |
| **Ingestion & categorization agent** | `csv_import.py`, `csv_safety.py`, `RecurringOverride` | CAS PDF parser, bank-statement parsers, UPI VPA-to-merchant normalization, per-user correction learning | Top-1 categorization accuracy (context: Intuit's 68.67% few-shot reference, different data); import error rate |
| **Knowledge & literacy agent** | `knowledge.py` (256-dim hashed bag-of-words) | Replace hashing with an embedding model chosen using FinMTEB; add Indian tax and regulatory corpus | Recall@K and nDCG on a labelled KB set; IndiaFinBench and literacy-test accuracy |
| **Verifier / citation agent** | `research.extract_amounts`, `_all_context_amounts`; digit check in `ai_service.py` | Deterministic post-hoc checker: every number in the answer must match a tool output or cited passage within tolerance; on mismatch, regenerate once, then abstain or fall back | NFR, unsupported-number rate, abstention precision |
| **Policy & safety guard** | `injection`, `privacy`, `unsupported_advice`, `action_request` intents; `FORBIDDEN_PATTERNS` | CaMeL-style split between control flow and data flow: retrieved or uploaded text never chooses tools or parameters | AgentDojo-style attack success rate and utility under attack |
| **Action agent (later)** | `action_request` (currently refused) | Confirm-then-act for reversible operations (create budget, mark bill paid) with step-up authentication | Action success pass^k; unintended-action rate |
| **Evaluator / lab** | `research.py`, `docs/RESEARCH.md`, `ResearchCase/Run/Response` | Larger case set, judge jury, pass^k, cost and latency logging, MAST labels, bootstrap CIs | Judge–human κ; confidence-interval width |

The verifier is the single most important addition. MAST found that **missing or incorrect verification accounts for about 17% of failures**, and that adding high-level objective verification gave the largest measured improvement, **+15.6%** on ChatDev ([arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)). Anthropic's research system adds a dedicated CitationAgent after synthesis for the same reason ([Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)).

### User management becomes households, roles and delegated tokens

Today each user is an isolated tenant:

- JWT in an HttpOnly cookie, with `token_version` revocation.
- PBKDF2 password hashing.
- Foreign IDs return 404 through `backend/app/api/deps.py`.
- No households, roles or delegation on the `User` model in `backend/app/models.py`.

The proposed model makes a household the tenant. Members hold one of four roles: owner, partner, dependent (read-only or allowance) and external advisor (time-boxed, scoped read). Attribute conditions (account ownership, consent purpose, expiry) control access to individual rows, and every grant is recorded in a consent ledger.

Each specialist agent gets a **down-scoped, short-lived token** derived from the acting user's grant, never the session cookie. This follows the MCP authorization rules: servers must validate that a token was issued for them and must not pass tokens through to upstream APIs ([MCP spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)). Payments, sharing changes and advisor grants require step-up re-authentication.

Every tool call is logged with user, agent, scope and hashes of its inputs and outputs. Those logs map onto RBI FREE-AI and SEBI's proposed auditability and record-keeping principles ([RBI](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=61018); [Taxmann](https://www.taxmann.com/post/blog/sebi-proposes-ai-ml-governance-framework-for-securities-markets)) and onto the OWASP Agentic Top 10's identity, privilege-abuse and inter-agent-communication risks ([OWASP](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026)). Financial profile facts (income band, risk appetite, obligations) should be stored as typed, user-editable records tagged with their source, not as free-text memory, to limit memory poisoning (OWASP ASI06).

### Integrations follow the licence boundary

An unregulated app cannot be an AA FIU. The realistic order is:

1. **Statement, CSV and CAS PDF parsing.** CAS PDFs cover mutual fund and demat holdings without a licence and fit the existing import pipeline ([CASParser](https://casparser.in/blog/state-of-account-aggregator-2026/), vendor source).
2. **An AA prototype in a technology-service-provider sandbox** against mock FIPs ([Setu go-live](https://docs.setu.co/data/account-aggregator/licenses-and-go-live/go-live)).
3. **Production AA access through a regulated partner FIU.**

Outward-facing MCP servers, for example exposing FinSight data to Claude or ChatGPT as Monarch now does, are cheap to add once the typed tool layer exists. A2A and AP2 matter only once FinSight acts with external agents ([Linux Foundation](https://linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)).

### Build evaluation first, then agents

| Phase | Build | Ablation arm it enables | Metrics that must move |
|---|---|---|---|
| **0. Evaluation infrastructure** | Synthetic India household ledger generator; 300+ cases with independently computed gold; LLM-judge jury calibrated on about 50 human-labelled cases; pass^k (k=4); cost and latency logging; bootstrap CIs; MAST labelling; fix rubric biases in `research.py` | Re-scores existing A0 (no context), A1 (deterministic only), A2 (current grounded prompt) | Judge–human κ ≥ 0.7; CI width |
| **1. Tools + verifier (single agent)** | Typed tool layer over `finance.py`/`ledger.py`; numeric-faithfulness verifier with abstention | A3 single agent + tools; A4 = A3 + verifier | NFR, exact accuracy, abstention precision, pass^k |
| **2. Specialists behind the router** | Hybrid router; specialist prompts and tool subsets; orchestrator-workers for compound questions only | A5 router + specialists + verifier; A6 orchestrator-workers + verifier; A7 = A6 without verifier | Accuracy on compound questions vs tokens and latency; MAST distribution |
| **3. Households and consent** | Household tenant, roles, consent ledger, scoped agent tokens, audit log | Same arms on adversarial household cases | Cross-member leak rate; AgentLeak-style inter-agent leakage; audit completeness |
| **4. Integrations and categorization** | CAS and statement parsers; VPA normalization; AA sandbox | Ingestion experiments | Categorization top-1; import error rate |
| **5. Retrieval, safety, actions, nudges** | Embedding retriever; CaMeL-style guard; confirm-then-act; nudge outcome tracking | Safety and outcome studies | Recall@K/nDCG; attack success rate; dismiss rate; goal-attainment change |

### Where FinSight can plausibly win, and where it will not

FinSight will not top FinanceBench or the Vals Finance Agent leaderboard. Those benchmarks test SEC-filing analysis with web and EDGAR tools, and FinSight's engine is not built for that. Reporting them is useful only as a sanity check on the narration model.

FinSight's credible wins are on its own task family, measured against strong baselines:

- **Exact numbers.** On per-user exact-number questions, routing to the Decimal engine should beat an LLM given raw transactions by a wide margin. The relevant comparison points are FinanceBench's 81% wrong-or-refused rate and FinanceQA's sub-50% exact match for LLMs working alone.
- **Consistency.** Deterministic numbers should drive pass^k for figures toward 1.0. GPT-5.2's advice varied by about $3,220 across identical queries ([arXiv 2608.01607](https://arxiv.org/html/2608.01607v1)).
- **Assumptions.** Explicit `missing_data` and `ambiguous` handling should beat the 2.2–4.3% assumption-surfacing rate measured on FinanceQA ([arXiv 2501.18062](https://arxiv.org/pdf/2501.18062)).
- **Prompt injection.** Because the regex router is a trusted control-flow extractor, FinSight can target low attack success with little loss of utility. CaMeL reported **77% of AgentDojo tasks solved with provable security, against 84% undefended** ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)).
- **Cost.** A grounded 7–8B narrator could hold accuracy at a fraction of frontier cost. A fine-tuned 8B personal-finance model came close to 27–32B models at **$0.96 versus $5.63 per 504 queries** ([arXiv 2509.14180](https://arxiv.org/pdf/2509.14180)).

## The paper's contribution is the verified-ledger benchmark plus an honest multi-agent ablation

### Five gaps the notes support

1. **No private-ledger benchmark.** The researchers found no agent benchmark that evaluates personal-finance assistants over a private, per-user ledger with verifiable gold numbers. Finance-agent benchmarks are institutional or investing-focused ([InvestorBench](https://aclanthology.org/2025.acl-long.126); [Finance Agent Benchmark](https://alphaxiv.org/abs/2508.00828)), and no peer-reviewed study evaluates an LLM over a user's actual transaction ledger. This rests on a limited search, so the paper should say "to our knowledge".
2. **MAST has never been applied to finance.** It was built on coding, math and general frameworks ([arXiv 2503.13657](https://arxiv.org/html/2503.13657v3)). The 2026 call for "coordination primacy" and cost-aware evaluation of financial multi-agent systems ([arXiv 2603.27539](https://arxiv.org/html/2603.27539v1)) and the Alpha Illusion's "multi-agent disaggregation" protocol ([arXiv 2605.16895](https://arxiv.org/abs/2605.16895)) have not been carried over to personal finance.
3. **No consent- or household-aware evaluation exists.** CaMeL's results come from general AgentDojo tasks, not shared household ledgers ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)). AgentLeak warns that inter-agent channels leak ([arXiv 2602.11510](https://arxiv.org/html/2602.11510v1)).
4. **No Indian retail benchmark exists.** INR budgeting, tax-regime comparison, UPI narrations, SIPs and Hinglish are all uncovered. IndiaFinBench covers regulation only ([arXiv 2604.19298](https://arxiv.org/abs/2604.19298)).
5. **No numeric-faithfulness metric for conversational finance has been standardized.** VeNRA verifies against corporate documents ([arXiv 2603.04663](https://arxiv.org/html/2603.04663v1)), and PHANTOM detects hallucinations but does not trace numbers to tool outputs ([NeurIPS 2025](https://neurips.cc/virtual/2025/poster/121830)).

Longitudinal outcomes of proactive nudges are a sixth gap, but they need a user study with ethics approval. They belong in a follow-up paper.

### Proposed paper outline

| Element | Proposal |
|---|---|
| **Title ideas** | "Do Personal Finance Assistants Need Many Agents? A Verified-Ledger Benchmark and Ablation"; "LedgerBench-IN: Evaluating Grounded Multi-Agent Assistants on Private Household Finances"; "Numbers You Can Trace: Numeric Faithfulness for Conversational Personal Finance Agents" |
| **RQ1** | On per-user ledger questions, how much do typed deterministic tools and a numeric-faithfulness verifier improve accuracy, faithfulness and pass^k over LLM-only and raw-context baselines? |
| **RQ2** | Holding tools and verifier fixed, does routing to specialists, or orchestrator-workers, improve accuracy on single-intent and compound questions, and at what token, latency and failure-mode cost (MAST)? |
| **RQ3** | Do role-scoped agent tokens and separating control flow from data flow reduce cross-member leakage and injection success without losing utility? |
| **RQ4** | How well do LLM judges agree with humans on personal-finance answers, and how does the lexical rubric-v1 diverge from them? |
| **Contributions** | (C1) An open India-context synthetic household-ledger benchmark with independently computed gold, difficulty tiers (lookup / multi-step / compound / abstain), and adversarial household and injection splits. (C2) The NFR metric and a deterministic verifier. (C3) A disaggregated ablation of single-agent, routed and orchestrated designs with MAST-labelled failures and cost reporting. (C4) A household consent model with scoped agent tokens, evaluated for leakage. (C5) An open-source reference system (FinSight_AI) with run provenance already built in. |
| **Method** | Generate seeded synthetic households (salary, rent, EMIs, UPI P2M/P2P narrations, SIPs, bills, irregular income). Compute gold with a second, independent implementation (pandas/SQL reference plus hand-checked samples), not `finance.py`, to avoid circular grading. Run arms A0–A7 across at least two model families (one frontier, one open 7–8B) at k=4. Grade with a calibrated three-model jury plus deterministic numeric checks. |
| **Experiments** | E1 main ablation; E2 compound-question scaling (2, 3 and 4 sub-questions); E3 household leakage and injection (AgentDojo-style, attacks embedded in uploaded statements and KB text); E4 judge validity (about 100 human-labelled items; κ); E5 external sanity checks (FinanceBench-150, IndiaFinBench, literacy set, public Vals 27); E6 categorization on synthetic and opt-in real data. |
| **Metrics** | Exact-match accuracy; NFR and unsupported-number rate; abstention precision and recall (correct / incorrect / refused); pass^k; jury rubric score with dealbreakers; Recall@K / nDCG; attack success rate and utility under attack; leak rate; tokens, cost and p50/p95 latency per correct answer; MAST mode distribution; judge–human κ. |
| **Threats to validity** | Synthetic data may not match real ledgers (mitigate with opt-in anonymized real samples and a realism audit). Circular gold if the engine grades itself. Judge bias and self-preference when judge and system share a model family. Small n (report bootstrap CIs and pre-register hypotheses). Model and version drift (pin versions; `research.py` already stores provider, model, prompt and rubric versions). India-specific results may not transfer. Regex router overfitting to the benchmark's phrasing (hold out paraphrased and Hinglish queries). Regulatory scope: personalized investment advice may require SEBI registration, so the system must stay in descriptive and educational territory. |
| **Target venues** | ACM ICAIF (finance AI; [ICAIF 2025 example](https://dl.acm.org/doi/10.1145/3768292.3770387)); the ACL FinNLP workshop ([FinNLP 2025](https://aclanthology.org/2025.finnlp-2.15.pdf)); NeurIPS Datasets & Benchmarks for the benchmark itself, which is where FinBen and PHANTOM appeared ([PHANTOM](https://neurips.cc/virtual/2025/poster/121830)); EMNLP or ACL Findings for the ablation ([EMNLP 2025 Findings survey](https://aclanthology.org/2025.findings-emnlp.972/)). A later user study on nudges and trust fits an HCI venue. |

The honest framing should be stated in the abstract. The likely result is that tools and the verifier deliver most of the gain, routing adds modest specialization benefits, and orchestrator-workers help only on compound questions at several times the cost. Several observations point that way: MAST's "often minimal" gains, the roughly 20% debate win rate ([arXiv 2605.16895](https://arxiv.org/abs/2605.16895)), and Anthropic's finding that **token usage alone explained 80% of performance variance** on BrowseComp ([Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)). A paper that reports this cleanly, with a disaggregated ablation, is more publishable than one claiming multi-agent superiority, and much harder to dismiss.

## Conclusion

FinSight_AI's main asset is a deterministic Decimal engine with evidence-carrying answers and a provenance-logging lab, not the number of bots it could add. That same split between a deterministic engine and an LLM front end appears in the best-run bank assistant and in the strongest critique of finance agents. The work that turns this into a paper is mostly evaluation work:

- an independent-gold household benchmark;
- a numeric-faithfulness verifier promoted from the helper functions already in `research.py`;
- calibrated judges with pass^k;
- an ablation that credits each component, including the router and specialists, only with the gain it actually produces.

User management and integrations matter to the paper because they create new, measurable risks: leakage across household members and agents, and injection through imported statements. The AA licence boundary means the first integrations should be statements and CAS PDFs, with AA used in sandbox only. The most useful single result would be a cost-accuracy frontier showing that a small, verified, routed system matches frontier LLMs on private-ledger questions at a fraction of the cost. That would be useful to anyone building consumer finance assistants, whether or not multi-agent turns out to help.
