# Research methodology

The Research lab tests a narrow, measurable question: do grounded answers improve on answers produced without the user's financial context?

It does not claim that an AI model is generally accurate. It reports what happened in a particular run against a fixed heuristic rubric.

## Experiment design

Each selected case is answered twice:

- **Baseline**: the question alone, with no personal or retrieved context.
- **Grounded**: the question plus deterministic figures calculated from the user's ledger and, when relevant, retrieved passages from the local knowledge base.

The same provider, model, prompt version, and rubric version are recorded on the run. In the default configuration the provider is `deterministic`; an OpenAI-compatible provider can be enabled through backend configuration.

There are 28 seeded cases covering exact totals, comparisons, budgets, goals, cash flow, merchant questions, recurring payments, unusual spending, missing data, ambiguous requests, privacy, prompt injection, unsupported advice, and general literacy.

## Rubric: `rubric-v1`

Every response receives five scores from 0 to 5. The total is the unweighted mean of the five dimensions.

| Dimension | What it checks |
| --- | --- |
| Factual correctness | Whether the response contains the calculated figures required by the case, or correctly refuses/qualifies when data is missing or the request is unsafe. |
| Relevance | Whether the answer addresses the question and names the primary entity. |
| Grounding | Whether key figures are traceable to supplied calculations and cited references. Baseline scores 0 here by design because it receives no evidence. |
| Claim safety | Whether the response avoids guarantees, invented figures, unsupported fraud claims, and overconfident predictions. Higher is safer. |
| Practical usefulness | Whether the answer is substantive, structured, actionable, and appropriately qualified. |

The run summary reports per-mode averages, grounded-minus-baseline deltas, scores per case, evidence, retrieval traces, and failure notes.

## Execution

1. `POST /api/research/runs` validates the selected case IDs and creates a queued run with `202 Accepted`.
2. A background task executes baseline and grounded responses.
3. Responses and scores are persisted per case and mode.
4. The client polls `GET /api/research/runs/{id}` until the run completes or fails.
5. The completed run can be exported as JSON or CSV and then deleted.

Runs that fail retain an error message. The UI never displays a score before a run has executed.

## Interpretation

- Grounding is expected to be 0 for baseline by construction; it is not evidence that baseline responses are always useless.
- An LLM provider may refuse, underperform, or fail. Provider failures are reported and may fall back to a deterministic grounded answer; the fallback is identified.
- The rubric is automated and lexical. It rewards inclusion of calculated figures and penalizes unsupported rupee amounts and forbidden certainty, but it cannot fully judge reasoning quality.
- Scores are comparative within the same run and configuration. They are not a benchmark of financial advice quality.
- Results should be reviewed by a human before they are cited publicly.

## Reproducibility

The run stores provider, model, prompt version, rubric version, selected case IDs, timestamps, responses, evidence, retrieval traces, scores, and failure notes. Keep those fields together when archiving an experiment. A rerun is reproducible only when the same provider/model behavior and seeded demo data are used.
