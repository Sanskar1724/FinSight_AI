# Related work: grounded, routed, memory-aware personal finance assistants

Literature review for the FinSight_AI paper, written 2 November 2026. It extends the October 2026 report (`research/reports/Multi agent personal finance assistants.md`) and its notes, and does not repeat their industry, aggregation and regulation sections. It focuses on the six research areas FinSight's experiments touch: numeric grounding, intent routing, financial retrieval, conversational memory, scam detection, and Indian or Hinglish finance.

**Verification key.** ✔ = abstract or results read this session from the arXiv/ACL page. ◐ = well-known paper cited from the original paper's published numbers, not re-read this session. Re-check every ◐ number against the PDF before it goes into the paper.

---

## 1. Is this topic popular?

Yes, and it is getting crowded fast, but unevenly.

- **Very crowded:** numerical QA over corporate filings (FinQA, TAT-QA, ConvFinQA). Since 2021 dozens of papers have reported on these three sets, and 2024 to 2026 work moved from fine-tuned models (TAT-LLM) to multi-agent critics and calculator tools. These benchmarks are now regression tests, not open problems.
- **Crowded:** LLM agents for trading and investment research (FinMem, FinAgent, FinCon, TradingAgents, FinRobot). The EMNLP 2025 survey by Dong et al. catalogues over 30 finance benchmarks and 20 models, almost all institutional.
- **Active but general:** long-term chat memory (MemGPT, LoCoMo, LongMemEval, Mem0) and LLM scam detection (Fraud-R1, FraudSMSWalker, Topcuoglu et al. 2026). None of these is about personal finance conversations.
- **Thin:** Indian and Hinglish finance. In 2025 and 2026 a handful of papers appeared (IndiaFinBench, FIND/FinVQA, TIFIN's CIKM'25 Hinglish assistant), but none tests numbers grounded in a user's own transactions.
- **Essentially empty:** an evaluated assistant that answers over a **person's own ledger** (bank statements, UPI, CAS) with verified numbers, routing, memory and scam checks in one system. The October report's notes reached the same conclusion, and this pass found nothing that changes it.

So the topic is popular at the component level and open at the system level for personal finance, especially in India.

---

## 2. Paper table

### 2a. Numeric grounding on financial QA (FinSight E3, E4, E5)

