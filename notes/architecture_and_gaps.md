# Architecture Patterns and Open Research Gaps for a Unified Multi-Agent Personal Finance Assistant (FinSight_AI)

Scope note: target system is FinSight_AI (React 19 + FastAPI + SQLAlchemy; JWT cookie auth with per-user isolation; deterministic Decimal finance engine; regex intent router over ~20 intents; hashed bag-of-words RAG; optional OpenAI-compatible LLM with deterministic fallback; APScheduler notifications; 28-case Research lab with lexical rubric). Research done October 2026. About 30 tool calls were used. Several sub-questions (framework-by-framework comparisons, text-to-SQL guardrails, nudge evidence, passkeys and step-up auth, NIST AI RMF) could not be checked against primary sources in that budget, so they are listed under Gaps rather than asserted.

## 1. Orchestration patterns: router/supervisor vs hierarchical vs swarm/handoff, and when multi-agent beats single-agent

### Takeaway
The best-documented guidance (Anthropic) says to start with the simplest workflow: routing plus deterministic tools, which is what FinSight_AI already has. Move to orchestrator-workers only for tasks that run in parallel and need a lot of context. In a 1,642-trace study, multi-agent systems failed on 41–87% of tasks, and their gains over single-agent or best-of-N baselines were often small. Most failures came from system design and verification, not from model capability.

