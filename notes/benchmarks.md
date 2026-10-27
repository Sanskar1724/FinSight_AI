# Benchmarks and Evaluation Metrics for Finance LLMs and LLM Agents (as of 27 Oct 2026)

Context: FinSight_AI currently runs a self-built 28-case "Research lab" (baseline vs grounded answers, lexical 5-dimension rubric: factual correctness, relevance, grounding, claim safety, usefulness). These notes catalogue public benchmarks it could report on and where a new benchmark is needed.

Verification note: items marked [V] were fetched and verified in this session (Oct 2026). Items marked [P] are cited from the primary paper/arXiv ID as known to the researcher but were not re-fetched this session; the report writer should treat [P] numbers as "per the original paper" and avoid presenting them as current SOTA.

## 1. Numerical / document QA benchmarks (FinQA, ConvFinQA, TAT-QA, DocFinQA, FinanceBench, BizBench, FinanceQA, FinTextQA, SEC-QA, FinDER, etc.)

### Takeaway
The classic numerical-QA sets (FinQA, ConvFinQA, TAT-QA) are mostly solved by frontier models and are now used for regression checks, not to tell models apart. The open problems are long-document and analyst-style QA: FinanceBench, DocFinQA, FinanceQA, SECQUE and SEC-QA. All of these are about US corporate filings. None covers retail or personal finance.

