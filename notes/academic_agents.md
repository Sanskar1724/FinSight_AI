# Academic work on LLM-based and multi-agent systems for finance (focus: personal finance), 2023 to Oct 2026

Verification note: items marked **[verified]** were read in this session (abstract or full text). Items marked **[known; not re-verified]** are well-known papers cited by arXiv ID from prior knowledge. Their IDs are reliable, but quote their numbers only after checking the paper. Numbers are quoted only where I was confident or had verified them.

## 1. Finance foundation models: what they improved and where they still fail

### Takeaway
Finance LLMs went from huge domain-pretrained models (BloombergGPT, 2023) to cheap instruction-tuned open models (FinGPT, FinMA, DISC-FinLLM, FinTral) to small RL-trained reasoning models (Fin-R1, Fino1, DianJin-R1, Agentar-Fin-R1, 2025). A 7B RL model now matches or beats much larger general models on FinQA/ConvFinQA. Realistic analyst-style numerical tasks still fail around 50 to 70% of the time, and models almost never state the assumptions they make. That gap is the reason for FinSight's deterministic calculation engine.

### Cited Findings
- **Fin-R1** (SUFE-AIFLM-Lab, 2025) **[verified]**: a 7B model built on Qwen2.5-7B-Instruct. It is trained in two stages, SFT then RL, on "Fin-R1-Data", which has 60,091 chain-of-thought samples distilled and filtered from financial benchmarks. Model-card scores: FinQA 76.0, ConvFinQA 85.0, Ant_Finance 81.0, TFNS 71.0, Finance-Instruct-500K 62.9, average 75.2. DeepSeek-R1 (671B) scores 71.0 / 82.0 / 90.0 / 78.0 / 70.0 (average 78.2), and the Qwen2.5-7B-Instruct base averages 65.6. Fin-R1 therefore beats DeepSeek-R1 on FinQA and ConvFinQA but trails it on Ant_Finance, TFNS and Finance-Instruct. The SFT-only variant averages 71.9, so RL adds about 3.3 points. — [arXiv:2503.16252](https://arxiv.org/abs/2503.16252v2); [HF model card](https://huggingface.co/SUFE-AIFLM-Lab/Fin-R1)
- **Agentar-Fin-R1** (2025): a follow-up financial reasoning model emphasising domain expertise, training efficiency and advanced reasoning. — [arXiv:2507.16802](https://arxiv.org/abs/2507.16802v2) (numbers not extracted)
- **FinanceQA** (2025) **[verified]**: tests analyst-style numerical work on 10-Ks (Costco). With exact-match scoring, totals are GPT-4o 39.2%, o1 48.7%, Claude 3.5 Sonnet 39.9% and Llama 3.3 70B 31.1%. On assumption-based questions every model scores 2.2 to 4.3%. Fine-tuning GPT-4o on about 9,078 rows raised the total to 56.8% and assumption-based accuracy to 15.2%. Failure modes: models skip independent recalculation (for example diluted shares), default to simplified formulas (end-of-period payables instead of averages), miss EBITDA adjustments, and know accounting rules without applying them in the arithmetic. — [arXiv:2501.18062](https://arxiv.org/pdf/2501.18062)
- **FinanceBench** (Islam et al., 2023): GPT-4-Turbo with a retrieval system answered incorrectly or refused 81% of questions. This figure is re-cited in [arXiv:2603.04663](https://arxiv.org/html/2603.04663v1). — [arXiv:2311.11944](https://ar5iv.labs.arxiv.org/html/2311.11944)
- **EMNLP 2025 Findings survey** (Dong et al.) **[verified abstract]**: names three core modelling problems, which are limited numerical reasoning, sensitivity to prompt wording, and lack of real-time adaptability. — [ACL Anthology 2025.findings-emnlp.972](https://aclanthology.org/2025.findings-emnlp.972/)
- **BloombergGPT** (Wu et al., 2023) **[known; not re-verified]**: a 50B decoder trained on a mixed corpus of Bloomberg financial data (FinPile, about 363B tokens) plus about 345B general tokens. It outperformed similarly sized open models on financial NLP tasks, but it is closed and expensive to train. — [arXiv:2303.17564](https://arxiv.org/abs/2303.17564)
- **FinGPT** (Yang, Liu, Wang, 2023) **[known; not re-verified]**: an open-source, data-centric framework that uses lightweight LoRA fine-tuning on automatically collected financial data, positioned as a cheap alternative to BloombergGPT. — [arXiv:2306.06031](https://arxiv.org/abs/2306.06031)
- **PIXIU / FinMA** (Xie et al., 2023) **[known; not re-verified]**: an instruction-tuned LLaMA (FinMA) plus the FIT instruction dataset and the FLARE evaluation benchmark. It does well on sentiment and classification but is weak on numerical QA such as FinQA. A 2025 retrospective analysis of FinMA exists. — [arXiv:2306.05443](https://arxiv.org/abs/2306.05443); [arXiv:2510.05151](https://arxiv.org/html/2510.05151v1)
- **FinBen** (Xie et al., 2024; NeurIPS 2024 Datasets & Benchmarks) **[known; not re-verified]**: a holistic financial benchmark covering extraction, analysis, QA, generation, risk, forecasting and decision-making/trading. The Alpha Illusion paper cites its GPT-4 FinTrade Sharpe of 1.51 ± 1.08 as an example of how uncertain short-window results are. — [arXiv:2402.12659](https://arxiv.org/abs/2402.12659); [arXiv:2605.16895](https://arxiv.org/html/2605.16895v1)
- **FinTral** (Bhatia et al., 2024, ACL Findings) **[known; not re-verified]**: a multimodal Mistral-7B-based family with tool use and retrieval. It reports reduced hallucination and beats GPT-3.5 on its own benchmark suite. — [arXiv:2402.10986](https://arxiv.org/abs/2402.10986)
- **XuanYuan 2.0** (Du Xiaoman, 2023) **[known; not re-verified]**: a Chinese financial chat model based on BLOOM-176B with hybrid tuning. — [arXiv:2305.12002](https://arxiv.org/abs/2305.12002)
- **DISC-FinLLM** (Fudan, 2023) **[known; not re-verified]**: Baichuan-13B with multiple LoRA experts for consulting, financial NLP tasks, computation (it calls tools such as a calculator or equation solver instead of doing arithmetic in-weights) and retrieval-augmented QA. This is an early example of offloading arithmetic to tools. — [arXiv:2310.15205](https://arxiv.org/abs/2310.15205)
- **Fino1** (2025) and **DianJin-R1** (2025) **[known; not re-verified]**: further 2025 work on reasoning models (o1/R1-style) for finance. Fino1 reports that general reasoning improvements transfer only partly to financial tasks. — [arXiv:2502.08127](https://arxiv.org/abs/2502.08127); [arXiv:2504.15716](https://arxiv.org/abs/2504.15716)
- **Hallucination study** (Kang & Liu, 2023) **[known; not re-verified]**: an empirical examination of LLM hallucination in finance (term explanations, historical stock prices). It found serious hallucination in off-the-shelf models and only partial mitigation from RAG and few-shot prompting. — [arXiv:2311.15548](https://arxiv.org/abs/2311.15548)

### Inferences
- The best open finance model at 7B (Fin-R1) still gets about 1 in 4 FinQA items wrong under its own evaluation. Analyst-realistic benchmarks (FinanceQA) show even frontier models fail more than half the time and almost never surface missing assumptions. For a consumer app, this argues for an LLM that explains and routes, with arithmetic done by a deterministic engine.
- No foundation model above targets *personal* finance. All target corporate filings, market text, or Chinese banking QA.

### Gaps
- Exact FinQA/ConvFinQA numbers for FinMA, FinTral, DISC-FinLLM, Fino1, DianJin-R1 and Agentar-Fin-R1 were not extracted this session.
- 2026 finance reasoning models beyond Agentar-Fin-R1 were not searched in depth.

## 2. Finance agent frameworks: architecture, evaluation, limits

### Takeaway
Agent frameworks (FinMem, FinAgent, FinCon, TradingAgents, FinRobot, StockAgent, FinVision, FinSphere) nearly all target trading, stock analysis or equity research. They share a pattern of specialised roles, layered memory, tools/data APIs and debate or manager-analyst hierarchies. A 2025–2026 critical literature shows that the headline returns largely disappear under point-in-time evaluation, transaction costs and longer windows.

### Cited Findings
- **TradingAgents** (Xiao et al., 2024) **[verified exists]**: imitates a trading firm. Roles are fundamental, sentiment, news and technical analysts; bullish and bearish researchers who debate; a trader; a risk-management team; and a fund manager. It reports gains in cumulative return, Sharpe and max drawdown over baselines on a short backtest. Open-source. — [arXiv:2412.20138](https://arxiv.org/abs/2412.20138); [GitHub](https://github.com/TauricResearch/TradingAgents)
- **FinCon** (Yu et al., NeurIPS 2024) **[verified exists]**: a manager-analyst hierarchy with "conceptual verbal reinforcement". A risk-control component updates investment beliefs that propagate to agents, and communication is restricted to cut cost. — [arXiv:2407.06567](https://arxiv.org/abs/2407.06567)
- **FinMem** (Yu et al., 2023) **[known; not re-verified]**: a single trading agent with profiling, layered memory (short, mid and long-term, with decay) and decision modules. — [arXiv:2311.13743](https://arxiv.org/abs/2311.13743)
- **FinAgent** (Zhang et al., KDD 2024) **[known; not re-verified]**: a multimodal (charts plus text) tool-augmented trading agent with dual reflection. — [arXiv:2402.18485](https://arxiv.org/abs/2402.18485)
- **FinRobot** (AI4Finance, 2024) **[known; not re-verified]**: an open-source agent platform with layers for agents, LLM algorithms, LLMOps/DataOps and foundation models, plus a "Financial Chain-of-Thought" for equity research reports. — [arXiv:2405.14767](https://arxiv.org/abs/2405.14767)
- **StockAgent** (2024) [arXiv:2407.18957](https://arxiv.org/abs/2407.18957), **FinVision** (2024) [arXiv:2411.08899](https://arxiv.org/abs/2411.08899) and **FinSphere** (2025) [arXiv:2501.12399](https://arxiv.org/abs/2501.12399) **[known; not re-verified]**: these are, respectively, a simulation of investor agents, a multimodal multi-agent stock-prediction framework, and a conversational stock-analysis agent that uses quantitative tools.
- **Trading-agent survey** (Ding et al., 2024): a survey of LLM agents in financial trading covering architectures, data and evaluation. — [arXiv:2408.06361](https://arxiv.org/html/2408.06361v2)
- **FINSABER / "Can LLM-based financial investing strategies outperform the market in the long run?"** (Li et al., 2025): a long-horizon, bias-aware backtest framework. The Alpha Illusion paper cites it as showing that FinMem's total return drops by about 71.85% and QuantAgent's Sharpe by about 51.48% once the test window crosses the model's knowledge cutoff. — [arXiv:2505.07078](https://arxiv.org/html/2505.07078v5); cited in [arXiv:2605.16895](https://arxiv.org/html/2605.16895v1)
- **"The Alpha Illusion"** (2026) **[verified]**: argues that reported alpha from LLM trading agents is not deployment evidence. Main points:
  - Across FinMem, TradingAgents, FinAgent, FinCon and QuantAgent, 35 of 40 system-by-friction-component cells are unmodelled.
  - In the authors' one-year, five-ticker reproduction, TradingAgents' Sharpe falls from 0.43 to 0.22 after costs and QuantAgent's from -0.96 to -1.15, both below buy-and-hold.
  - Citing Zhang et al., multi-agent debate wins only about 20% of the time across 36 configurations.
  - LLM revenue-recall accuracy is 54.17% for large-cap firms in 2017 but 6.32% for 1995, so model knowledge is not point-in-time reliable.
  - It proposes six minimum-evidence protocols, P1–P6: temporal integrity, dynamic universe, counterfactual robustness, calibration, net-of-friction returns, and multi-agent disaggregation.
  - It recommends LLMs as "auditable upstream information interfaces", with calibration, risk and execution in independent modules that can override LLM outputs.
  — [arXiv:2605.16895](https://arxiv.org/abs/2605.16895)
- **"Toward Reliable Evaluation of LLM-Based Financial Multi-Agent Systems"** (2026): proposes a taxonomy and argues for "coordination primacy" and cost-awareness in evaluating financial multi-agent systems. — [arXiv:2603.27539](https://arxiv.org/html/2603.27539v1) (details not extracted)

### Inferences
- The architectural pattern of role specialisation plus shared memory plus a supervising or risk agent carries over to FinSight's planned specialised bots. The evaluation lesson carries over too: report component-level (disaggregated) gains, and do not credit the multi-agent layer for gains that come from the tools.
- The Alpha Illusion recommendation (LLM as an interface, deterministic modules hold authority) closely matches FinSight's design and gives it a strong citation in favour of a deterministic engine.

### Gaps
- No agent framework found targets household budgeting or cash-flow with a comparable multi-agent evaluation. One Springer chapter, "Finance Utility LLM: A Multi-Agent LLM Framework for Intelligent Personal Finance Management", appeared in search results but was not read. — [Springer](https://link.springer.com/chapter/10.1007/978-3-032-20735-7_30)

## 3. Personal finance: literacy, advice quality, bias, trust

### Takeaway
LLMs score moderately on personal-finance literacy tests (about 68% on average across 10 models in 2024, with the best near 80%) and degrade on advanced questions. Advice is directionally sensible but heuristic-laden, inconsistent across repeated queries, and partly gender-biased. Users trust charismatic but worse advisors, which makes grounding and explainability an ethical requirement as well as an accuracy one.

### Cited Findings
- **"Can AI Help with Your Personal Finances?"** (Hean, Saha, Saha; *Applied Economics*) **[verified]**: 10 LLMs were tested zero-shot on MoneyCounts and NFEC literacy questions (mortgages, taxes, loans, investing, credit cards, budgeting, retirement, student loans). Mean accuracy: Claude 3.5 Sonnet 79.78%, ChatGPT-4 78.34%, GPT-4o 74.91%, Claude 3 Opus 74.73%, Gemini Advanced 71.30%, Gemini 64.80%, Llama 3 70B 64.62%, Claude 3 Haiku 61.73%, ChatGPT-3.5 61.01%, Llama 3 8B 53.43%; all models 68.47%. On advanced questions ChatGPT-3.5 scored 49.43% and Llama 3 8B 35.63%. The authors flag outdated knowledge, privacy and bias. — [arXiv:2412.19784](https://arxiv.org/pdf/2412.19784)
- **"AI Financial Advice: Supply, Demand, and Life Cycle Implications"** (Choukhmane, de Silva, Lin, Akuzawa; MIT/Stanford, July 2026 draft) **[verified]**:
  - Method: 952 US adults wrote their own prompts. A calibrated life-cycle model then simulated households following GPT-5.2's advice.
  - What improved: following the advice would raise equity-fund participation, give an equity glide path declining after about age 45, and build savings buffers above $10,000 by age 30.
  - Departures from theory: fitting the advice requires an implausible discount factor of about 1.034. The advice relies on heuristics (round numbers, the 4% rule), cuts consumption too sharply after job loss, and never rebalances.
  - Inconsistency: repeated queries have median standard deviations of about $3,220 in annual consumption and 6.5 pp in equity share.
  - Bias: simulated wealth at age 60 is about 4–6% higher for men, the financially literate and prior AI users. Roughly a third of the gender equity gap is supply-side, meaning identical prompts with a male versus female label get different advice.
  - A structured "academic" prompt improves smoothing but not rebalancing.
  — [arXiv:2608.01607](https://arxiv.org/html/2608.01607v1)
- **"Are Generative AI Agents Effective Personalized Financial Advisors?"** (Takayanagi, Izumi, Sanz-Cruzado, McCreadie, Ounis; 2025) **[verified abstract]**:
  - Design: a lab study with 64 participants.
  - Preferences: LLM advisors often matched humans at preference elicitation but struggled with conflicting needs. Poor elicitation could steer users to unsuitable assets.
  - Trust: users were insensitive to advice quality, and trust sometimes moved inversely with quality. An extroverted persona earned higher satisfaction and emotional trust despite worse advice.
  — [arXiv:2504.05862](https://arxiv.org/abs/2504.05862v2)
- **"A Data-Generation Framework for Personal Finance LLMs"** (Theerthala, Perfios, 2025) **[verified]**:
  - Data: 4-phase CoT data (query analysis, retrieval-based context analysis, psychological cues, response) built from about 19k of roughly 405k Reddit personal-finance questions. Largest category: debt and credit (5,175).
  - Model: a fine-tuned Qwen-3-8B scores BERTScore 0.700 and BLEURT 0.460, close to 12–32B models. It costs $0.96 per 504 queries versus $5.63 for Gemma3-27B.
  - Limitations: the main failure mode is factual hallucination on jurisdiction-specific tax and insurance rules. The data is Reddit-only and US-focused, and references are synthetic.
  — [arXiv:2509.14180](https://arxiv.org/pdf/2509.14180)
- **"GPT has become financially literate"** (Niszczota & Abbas, 2023) **[found; numbers not re-verified]**: GPT models were given financial literacy tests, with a preliminary test of how people use GPT as an advice source. As recalled, GPT-4 scored near-perfect while GPT-3.5 scored around 65%; check before quoting. — [arXiv:2309.00649](https://arxiv.org/pdf/2309.00649)
- **"Your AI, Not Your View: The Bias of LLMs in Investment Analysis"** (2025): documents systematic LLM preferences (biases) in investment analysis. — [arXiv:2507.20957](https://arxiv.org/html/2507.20957v1) (numbers not extracted)
- **"Robo-Advisors Beyond Automation: Principles and Roadmap for AI-Driven Financial Planning"** (2025) — [arXiv:2509.09922](https://arxiv.org/html/2509.09922); **"Formal verification for robo-advisors"** (2025) — [arXiv:2509.08540](https://arxiv.org/pdf/2509.08540) (not read).
- Other advice-quality work found but not read: "ChatGPT, Help! I Am in Financial Trouble" (JRFM 2024) — [MDPI](https://www.mdpi.com/1911-8074/17/6/241); "ChatGPT as a Financial Advisor: A Re-Examination" (JRFM 2025) — [MDPI](https://www.mdpi.com/1911-8074/18/12/664); Marley-Payne, "Content Analysis of LLM Financial Advice Responses" — [PDF](https://jackmarleypayne.com/assets/pdfs/marley-payne-ai-financial-advice.pdf); ESMA/Alan Turing Institute report on responsible LLM adoption in finance (June 2025) — [ESMA PDF](https://www.esma.europa.eu/sites/default/files/2025-06/LLMs_in_finance_-_ILB_ESMA_Turing_Report.pdf).
- **"Can ChatGPT Plan Your Retirement?"** (Lo & Ross, 2024): argues that generative AI lacks fiduciary alignment and domain-specific regulatory knowledge for financial advice. **[known; URL not retrieved this session]**

### Inferences
- Three independent lines of evidence point the same way: literacy tests (about 68% mean), life-cycle simulation (heuristics, no rebalancing, about $3.2k run-to-run variance) and a user study (trust uncorrelated or inversely correlated with quality). An unconstrained LLM is unreliable as a personal-finance advisor, and users cannot detect when it is wrong. Deterministic numbers with grounded explanations address both the error rate and the calibration-of-trust problem.
- Supply-side gender bias suggests FinSight should keep demographic attributes out of advice prompts unless they are needed, and should audit for bias.

### Gaps
- No peer-reviewed study found evaluates an LLM over a user's *actual transaction ledger* for budgeting accuracy.
- The URL and numbers for Lo & Ross were not retrieved. Robo-advice HCI trust literature from before LLMs was not covered.

## 4. Accuracy techniques: tools, SQL, RAG, hallucination detection, routing, memory, privacy

### Takeaway
The strongest accuracy pattern in recent finance work is "LLM writes a program or query, a deterministic engine executes it, and a verifier checks grounding". Examples are Program-of-Thought, DISC-FinLLM's computing expert, and VeNRA's typed fact ledger with a 3B hallucination sentinel. Privacy and on-device work specific to personal finance is thin.

### Cited Findings
- **VeNRA** (Agand, FactAI Lab, March 2026) **[verified]**:
  - Typed fact ledger: documents are parsed into a "Universal Fact Ledger" of typed numerical variables. Tables are parsed deterministically with Pandas, and the LLM writes Python to compute answers.
  - "Double-Lock Grounding": each extracted value's quote must align to character offsets in the source, and unaligned facts get confidence 0 and are blocked from execution. "Phantom metrics" are rejected below a semantic overlap threshold of 0.30.
  - Lexical gate: token-recall threshold 0.30, with stop-word removal so that "Net Income" and "Net Sales" are not conflated.
  - Sentinel: a roughly 3B "VeNRA Sentinel" SLM audits execution traces, with a target latency under 50 ms versus over 2,000 ms for frontier models. It is trained on about 10k adversarial traces from a "Saboteur Engine" (numeric-neighbour traps, time warps, scale or entity drift).
  - Accuracy figures were not visible in the excerpt read.
  — [arXiv:2603.04663](https://arxiv.org/html/2603.04663v1)
- **FinReflectKG – HalluBench** (2026): a GraphRAG hallucination benchmark for financial QA. — [arXiv:2603.20252](https://arxiv.org/pdf/2603.20252) (not read)
- **Program of Thoughts** (Chen et al., TMLR 2023) **[known; not re-verified]**: separates computation from reasoning by generating Python. It reports about 12% average gain over chain-of-thought across math and financial QA (FinQA, ConvFinQA, TAT-QA). — [arXiv:2211.12588](https://arxiv.org/abs/2211.12588)
- **BookSQL** (Kumar et al., NAACL 2024) **[known; not re-verified]**: a large text-to-SQL benchmark over accounting/bookkeeping ledgers. The best models perform poorly on it, so ledger text-to-SQL is far from solved. — [arXiv:2406.07860](https://arxiv.org/abs/2406.07860)
- **Mixture-of-Agents** (Wang et al., 2024) **[known; not re-verified]**: layered aggregation of several LLMs' outputs, a general-domain routing and aggregation reference. — [arXiv:2406.04692](https://arxiv.org/abs/2406.04692)
- **Multi-agent debate** limits: debate wins only about 20% of the time across 36 configurations (Zhang et al., as cited in the Alpha Illusion paper). — [arXiv:2605.16895](https://arxiv.org/html/2605.16895v1)
- **Memory**: FinMem's layered memory with decay is the canonical finance-agent memory design. — [arXiv:2311.13743](https://arxiv.org/abs/2311.13743)
- **Privacy**: **AgentLeak** (2026) is a full-stack benchmark for privacy leakage in multi-agent LLM systems, covering leakage through inter-agent messages and memory as well as final outputs. — [arXiv:2602.11510](https://arxiv.org/html/2602.11510v1) (details not extracted). The EMNLP 2025 survey names "privacy-compliant deployment" as an open problem. — [ACL Anthology](https://aclanthology.org/2025.findings-emnlp.972/)
- **Small/cheap models for personal finance**: an 8B fine-tuned model approaches 27–32B models on personal-finance advice at about 74–83% lower serving cost ($0.96 versus $3.67 to $5.63 per 504 queries), which supports on-premise or near-device deployment. — [arXiv:2509.14180](https://arxiv.org/pdf/2509.14180)

### Inferences
- VeNRA is the closest academic analogue to FinSight's "deterministic engine plus grounded LLM". It is cited for the typed fact ledger, the code execution and the small-model sentinel. FinSight could also adopt a sentinel-style post-hoc grounding check on assistant responses.
- AgentLeak suggests that adding specialised bots in one environment creates new privacy leakage surfaces (inter-agent messages, shared memory), which a multi-bot FinSight should evaluate.

### Gaps
- Federated learning for finance LLMs and on-device personal-finance LLMs: no specific papers were verified this session.
- Supervisor-router designs evaluated specifically on finance tasks were not found. Text-to-SQL numbers on BookSQL were not verified.
- Guardrail papers specific to finance compliance (for example suitability or disclosure checks) were not covered.

## 5. Surveys (2023–2026) and the open problems they list

### Takeaway
Surveys agree that the open problems are numerical reasoning, hallucination and grounding, temporal and real-time adaptability, evaluation realism (leakage, costs), privacy-compliant deployment, and coordination in multi-agent systems. Personal finance is barely represented. Their taxonomies centre on data analysis, investment research, trading, investment management and risk.

### Cited Findings
- **Dong et al., "Large Language Model Agents in Finance: A Survey Bridging Research, Practice, and Real-World Deployment"** (EMNLP 2025 Findings, pp. 17889–17907) **[verified abstract]**: catalogues over 30 financial benchmarks and 20 models. Its taxonomy covers data analysis, investment research, trading, investment management and risk management. Challenges it names: numerical reasoning, prompt sensitivity, real-time adaptability. Directions: continual adaptation, coordination-aware multi-agent systems, privacy-compliant deployment, closer researcher–practitioner collaboration, transparent architectures. — [ACL Anthology](https://aclanthology.org/2025.findings-emnlp.972/)
- **Ding et al., "Large Language Model Agent in Financial Trading: A Survey"** (2024). — [arXiv:2408.06361](https://arxiv.org/html/2408.06361v2)
- **Lee et al., "A Survey of Large Language Models in Finance (FinLLMs)"** (2024). — [arXiv:2402.02315](https://ideas.repec.org/p/arx/papers/2402.02315.html)
- **Li et al., "Large Language Models in Finance: A Survey"** (ICAIF 2023) **[known; not re-verified]** — [arXiv:2311.10723](https://arxiv.org/abs/2311.10723); **Nie et al., "A Survey of LLMs for Financial Applications: Progress, Prospects and Challenges"** (2024) **[known; not re-verified]** — [arXiv:2406.11903](https://arxiv.org/abs/2406.11903)
- **"LLM Agents for Investment Management: Foundations, Benchmarks, and Research Frontiers"** (ACM ICAIF 2025). — [ACM DL](https://dl.acm.org/doi/10.1145/3768292.3770387)
- **ESMA / Alan Turing Institute report** (June 2025): a regulator-side view on responsible LLM adoption in finance. — [ESMA PDF](https://www.esma.europa.eu/sites/default/files/2025-06/LLMs_in_finance_-_ILB_ESMA_Turing_Report.pdf)

### Inferences
- The literature has a clear gap that FinSight can claim: almost no work builds and evaluates a *personal-finance*, multi-bot system that combines deterministic calculation with grounded LLM explanation over a user's own ledger. Most agent work is trading-centric and evaluated on backtests that critics now dispute.

### Gaps
- Full open-problem lists in Lee et al. and Nie et al. were not re-read this session.
- No 2026 survey focused specifically on personal finance LLMs was found.
