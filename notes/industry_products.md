# Industry AI Personal Finance Assistants and Robo-Advisors (as of Oct 2026)

Scope note: this covers commercial products only. "Verified" means a regulator filing, an IPO prospectus summary, or a company-reported figure in an official press release. "Marketing claim" means a company projection or a self-description that no one has checked independently. Everything comes from about 30 tool calls. Several sub-questions are only partly sourced, and the Gaps sections say which.

## 1. Bank assistants (Erica, Fargo, Eno, EVA, YONO, iPal): tasks, architecture, limits

### Takeaway
Big-bank assistants are mostly constrained intent classifiers on top of deterministic banking APIs. They are not free-form advisers. The best documented one, Wells Fargo's Fargo, uses an LLM only for intent and entity extraction, strips PII before any LLM call, and runs every computation on bank systems. This is close to FinSight_AI's "deterministic engine + grounded assistant" design. Erica has by far the most use: 20.6M users and nearly 700M interactions in 2025.

### Cited Findings
**Bank of America Erica**
- Launched 2018. In 2025 it had 20.6 million users and nearly 700 million interactions. Cumulative interactions passed 3.2 billion (company-reported, March 10, 2026) — [BofA Newsroom, Mar 2026](https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/03/bofa-ai-and-digital-innovations-fuel-30-billion-client-interacti.html)
- BofA calls it "AI-powered virtual financial assistant" giving "proactive, personalized guidance". The release discloses no model, vendor or resolution-rate details — [BofA Newsroom](https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/03/bofa-ai-and-digital-innovations-fuel-30-billion-client-interacti.html)
- Older figures: as of Oct 2022, nearly 32M customers and more than 1B interactions — [CFPB Chatbot Issue Spotlight, Jun 2023](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf)
- Trade press reports that BofA first added GenAI to its internal "Erica Assist" for employees, with the customer-facing Erica to follow later. This points to a cautious, employee-first rollout of GenAI (headline only, article not fetched) — [The Financial Brand](https://thefinancialbrand.com/news/banking-technology/bofa-augments-internal-ericaassist-with-genai-eyes-erica-virtual-assistant-next-199107)

**Wells Fargo Fargo** (the best-documented architecture)
- Pipeline: speech-to-text runs on the device. A small language model then detects PII and the text is scrubbed and tokenized. Only then is it sent to Google Gemini Flash 2.0, which does **intent and entity extraction only**. Detokenization and all computation stay on Wells Fargo systems, and "the bank's APIs do not pass through the LLM". The CIO describes the bank as "the filters in front and behind" — [VentureBeat, Apr 8 2025](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)
- Interactions were 21.3M in 2023 and 245.4M in 2024, more than double the bank's projection, with over 336M cumulative. More than 80% of usage since the September 2023 rollout has been in Spanish (company-reported) — [VentureBeat](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)
- The bank calls its approach "compound systems": an orchestration layer picks a model for each task, across several models and clouds (Gemini, OpenAI, Llama internally). A separate multi-agent system built partly on LangGraph re-underwrote 15 years of loan documents. Each agent had one job (retrieve, extract, match to system of record, calculate), and a human reviewed only the final output — [VentureBeat](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)
- In 2023 the CFPB described Fargo as using Google Cloud LLMs — [CFPB 2023](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf). Wells Fargo has since expanded its Google Cloud agentic AI (Agentspace) to employees — [Google Cloud blog](https://cloud.google.com/blog/topics/financial-services/wells-fargo-agentic-ai-agentspace-empowering-workers/)

**Capital One Eno**
- SMS chatbot launched March 2017. It handles balances, transactions, payments and card management. The CFPB gives no usage numbers — [CFPB 2023](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf)

**Other US banks (CFPB, 2023):** Truist's assistant is built on Amazon Lex. U.S. Bank's Smart Assistant is rule-based. Morgan Stanley was piloting GPT-4 for its advisers — [CFPB 2023](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf)

**HDFC Bank EVA (India)**
- Launched March 2017 on the HDFC website and built by Bengaluru-based Senseforth AI Research using NLP. Its scope is FAQ-style: product details, fees, how to apply, IFSC codes. 2017 figures: more than 530,000 unique users, over 85% accuracy (company-reported), and either 2.7M or 1.2M queries in six months (the article contradicts itself) — [Analytics India Magazine, 2017](https://www.analyticsindiamag.com/hdfc-banks-eva-becomes-indias-largest-smartest-chatbot/)

**SBI YONO (India)**
- Nearly 10 crore (about 100M) YONO customers as of Dec 2025, with a target of 20 crore in two years. YONO 2.0 (launched Dec 15, 2025) brings internet and mobile banking onto one code base and a common customer-journey core. The coverage mentions no AI assistant features — [The Week/PTI, Dec 14 2025](https://www.theweek.in/wire-updates/business/2025/12/14/dcm18-biz-sbi-yono.html)
- SBI plans to grow its digital support staff to 10,000 by March 2026 to help customers move to digital channels. Humans are still needed for digital onboarding — [Angel One](https://oga-prod.angelone.in/news/personal-finance/sbi-launches-yono-2-0-plans-to-expand-digital-support-staff-to-10000-by-march-2026)

### Inferences
- In regulated banks the main pattern is: LLM as a natural-language front end to deterministic APIs, PII redaction before any model sees text, and no LLM-generated numbers. FinSight_AI can cite Fargo as industry precedent for its split between engine and assistant.
- Indian bank assistants (EVA, YONO) are documented mostly as FAQ and transaction NLP bots. I found no public evidence of LLM-based advisory features in them.

### Gaps
- I found no source for ICICI iPal (launch, stats or architecture).
- Erica's architecture and resolution rate are not public. Its current GenAI status is known only from a headline.
- No recent Eno usage figures were found.

## 2. Fintech assistants and 2025–2026 LLM agents

### Takeaway
From 2025 to 2026 the field moved from chat-on-top-of-data to agents that act: Cleo 3.0, Revolut AIR, Public's Agentic Brokerage, Robinhood Cortex, ChatGPT's personal finance feature with Plaid, Intuit apps inside ChatGPT, and Monarch MCP. Most products separate information from action. Actions are limited to narrow, reversible operations: freezing a card, managing subscriptions, building a trade that the user must still place. Mint's 2024 shutdown shows the platform risk of free, aggregator-only budgeting apps.

### Cited Findings
**Cleo (US/UK)**
- Cleo 3.0 (Jul 29, 2025) added real-time voice, memory of goals and spending habits, and "chain-of-thought" reasoning, running on OpenAI's o3 model — [TNW, Jul 2025](https://thenextweb.com/news/cleo-launches-ai-money-coach-fix-spending-habits)
- Marketing claims, not verified: more than 1M paid subscribers expected in 2025, ARR projected at $250M (up 82%), and "20x" the engagement of bank apps — [TNW](https://thenextweb.com/news/cleo-launches-ai-money-coach-fix-spending-habits)
- Regulatory action: on Mar 27, 2025 Cleo agreed to pay **$17M to the FTC** over deceptive cash-advance claims. Almost no one got the advertised amounts, "instant" advances needed an extra fee, and the company blocked cancellations — [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2025/03/cash-advance-company-cleo-ai-agrees-pay-17-million-result-ftc-lawsuit-charging-it-deceives-consumers)

**Klarna AI assistant**
- Built on OpenAI and launched early 2024. It handled 2.3M chats in its first month, about two-thirds of customer-service chats, and Klarna projected a $40M profit gain (company claims) — [PromptLayer summary](https://blog.promptlayer.com/klarna-customer-service-from-ai-first-to-human-hybrid-balance/)
- In 2025 Klarna reversed course and pledged customers can "always speak to a real person". The CEO said "Cost was a predominant evaluation factor", which led to "lower quality", and Klarna rehired human agents — [PromptLayer summary of Bloomberg, May 2025](https://blog.promptlayer.com/klarna-customer-service-from-ai-first-to-human-hybrid-balance/)

**Revolut AIR**
- Launched Apr 9, 2026 in the UK. Information features include spending breakdowns, investment tracking and trip budgets. Actions include managing subscriptions, card controls, freezing a lost card and buying an eSIM. It reads only data the user can already see in the app, uses "third-party AI partners" (not named), and Revolut claims zero data retention and no training on user data — [Revolut newsroom](https://www.revolut.com/news/revolut_enters_new_era_of_money_intelligence_with_launch_of_ai_assistant/)

**Robinhood Cortex**
- Launched March 2025 for Gold subscribers. It offers real-time market analysis, stock summaries and help building trades based on the user's risk tolerance. It **does not execute trades** — [Benzinga, Mar 2025](https://www.benzinga.com/25/03/44530226/robinhood-launches-ai-investment-tool-cortex-to-expand-market-analysis-access-a-premium-research-assistant-right-)

**Public (Alpha, then Agentic Brokerage)**
- Public first used GPT-4 for its Alpha research co-pilot — [Finextra](https://www.finextra.com/pressarticle/96889/public-taps-gpt-4-for-investment-research-tool)
- On Nov 17, 2025 Public announced "Agentic Brokerage", with three pillars: Research, Creation ("Generated Assets", which are AI-built thematic indexes) and Action (agents that manage risk, automate cash sweeps and run strategies such as "trim banks if Fed cuts rates"). Launch was planned for early 2026. The announcement describes no guardrails — [FX News Group](https://fxnewsgroup.com/forex-news/retail-forex/public-introduces-new-phase-of-its-ai-vision-agentic-brokerage/)

**Intuit + OpenAI; ChatGPT personal finance**
- Nov 18, 2025: Intuit signed a multi-year deal with OpenAI worth more than $100M. TurboTax, Credit Karma, QuickBooks and Mailchimp became apps inside ChatGPT, and with the user's permission they can read financial data and complete tasks such as refund estimates and credit offers. Intuit Assist, launched 2023, is Intuit's assistant across its own products. Intuit did not say who is liable for AI errors — [TechCrunch](https://techcrunch.com/2025/11/18/intuit-signs-100m-deal-with-openai-to-bring-its-apps-to-chatgpt)
- May 15, 2026: OpenAI launched a personal finance experience in ChatGPT for US Pro users. Accounts link through Plaid (more than 12,000 institutions), and it includes a dashboard and Q&A on goals, spending, scenarios, investment risk and subscriptions, attributed to GPT-5.5. OpenAI says it is "not a replacement for professional financial advice". Intuit actions (credit card applications, tax estimates, booking a tax expert) were announced as coming soon — [PYMNTS, May 2026](https://www.pymnts.com/artificial-intelligence-2/2026/chatgpt-connects-financial-accounts-to-deliver-personal-finance-insights/)

**Monarch Money**
- Monarch has an in-app AI Assistant, with a "Faster AI Assistant" update on Sep 29, 2026. It launched the **Monarch MCP** on Oct 21, 2026, which lets Claude, ChatGPT and other assistants work with a user's Monarch data — [Monarch What's New](https://www.monarch.com/whats-new)

**Mint shutdown**
- Intuit announced around Nov 1, 2023 that Mint would close and moved users to Credit Karma. Mint shut down Mar 23, 2024, later than the original Dec 31, 2023 date. It had 13M registered users in 2020. Intuit gave no official reason. The founder said it had been "in maintenance mode the last eight years" — [Wikipedia: Intuit Mint](https://en.wikipedia.org/wiki/Intuit_Mint); [Bloomberg](https://www.bloomberg.com/news/articles/2023-11-01/intuit-winds-down-personal-finance-app-mint-shifts-users-to-credit-karma)

### Inferences
- **Two kinds of products are converging**: (a) LLM "hubs" that pull in finance data or apps (ChatGPT + Plaid + Intuit apps, Monarch MCP), and (b) finance apps adding agents (Revolut AIR, Cleo, Public). Neither publishes how it checks the accuracy of numbers. That leaves a gap for FinSight_AI to claim: a deterministic engine as the source of truth.
- Mint's ad and lead-gen model shows the risk of free aggregators. Paid alternatives (Monarch, Copilot, YNAB) gained users, but I found no reliable figures in this pass.

### Gaps
- I did not retrieve sources for Copilot Money AI, Rocket Money, YNAB, Nubank, PayPal or Betterment/Wealthfront AI assistants. Intuit Assist architecture was not found either. Robinhood Cortex's underlying models are not disclosed.
- I found no independent check of Cleo's subscriber or ARR numbers.

## 3. Robo-advisors (US and India): AUM, methods, regulation

### Takeaway
US robo-advisors are SEC-registered investment advisers that run rules-based portfolio engines: mean-variance/MPT allocation, rebalancing and tax-loss harvesting. Their recent growth is mostly in cash products. Wealthfront's IPO prospectus showed 53% of its $88.2B platform assets in cash. India's leaders (Groww, Zerodha Coin, Kuvera) are mostly execution and distribution platforms for direct mutual funds, not discretionary robo-advisers. SEBI now requires investment advisers to disclose AI use (Dec 2024) and makes every regulated entity solely responsible for AI outputs (Feb 2025).

### Cited Findings
**US**
- Wealthfront: $88.2B platform assets as of Jul 31, 2025 (about 53% cash management, 47% advisory), more than 1.3M funded clients, and $339M revenue in the 12 months to Jul 31, 2025. IPO terms were set Dec 2, 2025 (verified, from prospectus) — [Renaissance Capital](https://www.renaissancecapital.com/IPO-Center/News/115274/investing-robo-advisor-wealthfront-sets-terms-for-450-million-ipo). It priced at $14, the top of the range — [IPO Scoop](https://www.iposcoop.com/the-ipo-buzz-wealthfront-wlth-prices-its-ipo-at-14-top-of-the-range/)
- 2023 estimates: Betterment had about $39B average AUM and about $153M revenue, and Wealthfront about $43B and about $184M. Growth came mainly from high-yield cash accounts (Sacra estimates, not audited) — [Sacra](https://sacra.com/research/wealthfront-betterment-robo-advisor-resurrection/)
- Betterment bought Ellevest's automated investing business and Goldman Sachs' digital investing (Marcus Invest) accounts, a sign of consolidation — [Citybiz](https://www.citybiz.co/article/665442/betterment-acquires-ellevests-automated-investing-business/); [Seeking Alpha PR](https://seekingalpha.com/pr/19695287-betterment-to-acquire-digital-investing-accounts-from-goldman-sachs)
- Incumbents lead on scale. Year-end 2020: Vanguard Personal Advisor Services about $212B, Schwab digital about $57.9B, Betterment about $18.1B, Wealthfront about $15.9B (dated, 2021 article) — [InvestmentNews, Mar 2021](https://investmentnews.com/fintech/top-5-largest-robo-advisers-by-aum/204294)
- Global Predictions falsely claimed to offer tax-loss harvesting, which shows TLH is a feature regulators check — [SEC 2024-36](https://www.sec.gov/newsroom/press-releases/2024-36)

**India**
- Groww (FY25 DRHP): ₹1.1 trillion in MF AUM from its clients, ₹34,028 crore in SIP inflows, about 39% of direct-plan SIP inflows and about 12% of all SIP inflows. It is the largest distributor of direct plans and fourth among all distributors — [Business Standard, Sep 2025](https://www.business-standard.com/amp/markets/mutual-fund/groww-drhp-reveals-mf-clout-125091701274_1.html)
- Zerodha Coin is a direct mutual fund platform. Both Groww and Zerodha also run their own AMCs, which grew AUM up to 3x in a year — [Zerodha support](https://support.zerodha.com/category/mutual-funds/understanding-mutual-funds/about-coin/articles/what-is-coin); [Outlook Business](https://www.outlookbusiness.com/amp/story/markets/groww-zerodha-amc-businesses-outpace-industry-as-aum-surges-up-to-3x-in-a-year)

**Regulation**
- **SEBI (Investment Advisers) (Second Amendment) Regulations, 2024** (Notification SEBI/LAD-NRO/GN/2024/219, Dec 16, 2024): advisers must tell clients how far they use AI tools in giving advice (Reg. 18 disclosures) — [Taxmann](https://taxmann.com/post/blog/sebi-mandates-investment-advisers-to-disclose-use-of-ai-tools-to-clients-in-providing-investment-advice)
- **SEBI (Intermediaries) (Amendment) Regulations, 2025** (Feb 2025): any SEBI-regulated person using AI/ML, built in-house or bought, is "solely responsible" for data privacy and security, **for the AI output**, and for legal compliance, however much the tool is used — [Lexplosion, Feb 14 2025](https://lexplosion.in/sebi-issues-guidelines-on-ai-usage-entities-using-ai-ml-tools-responsible-for-data-security-ai-generated-outputs-and-compliance-with-applicable-laws/)
- SEBI consultation paper, Jun 20, 2025, on responsible AI/ML in securities markets. Proposed principles: equality, accountability, transparency/explainability/auditability, and safety. Firms would disclose AI use in advisory, research and algo trading, keep records of model development, testing and monitoring, and validate models. I found no source saying it has been finalized — [Taxmann](https://www.taxmann.com/post/blog/sebi-proposes-ai-ml-governance-framework-for-securities-markets)

### Inferences
- If FinSight_AI gives personalised investment recommendations in India, it may need SEBI IA registration. In that case it must disclose AI use and is liable for AI outputs. A deterministic engine whose outputs can be audited directly supports SEBI's proposed "auditability" principle.
- "Robo" growth at Wealthfront and Betterment is increasingly cash-driven, so an integrated budgeting, saving and investing view matters more than portfolio optimisation alone.

### Gaps
- I did not retrieve current (2025–26) AUM for Betterment, Vanguard Digital Advisor or Schwab Intelligent Portfolios, or AUM and user counts for INDmoney, ET Money, Kuvera, Scripbox, Fi or Jupiter.
- I did not get the SEBI algo-trading framework for retail investors (2025) or the status of the RBI FREE-AI framework.
- No source was fetched on whether the SEBI AI/ML guidelines were finalized after June 2025.

## 4. Documented failures and shortcomings

### Takeaway
The failures on record are mostly **governance and consumer-protection failures** (misleading AI claims, deceptive fees, doom loops, sacrificing quality for cost), not documented hallucinations in production finance bots. Regulators have acted on claims (SEC "AI washing", FTC v. Cleo) and on the risk of chatbots that trap users (CFPB).

### Cited Findings
- **SEC "AI washing"** (Mar 18, 2024): settled charges against Delphia ($225K) and Global Predictions ($175K). Delphia claimed AI/ML capabilities it did not have. Global Predictions called itself the "first regulated AI financial advisor", falsely claimed tax-loss harvesting, and broke the Marketing Rule — [SEC Press Release 2024-36](https://www.sec.gov/newsroom/press-releases/2024-36)
- **CFPB Chatbot Issue Spotlight** (Jun 2023):
  - About 37% of the US population (more than 98M people) used a bank chatbot in 2022, projected to reach 110.9M by 2026.
  - Risks it lists: inaccurate or fabricated LLM output, "doom loops" with no way to reach a human (sometimes causing late fees), privacy and security exposure in chat logs, impersonation by fake bots, failure to recognise disputes, and poor service for people with limited English.
  - It cites a survey finding 80% of consumers left a chatbot interaction more frustrated.

  — [CFPB PDF](https://files.consumerfinance.gov/f/documents/cfpb_chatbot-issue-spotlight_2023-06.pdf)
- **FTC v. Cleo AI** ($17M, Mar 2025): deceptive advertising of advances and fees, and blocked cancellations — [FTC](https://www.ftc.gov/news-events/news/press-releases/2025/03/cash-advance-company-cleo-ai-agrees-pay-17-million-result-ftc-lawsuit-charging-it-deceives-consumers)
- **Klarna's reversal**: the CEO admitted that optimising for cost lowered quality, and Klarna brought back human agents — [PromptLayer](https://blog.promptlayer.com/klarna-customer-service-from-ai-first-to-human-hybrid-balance/)
- **Liability is unclear**: Intuit did not say who is liable for errors in AI recommendations inside ChatGPT — [TechCrunch](https://techcrunch.com/2025/11/18/intuit-signs-100m-deal-with-openai-to-bring-its-apps-to-chatgpt). OpenAI's disclaimer says ChatGPT finance is "not a replacement for professional financial advice" — [PYMNTS](https://www.pymnts.com/artificial-intelligence-2/2026/chatgpt-connects-financial-accounts-to-deliver-personal-finance-insights/)
- **Trust**: an Aug 2026 Gallup poll, as reported by AP, is headlined "Some US adults are using AI for financial guidance but few trust it". I could not fetch the exact percentages — [Local10/AP](https://www.local10.com/business/2026/08/07/some-us-adults-are-using-ai-for-financial-guidance-but-few-trust-it-gallup-poll-finds/)
- **Fragmentation and abandonment**: Mint shut down and pushed 13M+ users to another product — [Wikipedia](https://en.wikipedia.org/wiki/Intuit_Mint). SBI needs about 10,000 staff to help customers use its digital channels — [Angel One](https://oga-prod.angelone.in/news/personal-finance/sbi-launches-yono-2-0-plans-to-expand-digital-support-staff-to-10000-by-march-2026)
- **Explainability**: SEBI's Jun 2025 proposal names transparency, explainability and auditability as core principles. This implies current practice falls short — [Taxmann](https://www.taxmann.com/post/blog/sebi-proposes-ai-ml-governance-framework-for-securities-markets)

### Inferences
- The most defensible differentiators: (1) never market capabilities the engine does not have (the AI-washing precedent); (2) always offer a path to a human or out of the loop; (3) show the formula and inputs behind every number, which addresses SEBI's explainability principle and the CFPB's accuracy concern.
- Fargo's design, where the LLM never touches APIs or PII, is the clearest public example of reducing hallucination by design.

### Gaps
- I found no well-documented case of a production finance chatbot giving hallucinated financial advice that caused measurable harm. Most evidence is general (CFPB) or concerns governance.
- Exact trust percentages are missing (Gallup 2026 page fetch failed; I did not fetch other surveys such as TD Bank or Credit One).
- I did not retrieve McKinsey, BCG or Gartner analyses.

## 5. Multi-agent or specialised-bot products and how they appear in one environment

### Takeaway
Publicly documented multi-agent designs are mostly **behind the scenes**: Wells Fargo's LangGraph loan agents, Fargo's per-task model orchestration, and Intuit's "select AI agents". To the consumer they are presented as **one assistant persona**: Erica, Fargo, AIR, Cleo, Intuit Assist. The visible "multi-app" pattern is the LLM-hub model: ChatGPT hosting Intuit apps and Plaid data, and Monarch exposing data through MCP to Claude and ChatGPT.

### Cited Findings
- Wells Fargo: an agent network with one role per agent (retrieval, extraction, matching to system of record, calculation), partly on LangGraph, with a human reviewing the final output. Fargo is a "compound system" that routes each task to a different model — [VentureBeat](https://www.venturebeat.com/ai/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm)
- Intuit uses OpenAI models to power "select AI agents across its platform". The user sees Intuit Assist as one assistant across products — [TechCrunch](https://techcrunch.com/2025/11/18/intuit-signs-100m-deal-with-openai-to-bring-its-apps-to-chatgpt)
- ChatGPT acts as one front end that hosts several specialised finance apps (TurboTax, Credit Karma, QuickBooks, Mailchimp) plus Plaid-linked data — [TechCrunch](https://techcrunch.com/2025/11/18/intuit-signs-100m-deal-with-openai-to-bring-its-apps-to-chatgpt); [PYMNTS](https://www.pymnts.com/artificial-intelligence-2/2026/chatgpt-connects-financial-accounts-to-deliver-personal-finance-insights/)
- Public splits its agent product into Research, Creation and Action functions under one "Agentic Brokerage" brand — [FX News Group](https://fxnewsgroup.com/forex-news/retail-forex/public-introduces-new-phase-of-its-ai-vision-agentic-brokerage/)
- Revolut AIR is one assistant covering both information and actions (cards, subscriptions, eSIM) — [Revolut](https://www.revolut.com/news/revolut_enters_new_era_of_money_intelligence_with_launch_of_ai_assistant/)
- Monarch MCP (Oct 2026) exposes a finance app's data as a tool for general assistants — [Monarch](https://www.monarch.com/whats-new)

### Inferences
- The common pattern is **one persona in front and specialist agents or tools behind**, with a separate step for actions (Cortex and Public build or suggest actions, the user confirms). FinSight_AI can present one assistant that routes to specialist modules (budget, bills, goals, investments, tax) sitting on a shared deterministic engine. That matches industry practice, and FinSight_AI could also surface which module and formula produced each answer.
- I found no consumer product that shows multiple named bots to the user. Multi-agent design appears as an internal implementation choice.

### Gaps
- No public engineering detail on agent orchestration was found for Cleo, Revolut AIR, Robinhood Cortex or Intuit Assist.
- Indian products' multi-agent designs are undocumented in sources I retrieved. This includes INDmoney's AI features, ET Money and Jupiter.