| Paper | Venue, year | Dataset | Method | Headline result | ✔/◐ |
|---|---|---|---|---|---|
| FinQA (Chen et al.) | EMNLP 2021 | FinQA, 8,281 Q over S&P 500 reports | Retriever + program generator (FinQANet) | ~61% execution accuracy vs ~91% for human experts | ◐ |
| TAT-QA (Zhu et al.) | ACL 2021 | TAT-QA, 16,552 Q on hybrid table+text | TAGOP, sequence tagging + operators | ~58 F1 vs ~91 F1 human | ◐ |
| ConvFinQA (Chen et al.) | EMNLP 2022 | 3,892 conversations, 14,115 Q | FinQANet adapted to dialogue; GPT-3 CoT | Best model ~69% vs ~89% human; later turns are harder | ◐ |
| Program of Thoughts (Chen et al.) | TMLR 2023 | FinQA, ConvFinQA, TAT-QA + math | LLM writes Python, interpreter computes | ~12% average gain over chain-of-thought | ◐ |
| PAL (Gao et al.) | ICML 2023 | Math/symbolic reasoning | Program-aided LM, same idea as PoT | Code execution beats CoT on arithmetic | ◐ |
| Self-consistency (Wang et al.) | ICLR 2023 | Arithmetic/commonsense | Sample many reasoning paths, majority vote | Large gains over greedy CoT | ◐ |
| TAT-LLM (Zhu et al.) [arXiv 2401.13223](https://arxiv.org/abs/2401.13223) | arXiv 2024 | FinQA, TAT-QA, TAT-DQA | Fine-tuned LLaMA-2, Extractor → Reasoner → external Executor | 7B: FinQA 64.6, TAT-QA 74.6 EM, both above GPT-4; 70B: FinQA 76.8; removing the executor hurts a lot | ✔ |
| Fatemi & Hu, multi-agent reflection [arXiv 2410.21741](https://arxiv.org/abs/2410.21741) | arXiv 2024 | FinQA, ConvFinQA, TAT-QA | Analyst agent + 1–2 critic agents (AutoGen) | LLaMA3-8B FinQA 54.7 → 72.5, TAT-QA 69.6 → 86.8 with 3 agents; **but critics only ran on questions the single agent got wrong (oracle labels)** | ✔ |
| Tan et al., American Express [arXiv 2506.08726](https://arxiv.org/abs/2506.08726) | arXiv 2025 | TAT-QA dev (717), FinQA dev (883) | Analyst, critic, improved critic, calculator agents | Without oracle labels the critic does **not** beat CoT (TAT-QA llama3 72.8 → 71.3). A calculator tool helps most: llama3 TAT-QA 72.8 → 83.4; PoT 81.2 | ✔ |
| Wang, "Confidently Wrong" [arXiv 2607.11414](https://arxiv.org/abs/2607.11414) | ICAIF 2026 | FinQA (~6.1k), TAT-QA (1,138) | Agreement of 8 samples + hidden-state probe to detect wrong answers | Probe AUROC 0.70–0.77 on "confident" FinQA answers vs 0.55–0.62 for output signals; catches 45% of errors at 20% review budget; does not transfer across datasets | ✔ |
| Ding, "When LLMs Agree, Are They Right?" [arXiv 2607.08065](https://arxiv.org/abs/2607.08065) | arXiv 2026 | GPQA, AIME (not finance) | Audit of self-consistency as confidence | Agreement is only a weak signal (ρ 0.20–0.59); frontier model with ≥0.8 agreement still wrong 48% of the time | ✔ |
| VeNRA (Agand) [arXiv 2603.04663](https://arxiv.org/abs/2603.04663) | arXiv 2026 | Financial documents | Typed fact ledger, LLM writes Python, 3B sentinel audits traces | Closest design to FinSight's "engine + checker"; accuracy figures not extracted | from Oct notes |

### 2b. Intent routing (FinSight E1, E4)

| Paper | Venue, year | Dataset | Method | Headline result | ✔/◐ |
|---|---|---|---|---|---|
| Banking77 (Casanueva et al.) [arXiv 2003.04807](https://arxiv.org/abs/2003.04807) | NLP4ConvAI @ ACL 2020 | Banking77, 13,083 queries, 77 intents | Frozen dual sentence encoders (USE+ConveRT) + small classifier | 85.2% at 10 examples/intent, 90.6% at 30, 93.7% full data (tuned BERT) | ✔ |
| SetFit (Tunstall et al.) | arXiv 2022 | Several incl. few-shot classification | Contrastive fine-tuning of a sentence transformer | Strong few-shot accuracy with no prompts, tiny models | ◐ |
| Loukas et al., "Making LLMs Worth Every Penny" [arXiv 2311.06102](https://arxiv.org/abs/2311.06102) | ICAIF 2023 | Banking77 | Contrastive few-shot vs GPT-4/Claude/Cohere 1–5-shot; RAG-selected examples | Contrastive methods work with ~20 examples/class; retrieval-picked examples cut LLM cost several-fold | ✔ (abstract) |
| Arora et al., "Intent Detection in the Age of LLMs" [arXiv 2410.01627](https://arxiv.org/abs/2410.01627) | arXiv 2024 | HINT3 + internal | SetFit vs 7 LLMs vs hybrid (LLM only when encoder unsure) | LLMs F1 0.736 vs SetFit 0.658, but SetFit is ~56× faster (0.03 s vs 1.7 s); hybrid is within ~2% of the best LLM at ~half the latency; English only | ✔ |

### 2c. Financial retrieval (FinSight E2)

| Paper | Venue, year | Dataset | Method | Headline result | ✔/◐ |
|---|---|---|---|---|---|
| FiQA 2018 (Maia et al.) | WWW'18 companion | FiQA opinion QA + sentiment | Shared task | Introduced the FiQA retrieval set | ◐ |
| BEIR (Thakur et al.) | NeurIPS 2021 Datasets | 18 sets incl. FiQA | Zero-shot BM25 vs dense retrievers | BM25 nDCG@10 on FiQA 0.236 (FinSight's BM25 run matches this exactly); many dense models failed to beat BM25 zero-shot | ◐ |
| M3-Embedding / bge-m3 (Chen et al.) [arXiv 2402.03216](https://arxiv.org/abs/2402.03216) | Findings ACL 2024 | MIRACL, MKQA, long-doc | Dense + sparse + multi-vector in one model, 100+ languages | Strong multilingual retrieval, includes Hindi | ◐ |
| FinMTEB (Tang & Yang) [arXiv 2502.10990](https://arxiv.org/abs/2502.10990) | EMNLP 2025 | 64 finance datasets (EN+ZH), 7 task types | 15 embedding models; finance-tuned Fin-E5 | General benchmark rank does **not** predict finance rank; Fin-E5 retrieval 0.711 vs 0.675 base; bag-of-words beats all dense models on finance STS | ✔ |

### 2d. Conversational memory (FinSight E5)

| Paper | Venue, year | Dataset | Method | Headline result | ✔/◐ |
|---|---|---|---|---|---|
| MemGPT (Packer et al.) | arXiv 2023 | Long chats, documents | OS-style paged memory | Memory as an explicit managed store | ◐ |
| LoCoMo (Maharana et al.) | ACL 2024 | Very long multi-session chats | Benchmark | LLMs struggle with temporal and multi-hop recall over long dialogues | ◐ |
| LongMemEval (Wu et al.) [arXiv 2410.10813](https://arxiv.org/abs/2410.10813) | ICLR 2025 | 500 questions, 5 memory abilities | Benchmark + memory design study | Assistants lose ~30% accuracy across sessions (GPT-4o −37%); storing fact keys +5.4 QA, time-aware search +6.8 recall, structured reading up to +10 | ✔ |
| Mem0 (Chhikara et al.) [arXiv 2504.19413](https://arxiv.org/abs/2504.19413) | arXiv 2025 | LoCoMo | Extract-and-update fact memory (+ graph variant) | ~26% relative over OpenAI memory; ~91% lower p95 latency and >90% fewer tokens than full context | ✔ |
| FinMem (Yu et al.) [arXiv 2311.13743](https://arxiv.org/abs/2311.13743) | arXiv 2023 | Stock trading | Layered memory with decay | Canonical finance-agent memory, but for trading, not users | ◐ |

### 2e. Scam and fraud detection (FinSight scam shield)

| Paper | Venue, year | Dataset | Method | Headline result | ✔/◐ |
|---|---|---|---|---|---|
| Fraud-R1 [arXiv 2502.12904](https://arxiv.org/abs/2502.12904) | Findings ACL 2025 | 8,564 fraud cases, EN+ZH, 5 types | Multi-round test of whether LLMs get talked into fraud | Defense success 38.9–92.6% across 15 LLMs; weakest on fake jobs and role-play; worse in Chinese than English | ✔ |
| FraudSMSWalker [arXiv 2606.16659](https://arxiv.org/abs/2606.16659) | arXiv 2026 | 699 SMS-to-webpage chains, EN+ZH | 9 browsing agents, URLs hidden | Best accuracy only 50.9%; agents flag suspicious cues but lose benign recall on "hard benign" login/payment pages | ✔ |
| Topcuoglu et al. [arXiv 2607.17353](https://arxiv.org/abs/2607.17353) | arXiv 2026 | Real-world scam benchmark, multiple formats | 9 LLMs, prompting, vs fine-tuned BERT | Bigger models better; prompting helps small ones; LLMs generalize to unseen scams better than fine-tuned BERT | ✔ |
| AdapT-Bench (Zhou) [arXiv 2511.15165](https://arxiv.org/abs/2511.15165) | arXiv 2025 | Academic phishing, text + images, EN+ZH | Multimodal benchmark | "Quality filtering paradox": more polished generated attacks were easier to detect, so synthetic scam sets overstate accuracy | ✔ |

### 2f. Indian and Hinglish finance (FinSight Hinglish, Indian data)

| Paper | Venue, year | Dataset | Method | Headline result | ✔/◐ |
|---|---|---|---|---|---|
| GLUECoS (Khanuja et al.) | ACL 2020 | Code-switched EN-HI, EN-ES tasks | Benchmark | Standard code-mixed NLP benchmark | ◐ |
| LinCE (Aguilar et al.) | LREC 2020 | Code-switching, incl. Hindi-English | Benchmark | Standard code-mixed NLP benchmark | ◐ |
| COMI-LINGUA [arXiv 2503.21670](https://arxiv.org/abs/2503.21670) | arXiv 2025 | Expert-annotated Hindi-English code-mixed, multitask | Benchmark | Large modern Hinglish set, not finance | ✔ (title) |
| Hazarika et al., TIFIN [arXiv 2512.01439](https://arxiv.org/abs/2512.01439) | CIKM 2025 | Golden multi-turn set + 500-user beta | Language ID → orchestrator → tools → reply in user's language (Hinglish focus) | Indic-BERT language ID 95.8% vs 63.7% for Qwen-0.5B; A/B task completion 58% → 70%; error analysis lists **hallucinated financial figures**; paper's own summary numbers don't match its tables | ✔ |
| IndiaFinBench [arXiv 2604.19298](https://arxiv.org/abs/2604.19298) | arXiv 2026 | 406 expert QA from 192 SEBI/RBI documents | Zero-shot, 12 models | 70.4–89.7% accuracy; all models beat a 69% non-expert human | ✔ |
| FIND / FinVQA (Das et al.) [arXiv 2605.13330](https://arxiv.org/abs/2605.13330) | arXiv 2026 | 18,900 samples, 6 languages, from NCERT/ICMAI | Zero-shot vs constrained decoding vs LoRA SFT | SFT helps most (Marathi 26 → 48 for a 4B model); Tamil hardest; exam-style, not personal | ✔ |

### 2g. Multi-agent evidence (FinSight E4, architecture)

| Paper | Venue, year | Finding | ✔/◐ |
|---|---|---|---|
| MAST (Cemri et al.) [arXiv 2503.13657](https://arxiv.org/abs/2503.13657) | arXiv 2025 | Multi-agent systems fail on 41–86.7% of tasks across 7 frameworks; adding verification is the biggest fix (+15.6%) | from Oct notes |
| Dong et al. survey | Findings EMNLP 2025 | Open problems: numerical reasoning, real-time adaptation, coordination, privacy-compliant deployment; personal finance barely covered | from Oct notes |

---

## 3. What these papers have in common

1. **Compute with code, not with the model.** Every strong numeric result since 2022 moves arithmetic out of the LLM: PoT, PAL, TAT-LLM's external executor, Tan et al.'s calculator agent, VeNRA. Tan et al. find the calculator adds about 10 points on TAT-QA for LLaMA3-70B, more than any critic agent.
2. **Multi-agent gains are smaller than they look.** The big critic gains (Fatemi & Hu) used gold labels to decide when to re-check. Without that, the critic does nothing or hurts (Tan et al.). MAST shows high failure rates. The working "agents" are mostly tools with a role name.
3. **Small encoders are good enough for routing.** On Banking77 a frozen encoder hits 85% with 10 examples per intent. LLMs are a bit more accurate on hard intents but ~50× slower, so hybrids (encoder first, LLM when unsure) win on cost.
4. **Domain shift breaks general rankings.** FinMTEB shows MTEB rank does not predict finance rank, and BEIR shows BM25 is a hard baseline on FiQA.
5. **Memory works best as stored facts, not the full transcript.** LongMemEval and Mem0 both get their gains from extracting facts, adding time stamps and retrieving selectively.
6. **Confidence signals are weak on their own.** Sample agreement helps but frontier models are confidently wrong often (Ding 2026). Hidden-state probes do better but need per-task training (Wang 2026).
7. **Evaluation is on someone else's documents.** FinQA, TAT-QA, ConvFinQA, FinanceBench, IndiaFinBench and FinVQA are all corporate filings, regulation or exam questions. Scam benchmarks are Chinese and English. No benchmark uses a person's own transactions.

---

## 4. Their gaps, and how FinSight can fill each one

| # | Gap in the literature | Evidence | What FinSight has already shown | What FinSight still needs to do |
|---|---|---|---|---|
| G1 | **No numeric-grounding study over a person's own ledger.** All grounding work uses corporate filings. | Sections 2a, 3.7; Oct report | E3 (FinQA, Qwen 7B, 300 Q): direct answer 48.7% → reason-then-program **71.0%** (+22.3), consistent with PoT and Tan et al. | Build a small benchmark from real public statements or anonymised UPI/CAS exports with gold numbers computed by FinSight's Decimal engine, then rerun E3's arms on it. This is the paper's main contribution. |
| G2 | **"Verified" answers lack a shown coverage–accuracy trade-off for finance users.** Agreement is a weak signal (Ding), probes need per-task training (Wang). | 2a | E3 agreement check: **82.6% right when it answers, but answers only 48% of questions.** Grounding check alone: +0.7. | Report a full risk–coverage curve (accuracy vs % answered) and compare agreement against Wang's cheap output-level baselines. Show the "verified" badge as selective prediction with a stated error rate, which nobody reports for consumer finance. |
| G3 | **Multi-agent finance QA claims rely on oracle triggers.** | Fatemi & Hu vs Tan et al. | E4 (router + specialists vs single agent on TAT-QA) is set up exactly to test this. Table pending. | Finish E4 with no oracle labels, report MAST-style failure labels, and say plainly if routing does not help accuracy but helps cost or latency. That honesty is itself a contribution given the conflicting prior results. |
| G4 | **Few-shot routing has not been tested for personal-finance intents or Hinglish.** Arora et al. is English-only; Banking77 is English-only. | 2b | E1 (Banking77): bge-m3 **93.4%** vs FinSight's regex **65.5%**; at 5 examples/intent 83.8% vs 45.1%. Matches Casanueva's 85% at 10-shot with half the data. | Add a Hinglish version of FinSight's own intents (written by real users in the 10–15 person check, not synthetic) and test bge-m3 plus an LLM fallback when the encoder is unsure, following Arora's hybrid. |
| G5 | **Finance retrieval is benchmarked on corporate text, and hybrid/rerank is assumed to help.** | 2c | E2 (FiQA): bge-m3 nDCG@10 **0.410** vs BM25 0.236 vs FinSight's hashed vectors 0.127. Hybrid search and reranking were **worse**, a useful negative result. | Report the negative hybrid/rerank result with a reason, and test bge-m3 on Hindi/Hinglish queries over FinSight's own help articles. |
| G6 | **No memory study for multi-turn personal-finance follow-ups.** LongMemEval and Mem0 are general chat; ConvFinQA has no memory arms. | 2d | E5 (ConvFinQA): transcript memory **64.4% vs 53.7%** without memory (+10.6, CI +6..+15); full conversations right 42% vs 21%. Structured-ledger arm was buggy and needs a rerun. | Rerun the fixed structured-memory arm. If it matches transcript memory at fewer tokens, that mirrors Mem0's finding in finance and is publishable either way. |
| G7 | **Scam detection research ignores Indian rails and Hinglish.** Benchmarks are EN/ZH; synthetic attacks overstate accuracy (AdapT-Bench). | 2e | Not started. | Evaluate the scam shield on real, public reported Indian scam texts (for example cyber-crime advisories and published UPI scam examples) with hard benign bank messages, and report benign recall, which FraudSMSWalker shows is where agents fail. Use real data only, per the project rule. |
| G8 | **Indian finance LLM work stops at regulation, exams or a single product.** The one Hinglish assistant paper (TIFIN) reports hallucinated figures and inconsistent numbers. | 2f | Not started beyond plans. | Combine G1 + G4: Hinglish questions over a user's ledger, with the verified-number check. That combination does not exist in any paper found. |
| G9 | **No integrated system is evaluated end to end.** Papers test one component each. | All | Parts 1 and 2 cover routing, retrieval, grounding and memory with one local model and one API model. | Part 3: run the full pipeline (route → retrieve → compute → verify → remember) against component baselines, same models, same data. |

---

## 5. Suggested positioning for the paper

**One-sentence claim:** Prior work shows that executing code beats free-form reasoning on corporate financial QA, and that general assistants forget across turns, but no study measures these choices together for a person's own finances. We show that, on public benchmarks and a new Indian personal-ledger set, an embedding router, program-executed answers, agreement-based verification and structured memory each improve on a rule-based assistant, with stated coverage, cost and failure rates.

**Related-work paragraph order:** (1) numerical financial QA and code execution, (2) multi-agent finance QA and the oracle-label problem, (3) intent routing, (4) financial retrieval, (5) conversational memory, (6) scam detection, (7) Indian and code-mixed finance. Close each paragraph with the gap row from section 4.

**Things to be careful about:**
- Do not claim to beat FinQA/TAT-QA state of the art. FinSight's numbers are with a 7B 4-bit model on subsets; frame them as controlled comparisons between arms.
- Cite Tan et al. next to Fatemi & Hu whenever multi-agent gains come up.
- Re-check every ◐ number in this file against the original PDF before submission.