### Cited Findings
- **FinQA** [P]: 8,281 QA pairs over S&P 500 earnings reports. Each question needs numerical reasoning over a table plus text and has an annotated reasoning program. Metrics are execution accuracy and program accuracy. In the paper, human experts scored about 91% execution accuracy and the best model at the time scored about 61%. — [arXiv:2109.00122](https://arxiv.org/abs/2109.00122); a 2026 secondary review of FinQA's use today is at [Beancount Bean Labs, May 2026](https://beancount.io/bean-labs/research-logs/2026/05/13/finqa-numerical-reasoning-financial-data)
- **ConvFinQA** [P]: a conversational, multi-turn extension of FinQA with 3,892 conversations and 14,115 questions. The metric is execution accuracy. Human experts scored about 89%. — [arXiv:2210.03849](https://arxiv.org/abs/2210.03849). A May 2026 secondary write-up frames it as a "21-point gap between models and human experts" (this figure comes from the original paper's era, not current frontier models). — [Beancount, 15 May 2026](https://beancount.io/bean-labs/research-logs/2026/05/15/convfinqa-chain-numerical-reasoning-conversational-finance-qa). An aggregator leaderboard exists. — [benchmarklist.com ConvFinQA](https://benchmarklist.com/benchmarks/convfinqa/)
- **TAT-QA** [P]: 16,552 questions over 2,757 hybrid table-plus-text contexts from financial reports. Metrics are Exact Match and numeracy-aware F1. — [arXiv:2105.07624](https://arxiv.org/abs/2105.07624)
- **DocFinQA** [P]: a long-context version of FinQA with 7,437 questions. Each question comes with the full SEC filing, averaging about 123k words. The metric is accuracy. Long context sharply degrades performance even for strong models. — [arXiv:2401.06915](https://arxiv.org/html/2401.06915v3)
- **FinanceBench** (Patronus AI) [P/V]: 10,231 questions about publicly traded companies, answerable from 10-K, 10-Q, 8-K and earnings documents. Only 150 annotated cases are open-source. Answers are graded correct, incorrect or refused by human review. In the original study, GPT-4-Turbo with a shared vector store answered incorrectly or refused 81% of questions. — [arXiv:2311.11944](https://arxiv.org/pdf/2311.11944); [GitHub patronus-ai/financebench](https://github.com/patronus-ai/financebench)
- **FinanceQA** (AfterQuery) [V]: tests analyst-style numerical analysis: hand-spreading metrics, applying accounting and valuation conventions, and multi-step tasks that require the model to generate its own assumptions. The paper reports that current LLMs fail about 60% of the realistic tasks. The dataset is on Hugging Face as AfterQuery/FinanceQA. The abstract page does not give the dataset size. — [arXiv:2501.18062](https://arxiv.org/abs/2501.18062); [GitHub](https://github.com/AfterQuery/FinanceQA)
- **SEC-QA** [V]: built over 1,315 SEC filings plus a tabular database, and generates questions systematically so the set stays fresh. The metric is Exact Match. Multi-document QA reached up to 80% EM with a program-of-thought or agentic method, against 30–55% for generic RAG. — [arXiv:2406.14394](https://arxiv.org/html/2406.14394v1); [ACL FinNLP 2025](https://aclanthology.org/2025.finnlp-2.15.pdf); summarized at [EmergentMind](https://www.emergentmind.com/topics/corporate-filing-qa-benchmarks)
- **SECQUE** [V]: 565 expert questions over 45 US filings from 29 companies. The metric is strict accuracy. The top system scored 0.69 on Analyst Insights. Its LLM judge (SECQUE-Judge) agreed with human raters at F1 0.85. — [arXiv:2504.04596](https://arxiv.org/abs/2504.04596) via [EmergentMind](https://www.emergentmind.com/topics/corporate-filing-qa-benchmarks)
- **FinAgentBench** [V]: agentic retrieval over 10-K and 10-Q filings, scored with nDCG@10 and MRR@10. — [arXiv:2601.06992](https://arxiv.org/abs/2601.06992) via [EmergentMind](https://www.emergentmind.com/topics/corporate-filing-qa-benchmarks)
- **Retrieval and RAG over sustainability/ESG reports** [V]: Climate Finance Bench has 330 QA pairs over 33 reports and scores Recall@K, nDCG and answer correctness. Accuracy is about 70% on numerical questions and about 50% on logical-reasoning questions, and hybrid retrieval plus reranking adds up to 7 points. ESGBench is [arXiv:2511.16438](https://arxiv.org/abs/2511.16438). SustainableQA has 195k QA pairs and is [arXiv:2508.03000](https://arxiv.org/abs/2508.03000). — [arXiv:2505.22752](https://arxiv.org/abs/2505.22752) via [EmergentMind](https://www.emergentmind.com/topics/corporate-filing-qa-benchmarks)
- **BizBench** [P]: a quantitative-reasoning benchmark for business and finance covering program synthesis, extraction and financial-knowledge tasks. — [arXiv:2311.06602](https://arxiv.org/abs/2311.06602)
- **FinTextQA** [P]: long-form financial QA drawn from finance textbooks and government or regulatory sites, with a modular RAG evaluation. — [arXiv:2405.09980](https://arxiv.org/abs/2405.09980)
- **FinDER** [P]: a financial-dataset benchmark for RAG retrieval, using realistic and ambiguous analyst-style search queries over 10-K filings. — [arXiv:2504.15800](https://arxiv.org/abs/2504.15800)
- **XFinBench** [V]: complex financial problem solving and reasoning, including multimodal and graduate-level problems. — [arXiv:2508.15861](https://arxiv.org/html/2508.15861v1)
- **Practitioner critique** [V]: FP&A and finance benchmarks test lookup and calculation over filings. They miss workflow-level judgement. — [bprigent.com](https://www.bprigent.com/article/fpna-ai-benchmarks)

### Inferences
- FinSight_AI's "grounding" and "factual correctness" dimensions line up most closely with FinanceBench (open 150 subset), DocFinQA and FinQA/TAT-QA. Running the FinanceBench-150 open set, scored correct/incorrect/refusal, is the cheapest credible public number it could report.
- None of these sets include personal-finance artifacts such as bank statements, payslips, tax forms, UPI transaction logs or budgets. FinSight_AI's own cases would therefore need a new set.

### Gaps
- I did not verify current (2026) SOTA numbers for FinQA, ConvFinQA, TAT-QA, DocFinQA, FinanceBench or BizBench this session. Papers with Code leaderboards are no longer reliably maintained, and the aggregators I found have mixed provenance.
- I did not fetch FinanceQA's dataset size or exact top score; the abstract does not state them.

## 2. Suites: FinBen/PIXIU, FLUE, FinEval, CFLUE, FinanceIQ, BizFinBench, Golden Touchstone, FinMTEB, FinSearchComp, XFinBench

### Takeaway
Broad suites are mostly collections of classification, extraction and QA datasets, and many are Chinese-language: FinEval, CFLUE, FinanceIQ, BizFinBench, FinGAIA. Of the newer suites, FinSearchComp (search agents) and BizFinBench.v2 (real user queries) come closest to FinSight_AI's use case.

### Cited Findings
- **FinSearchComp** [V]: 635 expert-curated questions covering global and Greater China markets, in English and Chinese, built with about 70 financial experts. It has three task types: T1 time-sensitive data fetching, T2 simple historical lookup, and T3 complex historical investigation. Answers are scored 0 or 1 by an LLM judge with expert rubrics and numerical tolerance, and the judge agreed with humans about 95% of the time. On the Global subset, the best entry was Grok 4 (web) at 68.9%, against a human expert baseline of 75.0%. On the Greater China subset, human experts scored 88.3% and models trailed them by more than 34 points. The paper is from September 2025. — [arXiv:2509.13160](https://arxiv.org/html/2509.13160v1)
- **BizFinBench** [P/V]: a business-driven, real-world financial benchmark in Chinese (May 2025). BizFinBench.v2 (January 2026) adds real-user data and offline/online bilingual evaluation. — [arXiv:2505.19457](https://arxiv.org/abs/2505.19457); [arXiv:2601.06401](https://arxiv.org/html/2601.06401v2)
- **FinBen** (PIXIU successor) [P]: 36 datasets across 24 tasks and 7 aspects: information extraction, text analysis, QA, text generation, risk management, forecasting and decision-making. Published at NeurIPS 2024 Datasets and Benchmarks. — [arXiv:2402.12659](https://arxiv.org/abs/2402.12659); PIXIU/FLARE is [arXiv:2306.05443](https://arxiv.org/abs/2306.05443); a 2026 secondary review is at [Beancount, Apr 2026](https://beancount.io/bean-labs/research-logs/2026/04/15/finben-financial-llm-benchmark)
- **FLUE** [P]: Financial Language Understanding Evaluation, five tasks: sentiment (FPB), headline classification, NER, structure boundary detection and QA (FiQA). — [arXiv:2211.00083](https://arxiv.org/abs/2211.00083)
- **FinEval** [P]: Chinese financial-knowledge multiple-choice questions plus later agent and safety tracks. — [arXiv:2308.09975](https://arxiv.org/abs/2308.09975)
- **CFLUE** [P]: a Chinese financial language understanding suite with exam-based knowledge MCQs and application tasks. — [arXiv:2405.10542](https://arxiv.org/abs/2405.10542)
- **Golden Touchstone** [P]: a bilingual English/Chinese financial benchmark. — [arXiv:2411.06272](https://arxiv.org/abs/2411.06272)
- **FinMTEB** [P]: a finance extension of MTEB for embeddings, covering retrieval, classification, clustering and STS in English and Chinese. It is relevant to choosing FinSight_AI's retriever. — [arXiv:2502.10990](https://arxiv.org/abs/2502.10990)
- **FinanceIQ** [P]: a Chinese financial-certification exam set (Du Xiaoman). I did not confirm a primary URL this session.
- **CFA-based evaluations** [V]: — [arXiv:2509.04468](https://arxiv.org/html/2509.04468v1); a 2026 "evaluation and benchmarking suite for financial LLMs" is [arXiv:2602.19073](https://arxiv.org/pdf/2602.19073)

### Inferences
- For FinSight_AI, an English-speaking retail assistant, the suites are useful mainly as capability sanity checks: FinBen QA and sentiment subsets, and FinMTEB for retrieval. FinSearchComp's T1/T2/T3 split is a good template for "fresh data vs historical lookup vs multi-step analysis" in its own benchmark.

### Gaps
- I did not verify current top scores for FinBen, FLUE, FinEval, CFLUE, FinanceIQ, Golden Touchstone, FinMTEB or BizFinBench.

## 3. Agent benchmarks (Vals Finance Agent, FinGAIA, tau/tau2-bench, BFCL, AppWorld, WebArena, AgentBench, InvestorBench, FinRL, banking/personal finance)

### Takeaway
The Vals AI Finance Agent Benchmark v2.1 is the most current, independently run finance-agent leaderboard. On 26 Oct 2026 its leaders were bunched around 67–68%, and it reports cost and latency per test. tau2-bench gives the closest analogue to a customer-facing banking agent (dual-control, pass^k), but it has no banking domain, and its telecom scores are now near ceiling. I found no public agent benchmark for personal-finance or retail-banking assistants.

### Cited Findings
- **Vals AI Finance Agent v2.1** [V]: tests entry-level financial-analyst work on public filings.
  - Splits: a private Test set of 449 questions (all reported results use it), a public set of 27 and a private validation set of 450.
  - Workflows: nine — qualitative, quantitative, market analysis, comparables, precedents, adjustments, earnings, disclosure analysis and financial modeling.
  - Tools: six — SEC EDGAR search, web search, HTML parse, retrieval, calculator and price history.
  - Scoring: the primary metric is severity-weighted Partial Credit, gated by "dealbreaker" facts (a missed dealbreaker scores 0). The secondary metric is All-Pass. A three-model LLM jury grades the answers. Each task has a two-hour limit.
  - Leaders as of 26 Oct 2026:

    | Model | Score | Cost per test | Time per test |
    |---|---|---|---|
    | Claude Opus 5.5 | 67.85% | $8.91 | 33m |
    | Gemini 4 Argon | 67.66% | $4.32 | 13m |
    | Wonder Full | 67.58% | $2.68 | 14m |
    | Claude Sonnet 5.5 | 67.28% | $6.95 | 34m |

  - Cost across all entries ranges from about $0.06 to $8.91 per test.
  - Source: [Vals AI fabv2-1](https://www.vals.ai/benchmarks/fabv2-1). Earlier versions: [v1](https://www.vals.ai/benchmarks/finance_agent_v1), [v1.1](https://www.vals.ai/benchmarks/finance_agent), [v2](https://www.vals.ai/benchmarks/fabv2). A secondary aggregator lists Gemini 4 Argon at 65.4% on v2 — [benchlm.ai](https://benchlm.ai/benchmarks/financeagentv2)
- **FinGAIA** [V]: 407 expert-validated tasks in Chinese across 7 sub-domains: securities, funds, banking, insurance, futures, trusts and asset management. Tasks span 3 levels and 8 scenarios: Basic Business Analysis (89 tasks), Asset Decision Support (185) and Strategic Risk Management (133). The metric is zero-shot accuracy, reported as a weighted average. The best agent was ChatGPT DeepResearch at 48.9%, against financial experts at 84.7. Paper from July 2025. — [arXiv:2507.17186](https://arxiv.org/html/2507.17186v2)
- **tau2-bench** [V]: three domains: retail (115 tasks), airline (50) and telecom (114, sampled from 2,285 generated tasks). Telecom is "dual-control": both the agent and a simulated user act on a shared state, modeled as a Dec-POMDP. pass^k is the probability that all k independent trials of a task succeed; tasks were run 4 times at temperature 0.
  - Telecom pass^1 in the paper (June 2025): claude-3.7-sonnet 49%, o4-mini 42%, gpt-4.1 34%. gpt-4.1 scored 74% on retail and 56% on airline.
  - Dual-control lowered pass^1 by about 18–25% versus the no-user setting.
  - The user simulator itself erred 16% of the time in telecom (6% critical) and 40% in retail (12% critical).
  - Source: [arXiv:2506.07982](https://arxiv.org/pdf/2506.07982)
- **tau2-bench secondary leaderboards** [V]: by Oct 2026, mostly Artificial Analysis telecom runs show near-ceiling scores: GLM-5.2 99.1%, GPT-5.4 98.9% (telecom), Claude Fable 5 98.5%. The aggregator warns that none of its 167 rows come from the benchmark owner or an independent run, and that setups (user model, domain, repeats) differ, so rows are not comparable. — [benchlm.ai tau2-bench, 26 Oct 2026](https://benchlm.ai/benchmarks/tau2-bench); submission rules are at [sierra-research/tau2-bench](https://github.com/sierra-research/tau2-bench/blob/main/docs/leaderboard-submission.md); the original tau-bench is [arXiv:2406.12045](https://arxiv.org/abs/2406.12045)
- **BFCL** (Berkeley Function Calling Leaderboard) [P]: measures function-calling accuracy using AST and executable checks, plus multi-turn and irrelevance or abstention detection. — [gorilla.cs.berkeley.edu/leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)
- **AppWorld** [P]: 750 tasks across 9 simulated day-to-day apps, including payment and banking-like apps such as Venmo, with state-based unit tests. — [arXiv:2407.18901](https://arxiv.org/abs/2407.18901)
- **WebArena** [P]: 812 web tasks on self-hosted sites. — [arXiv:2307.13854](https://arxiv.org/abs/2307.13854)
- **AgentBench** [P]: 8 environments. — [arXiv:2308.03688](https://arxiv.org/abs/2308.03688)
- **InvestorBench** [P]: trading and investment decision tasks for stocks, crypto and ETFs. — [arXiv:2412.18174](https://arxiv.org/abs/2412.18174)
- **Personalized investment logic benchmark** [V]: a "real-world benchmark towards personalized financial agents" (2026). — [arXiv:2608.06108](https://arxiv.org/html/2608.06108)
- **Banking77** [P]: 13,083 customer-service banking queries labeled with 77 intents. It is intent classification, not agentic. — [arXiv:2003.04807](https://arxiv.org/abs/2003.04807)
- **Financial literacy tests applied to LLMs** [V]: "Can AI Help with Your Personal Finances?" tested 10 models on 554 questions from MoneyCounts (Penn State) and the NFEC test suite. Topics included budgeting, credit cards, mortgages, student loans, taxes and investing. Scoring was binary zero-shot accuracy.
  - Results: Claude 3.5 Sonnet 79.78%, GPT-4 78.34%, GPT-4o 74.91%, Llama 3 8B 53.43%; the mean was about 68%.
  - Models were weakest on credit-card and banking questions.
  - Answers were consistent across 10 repeats.
  - Paper v3 dated January 2025.
  - Source: [arXiv:2412.19784](https://arxiv.org/html/2412.19784v3)
- **"Can LLMs be Good Financial Advisors?"** [V]: an early study of LLMs in personal financial decision-making. — [arXiv:2307.07422](https://arxiv.org/abs/2307.07422)

### Inferences
- FinSight_AI could report two numbers now: (a) a Vals-style analyst-QA number using the public 27-question Finance Agent set, and (b) financial-literacy accuracy on MoneyCounts/NFEC-style questions (and the FINRA/"Big Three" literacy items, see Gaps).
- For a multi-agent assistant, a tau2-style banking domain would be the most valuable new benchmark: a simulated user plus shared state (accounts, budgets, payment mandates), scored by pass^k. Examples: dispute a UPI transaction, set up a SIP, reconcile a budget.

### Gaps
- I found no public banking or personal-finance domain for tau-bench or tau2-bench. I did not verify whether newer tau-family domains (for example tau3) added banking.
- I found no sourced study applying the "Big Three" financial-literacy questions or the FINRA NFCS quiz to LLMs. This should be checked or treated as unexplored.
- FinRL contests: I did not verify the 2025/2026 contest tasks or metrics this session.
- I did not verify current BFCL, AppWorld, WebArena or AgentBench top scores.

## 4. Safety, compliance and trust (hallucination, suitability, bias, prompt injection, privacy)

### Takeaway
Finance-specific hallucination-detection benchmarks now exist: PHANTOM (NeurIPS 2025) and K-FinHallu (Korean multi-turn RAG, EMNLP Findings 2026). Agent-security benchmarks (AgentDojo, InjecAgent) include banking-like environments. I found no benchmark for advice suitability, Know Your Customer (KYC) and risk-profiling, or fairness in lending advice.

### Cited Findings
- **PHANTOM** [V]: hallucination detection in long-context financial QA. It uses human-validated query–answer–document-chunk triplets labeled as hallucinated or correct, expanded to vary context length and where the evidence sits. Off-the-shelf models struggle to detect real-world hallucinations, and fine-tuning helps. Published at NeurIPS 2025. — [NeurIPS 2025 poster](https://neurips.cc/virtual/2025/poster/121830); [mlanthology](https://mlanthology.org/neurips/2025/ji2025neurips-phantom/)
- **K-FinHallu** [V]: a hallucination-detection benchmark for multi-turn RAG in Korean finance (May 2026; EMNLP 2026 Findings). — [arXiv:2605.29523](https://arxiv.org/abs/2605.29523); [ACL Anthology](https://aclanthology.org/2026.findings-emnlp.2053/)
- **FinTruthQA** [V]: rates the information quality of Chinese stock-exchange investor Q&A, scored with quadratic weighted kappa. — [arXiv:2406.12009](https://arxiv.org/abs/2406.12009) via [EmergentMind](https://www.emergentmind.com/topics/corporate-filing-qa-benchmarks)
- **AgentDojo** [P]: 97 realistic tasks and 629 security test cases for prompt injection against tool-using agents, with a banking suite among workspace, Slack and travel. It reports utility under attack and attack success rate. — [arXiv:2406.13352](https://arxiv.org/abs/2406.13352)
- **InjecAgent** [P]: 1,054 test cases of indirect prompt injection in tool-integrated agents, covering both direct-harm attacks (some financial, such as unauthorized transfers) and data-stealing attacks. — [arXiv:2403.02691](https://arxiv.org/abs/2403.02691)

### Inferences
- FinSight_AI's "claim safety" dimension could be anchored to PHANTOM-style hallucination detection, scored as a precision/recall classifier rather than lexically. Its banking-agent tools should be red-teamed with the AgentDojo banking suite.

### Gaps
- I found no benchmark this session for advice suitability (for example, regulation-aligned "is this advice appropriate for this user profile" tests), for bias or fairness in lending or credit advice, or for privacy leakage of PII in financial agents. A dedicated search is needed; otherwise these are likely open gaps for a new benchmark.
- A benchmark named "FinHallu" in English was not found. The closest are K-FinHallu and PHANTOM.

## 5. Evaluation methods (LLM-as-judge, RAG metrics, calibration/abstention, cost/latency, pass^k, human expert protocols)

### Takeaway
Current finance benchmarks have moved to rubric-based LLM judges checked against humans:
- Vals uses a 3-model jury with dealbreaker gating.
- FinSearchComp's judge agrees with humans about 95% of the time.
- SECQUE-Judge reaches F1 0.85 agreement.

They also report cost and latency next to accuracy, and use pass^k for reliability. FinSight_AI's lexical rubric is out of step with all of these practices.

### Cited Findings
- Rubric LLM-judge plus jury: Vals Finance Agent v2.1 uses severity-weighted rubric checks, "dealbreaker" gating and a 3-LLM jury, and reports cost per test and time per test. — [Vals AI](https://www.vals.ai/benchmarks/fabv2-1)
- Judge reliability: the FinSearchComp LLM judge with expert rubrics and numeric tolerance agreed with human labels about 95% of the time on a sample. — [arXiv:2509.13160](https://arxiv.org/html/2509.13160v1). SECQUE-Judge F1 agreement with humans is 0.85. — [arXiv:2504.04596](https://arxiv.org/abs/2504.04596)
- pass^k: success on all k trials; reported at k=1..4 in tau2-bench. — [arXiv:2506.07982](https://arxiv.org/pdf/2506.07982)
- Abstention or refusal as a separate outcome: FinanceBench grades answers as correct, incorrect or refused. — [arXiv:2311.11944](https://arxiv.org/pdf/2311.11944)
- Repeat-consistency: re-asking each question 10 times gave nearly identical accuracy in the personal-finance literacy study. — [arXiv:2412.19784](https://arxiv.org/html/2412.19784v3)
- RAGAS [P]: reference-free RAG metrics — faithfulness, answer relevance and context relevance/precision. — [arXiv:2309.15217](https://arxiv.org/abs/2309.15217)
- Retrieval metrics (Recall@K, nDCG@10, MRR@10) are used by Climate Finance Bench and FinAgentBench. — [EmergentMind](https://www.emergentmind.com/topics/corporate-filing-qa-benchmarks)
- Human expert baselines are reported in FinSearchComp (75.0 and 88.3), FinGAIA (84.7) and IndiaFinBench (a non-specialist human at 69.0%). — [arXiv:2509.13160](https://arxiv.org/html/2509.13160v1); [arXiv:2507.17186](https://arxiv.org/html/2507.17186v2); [arXiv:2604.19298](https://arxiv.org/abs/2604.19298)

### Inferences
- Recommended upgrades for the FinSight_AI lab:
  - Replace lexical scoring with a rubric LLM-judge, ideally a jury, with dealbreaker facts.
  - Calibrate the judge on about 50 human-labeled cases and report agreement (kappa or F1).
  - Add RAGAS faithfulness and context precision to the grounding dimension.
  - Count refusals or abstentions separately.
  - Run each case k=4 times and report pass^k.
  - Log cost and latency per case.
- 28 cases is too few for statistically meaningful baseline-vs-grounded comparisons. Bootstrap confidence intervals should be reported.

### Gaps
- I did not fetch evidence on calibration metrics for finance LLMs (ECE, selective accuracy or risk-coverage curves); no finance-specific calibration benchmark was found.
- I did not gather systematic studies of LLM-judge bias in finance (position or verbosity bias) this session.

## 6. Indian context (INR, Indian tax, UPI) and Indian-language finance benchmarks

### Takeaway
IndiaFinBench (April 2026) is the only verified public benchmark grounded in Indian regulation (SEBI and RBI). An "IndFin-Bench" built on Indian filings has been announced on Substack. I found no public benchmark on Indian personal tax (ITR, 80C, new vs old regime), UPI disputes or INR household budgeting, and no verified Hindi or Indic finance QA benchmark.

### Cited Findings
- **IndiaFinBench** [V]: 406 expert-annotated QA pairs from 192 SEBI and RBI documents. Tasks: regulatory interpretation (174), numerical reasoning (92), temporal reasoning (78) and contradiction detection (62). Zero-shot accuracy across 12 models: best Gemini 2.5 Flash 89.7%, lowest Gemma 4 E4B 70.4%, non-specialist human 69.0%. Submitted 21 April 2026; v2 dated 2 May 2026. — [arXiv:2604.19298](https://arxiv.org/abs/2604.19298)
- **IndFin-Bench**: announced as a benchmark grounded in Indian financial filings. This is a Substack blog post, not peer-reviewed, and I did not read its details. — [cofacto Substack](https://cofacto.substack.com/p/introducing-indfin-bench-a-pioneering)
- **BharatGen FinanceParam**: an Indian finance-domain model whose model card may report Indic finance evaluations. I did not read it this session. — [Hugging Face bharatgenai/FinanceParam](https://huggingface.co/bharatgenai/FinanceParam/blob/main/README.md)
- arXiv:2602.05794 (February 2026) appeared in a search for Indian or Hindi finance benchmarks, but the fetch was rate-limited and its content is unverified. — [arXiv:2602.05794](https://arxiv.org/pdf/2602.05794)

### Inferences
- FinSight_AI can report on IndiaFinBench today, since its regulatory and numerical tasks are relevant to Indian compliance. The clearest new-benchmark opportunity is an Indian retail personal-finance benchmark covering:
  - INR budgeting.
  - Income-tax regime comparison, deductions and capital-gains computation.
  - UPI/NPCI dispute and mandate flows.
  - Mutual fund SIP and ELSS suitability.
  - Hindi and code-mixed Hinglish queries.

  It should be scored with rubric judges, pass^k and abstention, and include tau2-style simulated-user banking tasks.

### Gaps
- I did not verify any Hindi or Indic-language finance QA dataset. arXiv:2602.05794 and the FinanceParam model card need reading.
- I found no benchmark on UPI, Indian tax filing or Indian retail banking customer service.
