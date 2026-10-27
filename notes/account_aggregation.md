# Account Aggregation and Open-Banking Integration for Personal Finance Apps (India Emphasis)

Research date: 27 Oct 2026. Every claim has a source URL. Older facts carry their dates. Vendor and blog sources are flagged where relevant.

## 1. How do US aggregators work (Plaid, MX, Yodlee, Finicity, Akoya), what is the status of CFPB Section 1033 and FDX in 2026, and what are the known failures?

### Takeaway
US account aggregation is still a mix of credential-based screen scraping and token-based APIs. The industry is converging on the FDX API standard. The CFPB Section 1033 rule (finalized Oct 2024) is enjoined and being rewritten as of 2026, so its compliance dates no longer bind anyone. Bank data-access fees (JPMorgan–Plaid, Sep 2025) are now an open commercial and legal question. The main documented failures are privacy (Plaid's $58M settlement over credential collection and login screens styled like the user's bank) and messy transaction data.

### Cited Findings
- **Original schedule:** The CFPB finalized the Section 1033 open banking rule in Oct 2024 with phased compliance. The first date, 1 Apr 2026, applied to the largest depository and nondepository data providers. — [Cozen O'Connor, 9 Apr 2026](https://www.cozen.com/news-resources/publications/2026/section-1033-compliance-date-open-banking-rule-enjoined-and-under-reconsideration)
- **Injunction and reconsideration:** A federal court in the Eastern District of Kentucky enjoined enforcement, so 1 Apr 2026 triggered nothing. The CFPB opened reconsideration with an Advance Notice of Proposed Rulemaking (ANPR) in Aug 2025 and may revise, replace or withdraw parts of the rule. — [Cozen O'Connor](https://www.cozen.com/news-resources/publications/2026/section-1033-compliance-date-open-banking-rule-enjoined-and-under-reconsideration)
- **Detail as of 8 Jun 2026:**
  - The preliminary injunction was granted around 29 Oct 2025 and lasts until reconsideration ends. The rule is enjoined, not vacated.
  - The 22 Aug 2025 ANPR reopened four areas: third-party eligibility, data security, data privacy, and fees.
  - The original tiers were each 1 Apr of 2026, 2027, 2028, 2029 and 2030. All are effectively suspended.
  - — [Open Banking Tracker, reviewed 8 Jun 2026](https://www.openbankingtracker.com/guides/section-1033-status)
- **FDX recognition:** On 8 Jan 2025 the CFPB recognized Financial Data Exchange (FDX) as the first standard-setting body under 1033, for a term through Jan 2030. The market is converging on FDX APIs and away from screen scraping whatever the rule's fate. — [Open Banking Tracker](https://www.openbankingtracker.com/guides/section-1033-status); [CFPB recognition order](https://files.consumerfinance.gov/f/documents/cfpb_standard-setter-decision-and-order-of-recognition-fdx_2025-01.pdf)
- **FDX adoption:** FDX's own announcement gives an earlier milestone of 94 million accounts on the FDX API. I did not fetch the page, so its date is unverified. — [FDX](https://financialdataexchange.org/fdx-feed/fdx-hits-94-million-accounts-cfpb-publishes-fdxs-standard-setting-application/)
- **JPMorgan–Plaid fee deal (16 Sep 2025):**
  - JPMorgan Chase and Plaid extended their 2018 data-access agreement. Plaid will now pay fees for data that was previously free. Terms were not disclosed. JPMorgan first told fintechs about the fees in Jul 2025.
  - Fintech groups (FDATA, the Financial Technology Association, the American Fintech Council) argue such fees are unlawful under the 2010 statute. A Stripe executive called them "extortionate."
  - The Bank Policy Institute estimates there are about 120 data aggregators.
  - — [Banking Dive, 16 Sep 2025](https://www.bankingdive.com/news/plaid-pay-jpmorgan-data-open-banking-fintech/760264/)
- **Plaid privacy class action:** Plaintiffs alleged Plaid collected bank login credentials and harvested and sold financial data without consent. They also alleged Plaid designed login screens that looked like individual banks' screens without telling users they were not dealing with their bank (lead plaintiff Cottle, Venmo sign-up in 2019). Plaid settled for $58M, approved by Magistrate Judge Donna Ryu across five combined suits. The settlement was in 2021 and approval came around 2022. — [Glenbrook](https://glenbrook.com/payments_news/judge-approves-settlement-ordering-plaid-to-pay-58-million-for-selling-consumer-data/); [JURIST, Aug 2021](https://www.jurist.org/news/2021/08/plaid-agrees-to-pay-58-million-in-data-privacy-class-action-lawsuit/)
- **Data heterogeneity (2017):** Plaid said it received data from more than 9,600 institutions, each with its own formatting, naming and category conventions. Bank-supplied categories vary in accuracy and taxonomy, and keyword rules misfire (for example, a donation text containing "DIRECTV" is read as a cable charge). — [Plaid blog, 24 Aug 2017](https://plaid.com/blog/making-sense-of-messy-data/)

### Inferences
- For FinSight_AI (India), the US is useful mainly as a cautionary tale. Credential-sharing and scraping created both legal liability and breakage. India's AA framework was designed to avoid this by being token- and consent-based by regulation.
- Who pays for data access is unresolved even in mature markets. India now faces the same issue through the Sahamati fee rate card (see section 3).

### Gaps
- I did not fetch vendor-specific architecture or coverage facts for MX, Yodlee/Envestnet, Finicity/Mastercard or Akoya (the bank-owned, API-only network). These include connection success rates, percentage of API versus scraped traffic, and Yodlee's ownership change. No figures are given here; the report writer should not invent them.
- No independent, quantified connection-breakage rates (for example, the percentage of US links failing each month) were found.
- No CFPB re-proposed 1033 rule text dated Jul–Oct 2026 was found. The status after Jun 2026 is unverified.

## 2. What is the status of EU/UK open banking (PSD2, PSD3/PSR, FIDA, UK adoption, TrueLayer/Tink/GoCardless), and what are its shortcomings?

### Takeaway
The UK is the most mature API-mandated market: 18.8M user connections, more than 1B cumulative payments and more than 100B API calls by mid-2026. Its aggregate API availability is about 99.8%. In the EU, PSD3/PSR was agreed politically in Nov 2025 but is not expected to apply until about 2028. It responds directly to PSD2's shortcomings: weak API performance, no consent dashboards, and repeated strong customer authentication (SCA). FIDA (open finance beyond payment accounts) has been on and off since 2025, and its Oct 2026 status is unverified.

### Cited Findings
- **UK, June 2026:**
  - 18.81M user connections (down 4.2% month on month).
  - 40.16M open banking payments that month: 32.43M single domestic payments and 7.73M sweeping VRPs (up 6.7%).
  - More than 1B cumulative payments and more than 100B cumulative API calls across the CMA9 banks.
  - 2.81B API calls in June, a record.
  - Average response time 349 ms. Weighted availability 99.80%, unweighted 99.35%.
  - — [Open Banking Ltd, 30 Jul 2026](https://www.openbanking.org.uk/news/open-banking-surpasses-one-billion-payments-and-100-billion-api-calls/)
- **UK, earlier milestone:** 15M users in Jul 2025. — [Open Banking Ltd](https://www.openbanking.org.uk/news/open-banking-surges-to-15-million-uk-users-as-july-marks-record-adoption/)
- **PSD3/PSR timeline:**
  - Political agreement 27 Nov 2025.
  - Final compromise texts 23 Apr 2026. ECON committee approval 5 May 2026.
  - Official Journal publication expected H2 2026. Entry into force 20 days after publication.
  - Most PSR rules apply about 21 months after entry into force (about 2028).
  - — [Open Banking Tracker, reviewed 26 Aug 2026](https://www.openbankingtracker.com/guides/psd3-psr-readiness)
- **PSD3/PSR changes aimed at PSD2's shortcomings:**
  - Banks must give customers a permission dashboard to view and revoke third-party access, kept in sync with the third-party provider.
  - The data API must perform "at least as well as" the bank's own app, measured by harmonised KPIs. The thresholds will come from European Banking Authority (EBA) technical standards that are not yet published.
  - The fallback-interface obligation is replaced by a supervisory contingency mechanism.
  - SCA is required at first access; after that the account information provider may apply its own SCA, in roughly a 180-day window.
  - — [Open Banking Tracker](https://www.openbankingtracker.com/guides/psd3-psr-readiness)
- **FIDA:** In Feb 2025 a leaked draft of the Commission's 2025 work programme put FIDA up for withdrawal. The published programme kept it as "pending." — [finAPI, Feb/Mar 2025](https://www.finapi.io/en/fida-regulation-status-pending/)
- Later press reported another Commission move to cancel FIDA and then a reversal. — [The Paypers](https://thepaypers.com/fintech/news/european-commission-to-reportedly-cancel-fida-bill); [Börsen-Zeitung](https://www.boersen-zeitung.de/banken-finanzen/eu-kommission-haelt-doch-an-neuregelung-von-open-finance-fest); [Linklaters](https://techinsights.linklaters.com/post/102k003/its-complicated-the-eus-on-again-off-again-relationship-with-open-finance). I did not read these articles, so their dates and details are unverified.

### Inferences
- The fact that PSD3 legislates dashboards and API parity means that, under PSD2, consent visibility and API quality were real problems. India's AA design already centralises consent in the AA app, which partly anticipates this.
- Monthly UK user connections fell (down 4.2% month on month), so adoption is not monotonic.

### Gaps
- No verified 2026 facts were gathered on TrueLayer, Tink (Visa) or GoCardless (bank-account-data product, coverage, pricing). These need separate sourcing.
- FIDA's exact status as of Oct 2026 (withdrawn, or in trilogue) could not be confirmed from a primary source.
- No EU-wide adoption figures were collected.

## 3. India: how does the AA framework work (RBI, Sahamati, ReBIT, FIU/FIP, consent), what are the 2025–26 adoption numbers, AA providers and data coverage, and how do UPI, BBPS/Bharat Connect, CAS, NSDL/CDSL and DPDP fit in?

### Takeaway
The AA network is consent-based infrastructure at scale: more than 500M fulfilled consents, more than 310M accounts linked by customers and more than 1,100 regulated entities live by Sep 2026. It is overwhelmingly used for lending. Coverage and reliability are uneven: bank–AA pairs differ, FDs, joint and NRE accounts are missing, and fetches can fail or return stale data. RBI recognised Sahamati as the self-regulatory organisation (SRO) in Jun 2026 and has ordered AA interoperability by 31 Dec 2026. UPI handles about 24B transactions a month but offers no read-API for personal-finance apps. Under DPDP, the main duties begin around May 2027.

### Cited Findings: AA architecture and roles
- **Roles:** AAs are RBI-licensed NBFC-AAs that act as consent managers between Financial Information Providers (FIPs: banks, AMCs/RTAs, insurers, depositories) and Financial Information Users (FIUs: lenders, advisers, brokers, insurers). They move data only with customer consent. — [MediaNama, 12 Oct 2026](https://www.medianama.com/2026/10/223-sahamati-bg-mahesh-rbi-account-aggregator-interoperability/); [Fold docs, Apr 2023](https://docs.fold.money/introduction-to-aa-for-fintechs)
- **User flow:**
  1. The user creates an AA handle.
  2. Account discovery and linking by OTP (one-time only).
  3. The FIU raises a consent request, which the user approves in the AA app.
  4. The FIU fetches data from the FIP under that consent.
  - ReBIT writes the API and data specifications, and adding or removing any field needs a ReBIT amendment. Technology service providers (TSPs) usually handle encryption and decryption for FIUs. — [Fold docs, Apr 2023](https://docs.fold.money/introduction-to-aa-for-fintechs)
- **Financial information (FI) types in the spec:** bank and NBFC deposits, SIPs, commercial paper, certificates of deposit, shares, bonds, mutual fund units, ETFs, IDRs, AIF/CIS/REIT/InvIT units, NPS balances, insurance policies and GST returns. — [Fold docs](https://docs.fold.money/introduction-to-aa-for-fintechs)
- **Consumer apps using AA (as of 2023):** Fi Money, Jupiter and IndMoney used AA for net-worth and balance tracking. — [Fold docs](https://docs.fold.money/introduction-to-aa-for-fintechs)
- **FIU eligibility:** FIUs and FIPs are expected to be regulated by RBI, SEBI, IRDAI or PFRDA. Eligible categories include banks, NBFCs, payment system operators and BBPS entities, SEBI intermediaries (including mutual funds and portfolio managers), insurers and insurance intermediaries, and PFRDA PoPs. Setu offers itself as a TSP that "can help you become an FIU." — [Setu docs](https://docs.setu.co/data/account-aggregator/licenses-and-go-live/licenses)
- **Further requirements (as of Mar 2026):**
  - Under RBI's Oct 2023 circular, a regulated FIU that holds financial information must also join as an FIP.
  - Certification is done by a Sahamati-empanelled auditor against ReBIT specs.
  - Ongoing duties: quarterly self-tests, an IS audit every 2 years, and re-certification when specs change.
  - — [CASParser blog, Mar 2026 (vendor, competing product)](https://casparser.in/blog/state-of-account-aggregator-2026/)

### Cited Findings: Adoption (2025–2026)
- **Ecosystem totals (Sep 2026):**
  - More than 500M fulfilled consents.
  - More than 1,100 regulated entities live.
  - More than 2.8B financial accounts enabled for sharing.
  - More than 310M accounts linked by customers.
  - More than 6B data fetches.
  - — [Sahamati, 2 Sep 2026](https://sahamati.org.in/media-article/account-aggregator-crosses-500-million-consents-as-india-marks-5th-aa-foundation-day/)
- **AA-enabled lending, FY26:**
  - ₹3.82 lakh crore across 3.68 crore loans, about 1.08% of GDP.
  - 8.4% of retail and MSME lending by value, 11.8% by volume.
  - 18.2% of loans by volume went to new-to-credit borrowers.
  - Personal finance and wealth are named use cases, but lending is the largest.
  - Planned new data sources: GST, CBDT and EPFO.
  - — [Sahamati, 2 Sep 2026](https://sahamati.org.in/media-article/account-aggregator-crosses-500-million-consents-as-india-marks-5th-aa-foundation-day/)
- **FY25 consent share:** NBFCs held about 60% of AA consents. — [Business Standard, Oct 2025](https://www.business-standard.com/finance/news/nbfcs-lead-account-aggregator-consents-in-fy25-with-60-share-125100600872_1.html). I saw only the headline, not the article.
- **SRO recognition:** RBI recognised Sahamati as the SRO for the AA ecosystem in Jun 2026. — [Business Standard](https://www.business-standard.com/finance/news/rbi-recognises-sahamati-foundation-as-sro-for-account-aggregator-ecosystem-126060501286_1.html); [Sahamati](https://sahamati.org.in/media-article/rbi-sro-recognition-account-aggregator-ecosystem/)
- **Interoperability (MediaNama, 12 Oct 2026):**
  - RBI has mandated AA interoperability, with a target of 31 Dec 2026, so users will not need to pick an AA according to which AA their bank supports.
  - Today, technical onboarding of a new AA takes about 30 minutes, but a large bank's legal and compliance work takes 3–6 months, and banks re-audit AAs that are already regulated.
  - Still unresolved: the architecture (FIP-to-every-AA or AA-to-AA routing), who is liable for failed fetches, the fee model, and whether existing consents carry over. Specs were not yet released.
  - — [MediaNama, 12 Oct 2026](https://www.medianama.com/2026/10/223-sahamati-bg-mahesh-rbi-account-aggregator-interoperability/)

### Cited Findings: Providers, coverage and shortcomings
All figures below are from a vendor blog dated Mar 2026 (CASParser, which sells a competing product), so treat them as indicative.
- **AAs:** 17 operating, 13 with live FIP integrations.
  - Most live FIPs: Anumati (80+), CAMS AA (70+), OneMoney (65+), Finvu (60+), NADL (60+).
  - Upmint, Cygnet, PB Financial and Scoreme had zero live FIPs.
  - — [CASParser, Mar 2026](https://casparser.in/blog/state-of-account-aggregator-2026/)
- **FIPs:** 135+ live: 72 banks, 57 insurers, 2 depositories, 2 RTAs, 3 NPS CRAs, 1 GSTN, 6 NBFCs, and 40 AMCs via RTAs. Interconnection is uneven: LIC is on 1 AA while SBI Life is on 10. — [CASParser](https://casparser.in/blog/state-of-account-aggregator-2026/)
- **Coverage gaps:**
  - Fixed and recurring deposits: only about 40% of banks.
  - Joint accounts, NRE/NRO and non-sole-proprietor current accounts: not supported.
  - Bonds, G-Secs, EPF and PPF: still "proposed."
  - Depository transaction history: capped at 2 years.
  - — [CASParser](https://casparser.in/blog/state-of-account-aggregator-2026/)
- **Costs (unverified against a primary Sahamati document):**
  - The Sahamati rate card, effective 1 Nov 2026, sets up to ₹96 per account for 20 years of investment history.
  - First-year total cost to become an FIU: ₹5–25 lakh (unsourced "industry estimate").
  - Integration time: 5–10 months (author's estimate).
  - — [CASParser](https://casparser.in/blog/state-of-account-aggregator-2026/)
- **Reliability problems (2023):**
  - A bank marked "live" may not reliably provide data.
  - Account discovery fails because of bank API downtime.
  - OTP linking errors occur.
  - Fetches fail on weekends, and data can be incomplete or 1–2 days stale.
  - Builders need redundancy, exception handling, and use of Sahamati's grievance portal.
  - — [Fold docs, Apr 2023](https://docs.fold.money/introduction-to-aa-for-fintechs)
- **Mutual funds and depositories as FIPs:** Sahamati has a mutual-funds-on-AA explainer and CDSL publishes an FIP page; neither was fetched. — [Sahamati MF on AA PDF](https://sahamati.org.in/wp-content/uploads/2023/07/Mutual-Funds-on-AA.pdf); [CDSL FIP page](https://www.cdslindia.com/Investors/FIP.html)

### Cited Findings: CAS, UPI, BBPS
- **CAS alternative (vendor claims):**
  - Consolidated Account Statement (CAS) PDFs come from CDSL, NSDL, CAMS and KFintech. SEBI mandated CAS in 2009.
  - A CAS parser gives mutual fund and demat holdings, including joint accounts, with no regulatory approval. It can use a one-time Gmail OAuth restricted to CAS senders.
  - It does not cover bank data or GST.
  - Pricing starts at ₹999/month.
  - — [CASParser, Mar 2026](https://casparser.in/blog/state-of-account-aggregator-2026/)
- **UPI volumes:**
  - Sep 2026: 24.07B transactions worth ₹29.37 lakh crore, a daily average of 802M (first time above 800M).
  - Aug 2026 was the record month at 24.51B.
  - App share, Aug 2026: PhonePe 45.64%, Google Pay 32.26%, Paytm 8.03% (85.93% combined).
  - — [StartupTalky, Oct 2026](https://startuptalky.com/india-upi-transactions-september-2026/); [Outlook Money](https://www.outlookmoney.com/banking/upi-processes-2407-billion-transactions-worth-rs-2937-lakh-crore-in-september)
- **BBPS/Bharat Connect:** NPCI Bharat BillPay publishes BBPS API specifications (v14.1), which include bill fetch. Third parties integrate through BBPS agent institutions or partners such as Setu, Razorpay and EnKash rather than directly. — [Bharat Connect API spec v14.1](https://www.bharat-connect.com/strapi/uploads/BBPS_API_Specifications_v14_1_f300ab807e.pdf); [Setu BillPay docs](https://docs.setu.co/payments/billpay/v1/api-integration/apis); [Razorpay docs](https://razorpay.com/docs/pos/billme/bbps.md)

### Cited Findings: DPDP Act 2023 and Rules 2025
- **Commencement:**
  - DPDP Rules notified 13 Nov 2025 (G.S.R. 846(E)). The Data Protection Board provisions took effect immediately.
  - Consent manager registration (Rule 4) starts around 13 Nov 2026.
  - Main duties (notice, consent, security, breach reporting, children's data, rights) start around 13 May 2027.
  - MeitY proposed in Jan 2026 to shorten the 18-month runway to 12 months. As of 20 Sep 2026 the amendment had not been notified.
  - As of Sep 2026, no Board Chair or Members had been appointed.
  - — [MirvoLegal, Sep 2026](https://www.mirvolegal.com/insights/dpdp-rules-2025-compliance-timeline/)
- **Obligations:**
  - Breach: notify affected users promptly, and give the Board full details within 72 hours.
  - Retain logs for at least 1 year.
  - Erase inactive users' data, with 48 hours' notice.
  - Verifiable parental consent for children.
  - Penalties up to ₹250 crore (security failures), ₹200 crore (breach notice or children's data) and ₹150 crore (significant data fiduciary duties).
  - — [MirvoLegal](https://www.mirvolegal.com/insights/dpdp-rules-2025-compliance-timeline/)

### Inferences
- An unregulated PFM app cannot be an FIU directly. FinSight_AI would need a licence (for example, SEBI investment adviser, or NBFC) or a partnership with a regulated entity or TSP. The FIU-also-becomes-FIP rule adds further burden.
- For mutual funds and demat, CAS PDF parsing (user upload or email) is a no-licence path that fits FinSight_AI's existing import architecture.
- Under DPDP, FinSight_AI is a data fiduciary. A plausible minimum before May 2027: consent and notice UI, purpose-limited retention, a 72-hour breach runbook, and an erasure workflow.
- Because UPI has no consumer-read API, a PFM app's UPI visibility in practice comes from bank statements via AA, or from user-supplied SMS or statements.

### Gaps
- No primary Sahamati document confirming the 1 Nov 2026 rate card was found.
- No official per-fetch or per-consent prices from Finvu, OneMoney, Setu or Anumati were retrieved.
- No official fetch success-rate statistics were found.
- I did not confirm from NPCI documentation whether any UPI read or transaction-history API is open to non-PSP third parties. My understanding is that none is, but it is unverified.
- Monthly AA-specific growth for Oct 2026 and current FIP and AA counts from Sahamati's participant list were not fetched.

## 4. How do vendors do transaction enrichment and categorization, and what accuracy is reported?

### Takeaway
Vendors moved from keyword rules to embedding-based neural models and now to AI-assisted labelling. Published accuracy numbers are mostly relative ("up to +10%"). The strongest public absolute benchmark is Intuit's 2025 QuickBooks paper: about 69% top-1 in few-shot and about 46% zero-shot. Categorization is hard because descriptions are noisy, labels are long-tailed, and categories are personal.

### Cited Findings
- **Plaid, 2017:**
  - Uses a word-embedding neural network over word sequences, so order matters ("usa" at the start of a description suggests a vending machine, at the end a country).
  - Handles unseen merchants and truncations (for example, "Pirates Cove Car Wa").
  - Was building a merchant-name and address normalisation engine.
  - Published no accuracy figures.
  - — [Plaid, 24 Aug 2017](https://plaid.com/blog/making-sense-of-messy-data/)
- **Plaid, Dec 2025:** An upgraded model using "AI-assisted label generation" with targeted human review claims up to 10% higher accuracy on primary categories and up to 20% on detailed sub-categories. More than a dozen new subcategories were added (income types, repayments, bank fees, transfers). — [Plaid, 3 Dec 2025](https://plaid.com/blog/ai-enhanced-transaction-categorization/)
- **Plaid taxonomy and engineering:** Plaid introduced a personal finance category (PFC) taxonomy for PFM apps and publishes a migration guide. Its engineering blog describes unifying four ML categorization systems into one. Neither page was fetched. — [Plaid taxonomy blog](https://plaid.com/blog/transactions-categorization-taxonomy/); [PFC migration](https://plaid.com/docs/transactions/pfc-migration/); [Plaid engineering](https://engineering.plaid.com/universal-transaction-categorization-how-plaid-unified-four-ml-systems-into-one-f08bf1eade54)
- **Intuit QuickBooks paper (Dong et al., arXiv 2506.09234, Jun 2025):**
  - Method: Rel-Cat turns relational data into a graph (a GraphSAGE/GATv2 graph neural network) and uses Txn-Bert, a text encoder trained on transaction descriptions.
  - Few-shot results: top-1 68.67%, top-5 88.04%, compared with 62.49% for the production model (Lynx).
  - Zero-shot results: Txn-Bert top-1 45.52%, compared with 36.07% for production (Shorthair).
  - Data: about 3M training transactions and a 15K test set.
  - Challenges named: abbreviated bank text, long-tail labels, personalised categories, cold start, and latency at scale.
  - — [arXiv 2506.09234](https://arxiv.org/pdf/2506.09234)

### Inferences
- For India, descriptions such as UPI narrations ("UPI/P2M/…/merchant VPA") contain structured payee VPAs. Plausibly, VPA-to-merchant normalisation plus per-user correction feedback (personalisation) captures much of the gain. This is not sourced and should be treated as a design hypothesis.
- Vendor accuracy claims are not independently benchmarked. The report should present them as vendor claims.

### Gaps
- No India-specific transaction categorization benchmark or dataset was found.
- No accuracy figures from MX, Yodlee or Ntropy were retrieved.
- No independent cross-vendor comparison was found.

## 5. What could a small team realistically integrate?

### Takeaway
Live AA access requires regulated-entity status or a partner. Realistic near-term options for FinSight_AI are:
- CAS PDF parsing for investments.
- Bank statement and CSV import with strong categorization.
- BBPS bill data via a partner.
- AA sandboxes for prototyping, with production access through a regulated partner or a TSP's FIU-enablement route.

### Cited Findings
- FIUs must be regulated by RBI, SEBI, IRDAI or PFRDA. Setu acts as a TSP and documents an FIU go-live process. — [Setu licenses](https://docs.setu.co/data/account-aggregator/licenses-and-go-live/licenses); [Setu go-live](https://docs.setu.co/data/account-aggregator/licenses-and-go-live/go-live)
- **Cost and time (vendor estimates, Mar 2026):** AA integration takes 5–10 months and ₹5–25 lakh in the first year. CAS integration takes about a day and costs from ₹999/month. — [CASParser](https://casparser.in/blog/state-of-account-aggregator-2026/)
- Onboarding with large banks takes 3–6 months of legal and compliance work. — [MediaNama, Oct 2026](https://www.medianama.com/2026/10/223-sahamati-bg-mahesh-rbi-account-aggregator-interoperability/)
- Perfios sells an "FIU Lite" product aimed at lowering the integration burden. Its details were not fetched. — [Perfios FIU Lite](https://perfios.ai/in/products/fiu-lite/)
- BBPS bill-fetch and pay APIs are available through partners such as Setu and Razorpay. — [Setu BillPay](https://docs.setu.co/payments/billpay/v1/api-integration/apis); [Razorpay BBPS](https://razorpay.com/docs/pos/billme/bbps.md)

### Inferences
- A phased plan fits a small team:
  1. Statement and CSV, plus CAS PDF parsing, with a DPDP-compliant consent and retention design.
  2. AA prototype in a TSP sandbox (Setu, Finvu) against mock FIPs.
  3. Production AA through a regulated partner FIU once there is scale.
- AA interoperability (target 31 Dec 2026) should lower the multi-AA burden later.

### Gaps
- I did not verify whether Setu, Finvu or other TSP sandboxes are free and self-serve as of Oct 2026.
- I did not verify whether an unregulated entity can use "FIU Lite" or a similar product in production.
