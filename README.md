# FinSight AI · Research Part 2: Agents and memory

This branch holds only the Part 2 research experiments for FinSight AI. The application code lives on `main`, Part 1 lives on `research/part-1-grounding-benchmarks`, and the literature review lives on `research/multi-agent-finance-assistants`.

Part 1 chose the building blocks: bge-m3 embeddings for routing and search, and "compute numbers with code, mark them verified when two routes agree". Part 2 asks two questions about **putting the blocks together**:

1. **Agents:** does a router plus specialist agents actually beat one strong agent with tools, and at what cost?
2. **Memory:** which memory design keeps a multi-turn money conversation correct?

Every experiment runs on real public data, with no curated or synthetic examples. Part 2 does not need any files from Part 1; it reuses Part 1's methods, which are built into this notebook.

| File | What it is |
| --- | --- |
| [`part2_agents_and_memory.ipynb`](part2_agents_and_memory.ipynb) | The full experiment notebook, ready to import into Kaggle |

## Experiments

| Exp | Question | Real dataset | Primary metric |
| --- | --- | --- | --- |
| **E4** | Router + specialists versus a single agent | [TAT-QA](https://github.com/NExTplusplus/TAT-QA): 1,668 dev questions over real annual-report tables and text, needing a copied span, several spans, a calculation or a count | Exact match and F1 from the official TAT-QA scorer, plus LLM calls and tokens per question |
| **E5** | Memory designs for multi-turn conversations | [ConvFinQA](https://github.com/czyssrs/ConvFinQA): 421 dev conversations (1,490 turns) over real S&P 500 earnings reports, where later questions refer back to earlier answers | Accuracy per turn, on follow-up turns, and over whole conversations, plus prompt tokens per turn |

## Technical approach

```
part2_agents_and_memory.ipynb
├── 0  Configuration      sample sizes, models, API settings, FAST switch
├── 1  Setup              packages, output folder, bootstrap CIs, paired bootstrap differences
├── 2  Shared tools       Part 1's sandboxed program runner, number parsing, answer matching
├── 3  LLM backends       local Qwen 2.5 7B (4-bit) and an OpenAI-compatible API, one cache
├── E4 Agents on TAT-QA   learned router → specialists → six arms → official scorer → failure modes
├── E5 Memory on ConvFinQA  three memory designs, turn by turn, using the model's own earlier answers
└── Summary               summary.csv, results.json, summary.png
```

### Two backends, identical prompts

Every LLM arm runs on a **local open model** (Qwen 2.5 7B Instruct in 4-bit, with a 3B fallback; one full copy per GPU, so a T4 x2 session works through two batches at the same time) and, when an API key is present, an **API model** (default Gemini 3.5 Flash-Lite on Google's free tier, through its OpenAI-compatible endpoint; Groq or any other OpenAI-compatible provider works). Both use the same system prompt, the same messages and greedy decoding. The API runs on the first part of the same random sample, and the notebook also scores the local model on exactly those questions, so the two backends pair up. Every generation is cached on disk with its prompt and output token counts, so a run stopped by a rate limit continues where it stopped.

### E4 · Agents

| Arm | Design | LLM calls per question |
| --- | --- | --- |
| **S1** · Single LLM | Answers directly after brief reasoning | 1 |
| **S2** · Single agent + calculator | One agent that can call a calculator tool up to 3 times (ReAct style). The strong single-agent baseline every multi-agent arm is compared against | 1–4 |
| **M1** · Learned router + specialists | A bge-m3 + logistic regression router (trained on TAT-QA *train* questions, tested on *dev*) sends the question to a **lookup** specialist (copy spans), a **calculator** specialist (Part 1's reason-then-program) or a **counter** specialist (list items, count in code) | 1 |
| **M2** · LLM orchestrator + specialists | The LLM decides which specialist to call | 2 |
| **M3** · Router + specialists + checks | M1, but a calculated answer is kept only if it agrees with S1, and a copied span only if it appears verbatim in the report; otherwise it abstains | 2 |
| **Oracle** · Gold route + specialists | TAT-QA's gold answer type picks the specialist: the ceiling for any router | 1 |

- All arms see the same report (table plus paragraphs) and the same answer rules, including the scale (thousand, million, percent ...), which the official scorer requires.
- Each specialist runs once per question and the arms are composed from those outputs, so differences come only from the design. Cost per arm counts only the calls that arm would make on its own.
- Each multi-agent arm reports its paired difference from S2 with a 95% bootstrap CI. A multi-agent design only "wins" if that interval is above zero.
- Every wrong answer gets a failure label: wrong route, program failed, right number but wrong scale, sign error, percent versus fraction, wrong number, partial span or wrong span.

### E5 · Memory

| Arm | Memory given at each turn |
| --- | --- |
| **No memory** | Only the current question |
| **Transcript** | Every earlier question with the assistant's own earlier answers, as chat apps do |
| **Structured memory** | A short ledger of earlier results as named variables (`m1 = 60.94  # price per share in 2007`) that the program can use directly, each labelled with the question it answered, like a `memory.md` file. Turn 1 is identical in every arm |

- Every arm answers with Part 1's reason-then-program method and sees ConvFinQA's annotated supporting facts, as Part 1 did with FinQA.
- The assistant's own earlier answers are carried forward, never the gold ones, so mistakes propagate as they would for a real user.
- Reported per arm: accuracy over all turns, on the first turn, on follow-up turns, on turns that reuse an earlier result, and over whole conversations; accuracy on a follow-up after a wrong versus a right previous answer (error carry-over); and prompt tokens per turn. Paired differences between arms come with 95% bootstrap CIs.

### Reference points from the literature

- **TAT-QA:** the dataset paper's TagOp model reaches 58.0% F1 on the test set, against 90.8% for human experts ([Zhu et al., 2021](https://arxiv.org/abs/2105.07624)).
- **ConvFinQA:** the dataset paper reports about 69% execution accuracy for FinQANet (RoBERTa-large), against about 89% for human experts ([Chen et al., 2022](https://arxiv.org/abs/2210.03849)).

These use different splits and setups, so treat them as context. The fair comparisons are between the arms inside this notebook.

## Run it on Kaggle

1. Open [kaggle.com/code](https://www.kaggle.com/code) and choose **New Notebook**.
2. Choose **File → Import Notebook**, then paste this link:
   `https://github.com/Sanskar1724/FinSight_AI/blob/research/part-2-agents-and-memory/part2_agents_and_memory.ipynb`
   If the URL import does not work, download the raw file and upload it instead:
   `https://raw.githubusercontent.com/Sanskar1724/FinSight_AI/research/part-2-agents-and-memory/part2_agents_and_memory.ipynb`
3. In the right panel, set **Accelerator → GPU T4 x2** and **Internet → On**.
4. Optional, for the API comparison: get a free key from [Google AI Studio](https://aistudio.google.com/apikey). In Kaggle, open **Add-ons → Secrets**, add a secret named `LLM_API_KEY` with the key, and tick it for this notebook. Without a key the API backend is skipped and everything else runs.
5. For a quick check, set `FAST = True` in the first code cell and choose **Run All** (about 15–20 minutes).
6. For the real results, set `FAST = False` and use **Save Version → Save & Run All (Commit)**. The local model makes about 3,000 generations: roughly 2–3 hours on one T4, and roughly half that with both T4s (`USE_ALL_GPUS = True`, the default); the API adds about 1.5 hours at 10 requests per minute (about 900 calls).
7. Download the results from the saved version's **Output** tab with **Download Output**.

Free API tiers change their model names and limits often. If the API stops with a rate-limit or quota message, run the notebook again later: finished answers are cached and it continues from there. To use Groq instead, set `API_BASE_URL = "https://api.groq.com/openai/v1/"`, `API_MODEL = "openai/gpt-oss-20b"` and `API_RPM = 5` (its free tier allows only 8,000 tokens per minute). At the start of the run the notebook prints every model your key can use, and warns you if `API_MODEL` is not one of them.

### Settings worth trying

| Setting | Default | Try |
| --- | --- | --- |
| `TATQA_N` / `CONV_N` | 300 questions / 100 conversations | 1668 / 421 for the full dev sets |
| `API_TATQA_N` / `API_CONV_N` | 100 / 30 | Larger if your API limits allow |
| `LLM_NAME` | `Qwen/Qwen2.5-7B-Instruct` in 4-bit | Any instruction-tuned model on Hugging Face |
| `API_MODEL` | `gemini-3.5-flash-lite` (free) | `gemini-3.8-flash` (free, stronger but slower); on Groq, `openai/gpt-oss-20b` (free) |
| `AGENT_MAX_STEPS` | 3 | 5, to give the single agent more tool calls |
| `TOKEN_BUDGET` | 12000 | 8000 if the GPU still runs out of memory (batches also split themselves automatically when that happens) |

## Outputs

| File | Contents |
| --- | --- |
| `summary.csv` | One row per backend and arm: primary metric, 95% CI, paired difference from the baseline, calls and tokens |
| `results.json` | Configuration, environment, router accuracy and every table |
| `e4_agents.csv` | E4 per arm: exact match, F1, coverage, right-when-answering, accuracy by answer type, cost |
| `e4_failure_modes.csv` | Share of each failure label per arm |
| `e4_items.jsonl` | Every TAT-QA question with each arm's answer, scale, score, route and failure label |
| `e5_memory.csv` | E5 per arm: accuracy overall, first turn, follow-ups, reuse turns, whole conversations, error carry-over, tokens |
| `e5_by_turn.csv` | E5 accuracy at each turn position |
| `e5_items.jsonl` | Every ConvFinQA turn with each arm's program output, value, label and score |
| `summary.png` | E4 and E5 bars for both backends, and E5 accuracy by turn |

## What counts as an improvement

| Exp | The design wins if |
| --- | --- |
| E4 | A multi-agent arm's exact match is above the single agent's (S2), with the paired 95% CI above zero, on both backends; or it ties S2 with clearly fewer calls and tokens |
| E4 | M3's right-when-answering is clearly above S2's exact match at a coverage FinSight can live with (for example 70% or more) |
| E5 | Structured memory beats the transcript on follow-up turns with the paired CI above zero, and does not use more prompt tokens |

## Known limits

- TAT-QA and ConvFinQA are company reports, not personal ledgers. No real public household-ledger dataset exists; a private-ledger benchmark is planned for Part 3.
- Both datasets are English. Hinglish comes in Part 3.
- E5's memory is working memory inside one conversation. Long-term memory across sessions needs real user data, which no public dataset provides.
- The orchestrator and the learned router see only the question, as FinSight's router would. An orchestrator that also reads the report might route better at a higher cost.
- Each backend uses greedy decoding with one model. Report both model names in the paper.

## Research plan

- **Part 1:** grounding components: routing, retrieval, numeric verification. Complete.
- **Part 2 (this branch):** agents and memory: single agent versus router + specialists versus orchestrator, memory designs, failure modes.
- **Part 3:** safety, households and India: prompt-injection and leakage tests, Hinglish, and the private-ledger benchmark.