### Cited Findings
- Anthropic separates **workflows** (LLMs and tools run along predefined code paths) from **agents** (the LLM directs its own process and tool use). It lists five workflow patterns: prompt chaining, **routing** (classify the input, then send it to a specialized follow-up), parallelization (sectioning or voting), **orchestrator-workers** (a central LLM decides subtasks at runtime and delegates them), and evaluator-optimizer. — [Anthropic, Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- The same article advises using the simplest solution that works, because agentic systems trade latency and cost for performance. It recommends starting with LLM APIs directly rather than frameworks, since frameworks hide prompts and responses and make debugging harder. It also recommends investing in "agent-computer interface" tool design: docstring-quality descriptions, clear boundaries between similar tools, and poka-yoke (mistake-proof) parameters. — [Anthropic, Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- Anthropic's production multi-agent Research system (an Opus 4 lead with Sonnet 4 subagents, orchestrator-worker) beat single-agent Opus 4 by **90.2%** on an internal research eval. — [Anthropic Engineering, multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Costs from the same source: agents used about **4×** the tokens of chat, and multi-agent systems about **15×**. On BrowseComp, token usage alone explained **80%** of performance variance, and token usage, tool-call count and model choice together explained 95%. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- Anthropic says multi-agent is a **poor fit** where all agents must share the same context, where agents have many dependencies on each other, for most coding tasks, and for real-time coordination. It fits work that runs in parallel, exceeds one context window, and uses many tools. The system also adds a dedicated CitationAgent after synthesis, and rewriting tool descriptions cut later task time by 40%. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- **MAST** ("Why Do Multi-Agent LLM Systems Fail?", NeurIPS 2025) annotated **1,642 traces** from 7 frameworks (ChatDev, MetaGPT, HyperAgent, AppWorld, AG2/MathChat, Magentic-One, OpenManus). It found **41%–86.7% failure rates** and gains that were "often minimal" against single-agent or best-of-N baselines. — [arXiv 2503.13657v3](https://arxiv.org/html/2503.13657v3); [NeurIPS 2025 poster](https://neurips.cc/virtual/2025/poster/121528)
- MAST sorts failures into 14 modes in 3 categories:
  - **FC1 System design:** disobeying the task spec 11.8%, step repetition 15.7%, unaware of stopping conditions 12.4%, loss of history 2.8%, disobeying the role spec 1.5%.
  - **FC2 Inter-agent misalignment:** reasoning-action mismatch 13.2%, task derailment 7.4%, failing to ask for clarification 6.8%, conversation reset 2.2%, ignoring another agent's input 1.9%, information withholding 0.85%.
  - **FC3 Task verification:** incorrect verification 9.1%, no or incomplete verification 8.2%, premature termination 6.2%.

  Human inter-annotator agreement was κ=0.88. An o1 LLM-judge reached 94% accuracy (κ=0.77). — [arXiv 2503.13657v3](https://arxiv.org/html/2503.13657v3)
- MAST interventions on ChatDev: clearer role specs gave +9.4%, giving the CEO agent the final say gave +9.4%, and adding high-level objective verification gave **+15.6%**. Overall completion remained low. — [arXiv 2503.13657v3](https://arxiv.org/html/2503.13657v3)
- Google's ADK (Agent Development Kit) ships in Python, TypeScript, Go and Java, and sits next to the A2A protocol family. — [Google Open Source Blog, A2Family, Apr 23 2026](https://opensource.googleblog.com/2026/04/meet-the-a2family.html)

### Inferences
- FinSight_AI's regex intent router plus deterministic engine is Anthropic's "routing" workflow. Specialized bots (budget, investments, bills, tax, fraud) are a natural next step as routed specialists, ideally sharing one deterministic tool layer. A free-form swarm is a poor fit. Personal-finance questions mostly depend on the same shared ledger, which is exactly the "shared context, many dependencies" case Anthropic flags as a poor fit for multi-agent.
- Orchestrator-workers is justified mainly for compound questions that split into independent parts, such as "Can I afford X, given my goals, tax and recurring bills?". Even then, a verification step (the MAST FC3 fix) and a citation or number-check step (the Anthropic CitationAgent analogue) should come before any free-text answer.
- MAST gives a ready-made error taxonomy for FinSight's Research lab. Labeling failures by MAST mode would be an evaluation contribution beyond a lexical rubric.

### Gaps
- No primary sources were fetched on the **OpenAI Agents SDK handoffs**, **LangGraph** supervisor and swarm modules, **AutoGen/AG2**, or **CrewAI**. Their features, APIs and versions as of Oct 2026 are unverified here.
- No controlled study was found that compares single-agent and multi-agent setups on **personal-finance** tasks specifically.

## 2. Interoperability: MCP, A2A, agent payment protocols (status as of 2026)

### Takeaway
By 2026 the stack has split into layers. MCP connects agents to tools and data. A2A (v1.0, Linux Foundation) connects agents to other agents. AP2 and UCP, built on A2A, and card-network tokens (Visa Intelligent Commerce, Mastercard Agent Pay) handle payments. Fintech MCP servers so far mostly serve merchant or developer tasks (PayPal invoicing, Plaid developer diagnostics) rather than consumer ledgers. In India, consumer financial data access runs through the RBI Account Aggregator consent framework.

### Cited Findings
- The MCP authorization spec (2025-06-18) works as follows:
  - MCP servers act as **OAuth 2.1 resource servers** and **MUST** publish Protected Resource Metadata (RFC 9728).
  - Clients **MUST** send RFC 8707 `resource` indicators and **MUST** use PKCE.
  - Servers **MUST** validate that each token's audience is themselves, and **MUST NOT pass tokens through** to upstream APIs (to prevent the confused deputy problem).
  - Authorization servers **SHOULD** issue short-lived tokens and **MUST** rotate refresh tokens for public clients.
  - Authorization is optional, and STDIO servers take their credentials from the environment instead.

  — [MCP spec, Authorization 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- **PayPal MCP server** (Apr 2, 2025): offered locally via the Agent Toolkit and as a remote, cloud-hosted server that uses PayPal login. Its first capability is invoicing. — [PayPal Developer blog](https://developer.paypal.com/community/blog/paypal-model-context-protocol/); [PayPal Agent Toolkit & MCP docs](https://paypal.gitbook.com/agent-toolkit-and-mcp-server)
- **Plaid MCP server** (May 7, 2025, integrated with Claude): exposes developer tools for usage monitoring, Link conversion analytics and troubleshooting. The report does not describe access to end-user transactions. — [The Paypers](https://thepaypers.com/payments/news/plaids-mcp-server-integrates-anthropics-ai-assistant-claude)
- **A2A v1.0** (Linux Foundation, Apr 9, 2026):
  - "first stable specification"
  - more than 150 supporting organizations (AWS, Cisco, Google, IBM, Microsoft, Salesforce, SAP, ServiceNow)
  - adds multi-protocol support, enterprise multi-tenancy, and **Signed Agent Cards** for cryptographic identity
  - supported in Azure AI Foundry, Copilot Studio and Bedrock AgentCore
  - positioned as complementary to MCP

  — [Linux Foundation press release](https://linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- **AP2** extends A2A for agent payments and has more than 60 supporting organizations "across payments and financial services". — [Linux Foundation](https://linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- AP2 uses **verifiable digital credentials (VDCs)**. **UCP** (Universal Commerce Protocol) covers the shopping journey with built-in A2A and AP2 support, and the business stays Merchant of Record. **A2UI** lets agents render only pre-approved UI components. — [Google Open Source Blog, A2Family](https://opensource.googleblog.com/2026/04/meet-the-a2family.html); [AP2 spec site](https://ap2-protocol.org/index.md)
- **Visa Intelligent Commerce** gives the agent a tokenized credential tied to that agent, with consumer-set spend limits and scopes. Partners include Anthropic, Microsoft, Mistral, OpenAI and Perplexity. **Mastercard Agent Pay** also uses tokenization with consumer-set parameters. **PayPal Agent Toolkit** focuses on developer API access. — [PYMNTS, May 2 2025](https://pymnts.com/news/artificial-intelligence/2025/visa-mastercard-paypal-fuel-agentic-ai-commerce-boom)
- **India Account Aggregator (AA)** scale in FY25:
  - 115.8M consent-based data transactions
  - 24.4M users served
  - 179 FIPs, 748 FIUs, 16 AAs
  - NBFCs 60% of consents, RIAs 23%
  - 7.69M personal finance management customers served

  — [Business Standard, Oct 6 2025](https://www.business-standard.com/amp/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html)
- Sahamati, the AA industry body, has published on how the DPDP Act affects the AA framework. — [Sahamati](https://sahamati.org.in/digital-personal-data-protection-act-implications-for-the-aa-framework/)

### Inferences
- For "outside platform integrations" in India, the regulated and consented route to bank, MF and insurance data is the AA framework, not Plaid-style scraping. FinSight would integrate as an FIU or through an FIU partner. Each MCP tool server, whether internal (ledger, tax) or external, should follow the MCP OAuth rules: per-server audience-bound tokens and no token passthrough. Those rules map directly onto per-bot least privilege.
- A2A matters mainly if FinSight's specialist bots must interoperate with **external** agents, such as a bank's or a broker's agent. Internal bots can share an in-process router. Signed Agent Cards and AP2 mandates are relevant only once the assistant can **act**, for example by paying bills.

### Gaps
- No primary source was fetched for the **Stripe** MCP server, or for Visa's **Trusted Agent Protocol** and Mastercard's 2026 updates. Exact versions and launch dates are unverified.
- No **India** support (UPI/NPCI or AA) for AP2 or for agent mandates was found or verified.

## 3. Grounding and numeric accuracy

### Takeaway
The proven pattern is "LLM as router and narrator, deterministic code as calculator": tool-calling into vetted calculators, then a separate step that verifies citations and numbers. FinSight's Decimal engine is already the right backbone. In the closest personal-finance LLM study found, hallucination of jurisdiction-specific tax and regulatory facts was the main failure mode.

### Cited Findings
- Anthropic recommends programmatic checks ("gates") between chained steps and evaluator-optimizer loops where clear criteria exist. — [Building effective agents](https://www.anthropic.com/research/building-effective-agents)
- Anthropic's Research system adds a dedicated **CitationAgent** that attributes claims to sources after synthesis. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- MAST finds that **missing or incorrect verification** together account for about 17% of MAS failures, and that adding objective verification gave the largest gain measured (+15.6%). — [arXiv 2503.13657v3](https://arxiv.org/html/2503.13657v3)
- A 2025 personal-finance reasoning study (Perfios):
  - Fine-tuned Qwen-3-8B on 19k Reddit-derived, behaviorally grounded reasoning chains, evaluated mainly by LLM juries.
  - Accuracy was the 8B model's **weakest** axis.
  - Factual hallucination, "especially for jurisdiction-specific tax and regulatory details", was the main failure mode.
  - No human rater study and no agentic deployment or audit were reported.

  — [arXiv 2509.14180](https://arxiv.org/pdf/2509.14180)
- Finance agent benchmarks found are **institutional or investing** benchmarks: InvestorBench (ACL 2025) on trading and decision tasks, and the Finance Agent Benchmark on financial-analyst research tasks. — [InvestorBench, ACL 2025](https://aclanthology.org/2025.acl-long.126); [arXiv 2412.18174](https://arxiv.org/html/2412.18174v1); [Finance Agent Benchmark, arXiv 2508.00828](https://alphaxiv.org/abs/2508.00828)

### Inferences
- Recommended FinSight pattern:
  1. The LLM never computes numbers. It calls typed tools such as `budget_status` and `forecast(month)`.
  2. The answer template carries structured numeric slots filled from tool output.
  3. A post-hoc **numeric-faithfulness checker** extracts every number and currency amount from the generated text and matches it, within tolerance, to tool outputs or cited KB passages. A mismatch triggers abstention or the deterministic fallback.

  This is a cheap, testable, neuro-symbolic verifier and a strong paper contribution.
- Text-to-SQL over a user's own ledger should, if adopted, run only against a read-only, row-level-filtered view that holds that user's or household's rows.

### Gaps
- No primary sources were fetched on text-to-SQL guardrails or semantic layers, on numeric-faithfulness metrics, or on abstention and calibration methods for finance. These need a separate search.

## 4. Security and privacy: prompt injection, least privilege, regulation (India, EU, OWASP)

### Takeaway
Design-level defenses outperform detection. CaMeL's split of control flow and data flow plus capability tags gave provable security on 77% of AgentDojo tasks, against 84% utility undefended. OWASP's 2026 Agentic Top 10 sets out a threat checklist. For India the binding timelines are the DPDP Rules phases (consent managers from Nov 13 2026; full obligations from May 13 2027). RBI's FREE-AI (Aug 2025: 7 Sutras, 6 pillars, 26 recommendations) and SEBI's AI/ML consultation (June 2025) are the sector framing.

### Cited Findings
- **CaMeL** ("Defeating Prompt Injections by Design", Debenedetti, Shumailov, Fan, Hayes, Carlini, Fabian, Kern, Shi, Terzis, Tramèr):
  - Extracts control and data flow from the **trusted** user query, so untrusted retrieved data cannot change program flow.
  - Tags values with **capabilities** so that security policies are enforced at each tool call, which blocks exfiltration.
  - Solves **77%** of AgentDojo tasks with provable security, against 84% undefended.

  — [arXiv 2503.18813](https://arxiv.org/abs/2503.18813)
- **OWASP Top 10 for Agentic Applications (2026)**, released Dec 9 2025: ASI01 Agent Goal Hijack; ASI02 Tool Misuse & Exploitation; ASI03 Identity & Privilege Abuse; ASI04 Agentic Supply Chain; ASI05 Unexpected Code Execution; ASI06 Memory & Context Poisoning; ASI07 Insecure Inter-Agent Communication; ASI08 Cascading Failures; ASI09 Human-Agent Trust Exploitation; ASI10 Rogue Agents. — [Modulos summary of OWASP list](https://docs.modulos.ai/frameworks/owasp-top-10-agentic); [OWASP GenAI resource page](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026)
- The MCP spec forbids token passthrough and requires audience validation (confused-deputy protection). This is the protocol basis for per-tool least privilege. — [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- A survey of open challenges in multi-agent security also exists. — [arXiv 2505.02077](https://arxiv.org/pdf/2505.02077)
- **RBI FREE-AI**:
  - The committee was constituted Dec 26 2024 and the report released **Aug 13 2025**.
  - It sets out **7 Sutras** (principles) and **6 strategic pillars**, with **26 recommendations**.

  — [RBI press release 902](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=61018). Secondary analysis: [KPMG India](https://kpmg.com/in/en/insights/2025/08/rbi-free-ai-committee-report-on-framework-for-responsible-and-ethical-enablement-of-artificial-intelligence.html)
- **SEBI** consultation paper on responsible AI/ML use, **June 20 2025**, proposes:
  - model governance, validation and risk assessment
  - disclosure of AI/ML use in advisory, research and portfolio management
  - periodic reporting to SEBI
  - record-keeping of development, testing and monitoring
  - fairness and non-discrimination

  It was still a consultation per this source. — [Taxmann](https://www.taxmann.com/post/blog/sebi-proposes-ai-ml-governance-framework-for-securities-markets). [Digital Policy Alert](https://digitalpolicyalert.org/event/32090-securities-and-exchange-board-of-india-finalised-consultations-on-guidelines-for-responsible-usage-of-aiml-usage-in-security-markets) labels the consultations "finalised"; final guideline text was not verified.
- **DPDP Rules 2025** were notified **Nov 13 2025**:
  - Phase 1: the Data Protection Board operates immediately.
  - Phase 2: the **consent manager** framework applies from **Nov 13 2026**.
  - Phase 3: the remaining substantive obligations, including breach notification, apply from **May 13 2027**.
  - Penalties reach up to ₹250 crore per violation.

  — [Sansa Legal](https://www.sansalegal.com/post/dpdp-act-2023-and-rules-2025-phased-implementation-timeline-and-business-compliance-deadlines); PIB document: [static.pib.gov.in](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
- **EU AI Act**:
  - Recital 58 classifies AI that evaluates **credit scores or creditworthiness** of natural persons as **high-risk**.
  - It flags life and health insurance risk assessment and pricing as consequential.
  - AI used to **detect financial fraud** (as provided for by EU law) and AI used for prudential capital calculations are **not** high-risk.

  — [AI Act Recital 58](https://artificialintelligenceact.eu/recital/58/)

### Inferences
- For FinSight:
  - The fraud and anomaly bot would likely fall outside the EU high-risk scope. Any "loan eligibility" or credit-scoring bot would fall inside it.
  - Under DPDP, households and delegated access need a granular, purpose-bound consent ledger before the May 2027 obligations apply.
  - FREE-AI and SEBI both push toward model inventories, audit trails and disclosure, which maps onto per-agent audit logs: every tool call logged with user, agent, scope, inputs hash and output hash.
- A CaMeL-style design fits FinSight well. User-uploaded statements, KB passages and external API data are "untrusted data" that must never choose tools or parameters. The regex router is already a trusted control-flow extractor.

### Gaps
- The full texts of the 7 Sutras and 6 pillars, and the specific FREE-AI recommendations on consumer disclosure and incident reporting, were not extracted. The RBI page only links the PDF.
- Not verified: whether the EU AI Act Annex III high-risk obligations' application date (Aug 2026) was postponed by the 2025–26 "digital omnibus". Secondary sources such as [Openlayer](https://www.openlayer.com/blog/eu-ai-act-financial-services.md) discuss 2026 timelines and need checking.
- No primary sources were fetched on the dual-LLM pattern (Willison), PII-redaction tooling, or NIST AI RMF and its GenAI profile.

## 5. User management for finance: RBAC/ABAC, households, delegation, advisors, OIDC, passkeys, step-up

### Takeaway
The only primary-sourced pieces found here are protocol-level: MCP's OAuth 2.1 profile and A2A v1.0's enterprise multi-tenancy and Signed Agent Cards. Household and advisor-client authorization models for consumer finance agents are under-documented in what was found. That gap is itself a research opportunity.

### Cited Findings
- A2A v1.0 adds "enterprise multi-tenancy" and Signed Agent Cards for cryptographic agent identity. — [Linux Foundation](https://linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- MCP authorization requires short-lived, audience-bound tokens, PKCE, exact redirect-URI matching, and per-client user consent for proxy servers. 403 responses are for insufficient scopes. — [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- The Plaid MCP server limits users to "what their permissions allow", with an organization owner adding the server. This is an enterprise-admin model, not a household model. — [The Paypers](https://thepaypers.com/payments/news/plaids-mcp-server-integrates-anthropics-ai-assistant-claude)
- Card-network agent tokens let consumers set **what** an agent can buy and **how much** it can spend. This is a consumer-delegation primitive. — [PYMNTS](https://pymnts.com/news/artificial-intelligence/2025/visa-mastercard-paypal-fuel-agentic-ai-commerce-boom)
- The India AA framework uses consent artefacts with defined purpose and scope, and RIAs are a major FIU class (23% of FY25 consents). This is a regulated advisor-client data-access path. — [Business Standard](https://www.business-standard.com/amp/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html)

### Inferences
- A practical model for FinSight:
  - A tenant is a household. Its members hold roles: owner, partner, dependent (read-only or allowance), and external advisor (time-boxed, scoped read).
  - ABAC conditions such as account ownership, consent purpose and expiry decide access to individual rows.
  - Each specialist agent receives a **delegated, down-scoped token** derived from the acting user's grant, never the user's session cookie. That follows the MCP no-passthrough principle.
  - Payments, sharing changes and advisor grants require **step-up authentication** (a passkey re-assertion).

### Gaps
- No primary sources were fetched for passkeys/WebAuthn, OIDC CIBA or step-up standards (e.g., the RFC 9470 step-up challenge), Zanzibar/ReBAC systems (OpenFGA, SpiceDB), or for existing household-finance apps' sharing models. All of these need a dedicated pass.

## 6. Memory, personalization, and proactive nudges

### Takeaway
Little was verified in this pass. OWASP names memory and context poisoning (ASI06) as a top agentic risk. The personal-finance LLM work found treats psychology shallowly (mostly sentiment), with richer constructs such as risk tolerance and financial stress left as future work.

### Cited Findings
- OWASP ASI06 is "Memory & Context Poisoning", which applies to long-term user memory stores. — [Modulos/OWASP list](https://docs.modulos.ai/frameworks/owasp-top-10-agentic)
- Anthropic's lead agent saves its plan to memory because context is truncated beyond 200k tokens. That is memory as a context-management device. — [Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)
- The Perfios personal-finance dataset models "psychological cues" but limits them to basic sentiment, and lists risk tolerance and financial stress as missing. — [arXiv 2509.14180](https://arxiv.org/pdf/2509.14180)
- 7.69M "personal finance management" customers were served through India's AA in FY25. That is a sizable consented-data population for PFM in India. — [Business Standard](https://www.business-standard.com/amp/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html)

### Inferences
- FinSight's financial profile (income band, goals, risk appetite, recurring obligations) should be stored as **typed, user-editable, provenance-tagged facts**, not as free-text memories. That reduces ASI06 poisoning and makes personalization auditable.
- Proactive notifications via APScheduler should be evaluated for outcomes (did the user act; did the balance or goal improve) and for annoyance (dismiss rate), not only for correctness.

### Gaps
- No primary sources were fetched on behavioral-economics nudge effectiveness (e.g., savings-reminder RCTs), on LLM long-term memory systems and benchmarks, or on proactive-agent evaluation methods. These need a dedicated search.

## 7. Open research gaps for personal (not institutional) finance agents

### Takeaway
The finance-agent benchmarks and datasets found are investing or analyst focused (InvestorBench, Finance Agent Benchmark) or built from Reddit text (Perfios). None found evaluate agents over a **private, per-user ledger** with verified numbers, consent constraints, multi-agent coordination, Indian context, or long-horizon user outcomes. MAST shows coordination and verification failures dominate multi-agent systems, but it has not been applied to finance.

### Cited Findings
- Existing agent benchmarks target investment decisions (InvestorBench) or analyst research tasks (Finance Agent Benchmark). — [ACL 2025 InvestorBench](https://aclanthology.org/2025.acl-long.126); [Finance Agent Benchmark](https://alphaxiv.org/abs/2508.00828)
- Limitations the Perfios authors state:
  - Reddit-only sourcing
  - a dataset small enough to be a proof of concept
  - narrow geography
  - basic psychology
  - hallucination on jurisdiction-specific tax rules
  - LLM-judge-only evaluation
  - agentic deployment and cost audit deferred to future work
  - privacy safeguards still open

  — [arXiv 2509.14180](https://arxiv.org/pdf/2509.14180)
- MAST's taxonomy and judge were built on coding, math and general agent frameworks, not finance. — [arXiv 2503.13657v3](https://arxiv.org/html/2503.13657v3)
- CaMeL's provable-security results are on AgentDojo (general tasks), not on finance ledgers with household sharing. — [arXiv 2503.18813](https://arxiv.org/abs/2503.18813)
- India-specific regulation (FREE-AI, SEBI AI/ML, DPDP consent managers from Nov 2026) is new, and AA is a large consented-data rail, but no agent benchmark using AA-shaped data was found. — [RBI](https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=61018); [Sansa Legal](https://www.sansalegal.com/post/dpdp-act-2023-and-rules-2025-phased-implementation-timeline-and-business-compliance-deadlines); [Business Standard](https://www.business-standard.com/amp/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html)

### Inferences (candidate paper contributions that fit FinSight_AI)
1. **Private-ledger benchmark.** Synthetic, India-context household ledgers (UPI, EMIs, SIPs, GST and 80C tax items) with gold answers computed by the Decimal engine. This extends the 28-case lab into a few hundred cases with programmatic gold numbers.
2. **Numeric faithfulness metric and verifier.** Score the fraction of emitted numbers traceable to tool outputs, and compare LLM-only, LLM plus tools, and LLM plus tools plus verifier, with abstention rate as a metric.
3. **Router vs orchestrator vs single-agent ablation.** Measure accuracy, cost in tokens and latency, and label failures with MAST. This tests the hypothesis that shared-ledger finance favors routing.
4. **Consent- and role-aware evaluation.** Adversarial household cases (a partner asks about another member's private account; an advisor's grant expired) plus CaMeL-style injection inside uploaded statements. Report leak rate and utility.
5. **Regulatory traceability.** Map each agent behavior to FREE-AI, SEBI, DPDP and OWASP ASI controls, with audit-log completeness as a measurable property.
6. **Longitudinal outcomes.** Measure whether proactive nudges change goal attainment over months. Nothing citable was found; this would be novel but needs user-study ethics approval.

### Gaps
- An extended search for personal-finance agent benchmarks released in 2026 was not run, so a newer benchmark may exist. The report writer should present "no such benchmark found" as a limited-search finding, not as a definitive claim.
- FinSight_AI's repository was not inspected in this research task. The system description comes from the assignment.
