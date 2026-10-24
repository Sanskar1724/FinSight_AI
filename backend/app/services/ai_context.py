"""Intent detection and context construction for the grounded assistant.

The financial engine calculates facts first. Only a minimal, structured subset
is passed to an LLM. Exact answers can always be produced deterministically.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RecurringOverride, Transaction, User
from app.services import finance
from app.services.finance import format_inr
from app.services.knowledge import retrieve_knowledge
from app.services.ledger import (
    budgets_for_month,
    category_breakdown,
    category_map,
    dec,
    goals_for_user,
    txns_between,
    txns_like,
)

CATEGORY_ALIASES = {
    "food": "food-dining",
    "dining": "food-dining",
    "restaurant": "food-dining",
    "swiggy": "food-dining",
    "zomato": "food-dining",
    "groceries": "groceries",
    "grocery": "groceries",
    "transport": "transport",
    "travel": "travel",
    "commute": "transport",
    "rent": "rent",
    "education": "education",
    "healthcare": "healthcare",
    "medical": "healthcare",
    "utilities": "utilities",
    "shopping": "shopping",
    "subscriptions": "subscriptions",
    "subscription": "subscriptions",
}


def _clean(question: str) -> str:
    return re.sub(r"\s+", " ", question.strip().lower())


def detect_period(question: str, today: date) -> tuple[date, date, str, bool]:
    q = _clean(question)
    month_start = date(today.year, today.month, 1)
    if re.search(r"\blast 7 days|past week|last week\b", q):
        return today - timedelta(days=6), today, "last 7 days", True
    if re.search(r"\blast 30 days|past 30 days\b", q):
        return today - timedelta(days=29), today, "last 30 days", True
    if re.search(r"\blast month|previous month\b", q):
        month = finance.add_months(month_start, -1)
        start, end = finance.month_bounds(month)
        return start, end, finance.month_label(start), True
    if re.search(r"\bthis month|current month\b", q):
        return month_start, today, f"this month ({today:%b %Y})", True
    if re.search(r"\blast year|previous year\b", q):
        return date(today.year - 1, 1, 1), date(today.year - 1, 12, 31), str(today.year - 1), True
    if re.search(r"\bthis year|year to date|ytd\b", q):
        return date(today.year, 1, 1), today, f"{today.year} year to date", True
    if re.search(r"\blast 3 months|past 3 months|three months\b", q):
        start_month = finance.add_months(month_start, -3)
        return start_month, today, "last 3 months", True
    if re.search(r"\blast 6 months|past 6 months|six months\b", q):
        start_month = finance.add_months(month_start, -6)
        return start_month, today, "last 6 months", True
    return month_start, today, f"this month ({today:%b %Y})", False


def detect_category(question: str, categories: list) -> Any | None:
    q = _clean(question)
    tokens = set(re.findall(r"[a-z]+", q))
    best = None
    best_score = 0
    for category in categories:
        score = 0
        if category.name.lower() in q:
            score = len(category.name) + 5
        for word in re.findall(r"[a-z]+", category.name.lower()):
            if len(word) > 2 and word in tokens:
                score = max(score, len(word))
        alias_terms = [alias for alias, slug in CATEGORY_ALIASES.items() if slug == category.slug]
        for alias in alias_terms:
            if alias in tokens:
                score = max(score, len(alias))
        if score > best_score:
            best = category
            best_score = score
    return best


def detect_goal(question: str, goals: list) -> Any | None:
    q = _clean(question)
    generic = {
        "goal",
        "goals",
        "fund",
        "funds",
        "savings",
        "save",
        "money",
        "progress",
        "track",
        "trip",
        "travel",
        "new",
    }
    best = None
    best_score = 0
    for goal in goals:
        if goal.name.lower() in q:
            return goal
        matches = sum(
            1
            for word in goal.name.lower().split()
            if len(word) > 3 and word not in generic and word in q
        )
        if matches > best_score:
            best = goal
            best_score = matches
    return best if best_score > 0 else None


def detect_merchant(db: Session, user_id: int, question: str) -> str | None:
    q = _clean(question)
    merchants = db.scalars(
        select(Transaction.merchant).where(Transaction.user_id == user_id).distinct()
    ).all()
    best: str | None = None
    best_length = 0
    for merchant in merchants:
        normalised = merchant.lower().strip()
        if len(normalised) < 3:
            continue
        if normalised in q and len(normalised) > best_length:
            best = merchant
            best_length = len(normalised)
    return best


def detect_intent(
    question: str,
    category: Any | None,
    goal: Any | None,
    merchant: str | None,
    has_unknown_goal: bool,
) -> str:
    q = _clean(question)
    if re.search(r"ignore (all )?(previous|prior) instructions|system prompt|another user|other user|someone else's", q):
        return "injection"
    if re.search(r"bank (account )?balance|bank account|upi history|connect(ed)? to (my )?bank|account number", q):
        return "privacy"
    if re.search(r"\b(move|transfer|pay|send|withdraw|execute)\b.*(₹|rs|rupees|money|savings|budget|account)", q):
        return "action_request"
    if re.search(r"\b(stock|mutual fund|equity|crypto|bitcoin|sip)\b.*\b(buy|invest|pick|recommend)\b", q) or re.search(
        r"\b(guarantee|guaranteed|assure|promise)\b.*\b(return|profit|interest)\b", q
    ) or re.search(r"\b20% return|20 % return|double my money\b", q):
        return "unsupported_advice"
    if re.search(r"^(explain|what is|what are)\b", q):
        return "general"
    if re.search(r"international travel", q):
        return "missing_data"
    if has_unknown_goal:
        return "missing_data"
    if goal is not None and re.search(r"goal|fund|track|reach|progress|12 month", q):
        return "goal_status"
    if re.search(r"recurring|subscription audit|repeat payment", q):
        return "recurring"
    if re.search(r"unusual|anomal|unusually large|suspicious|fraud", q):
        return "anomaly"
    if re.search(r"\bcut\b|\breduce\b|if i (save|spend)|scenario|what if", q):
        return "scenario"
    if re.search(r"budget|limit|overrun|over budget", q):
        return "budget_status"
    if merchant:
        return "merchant"
    if re.search(r"compare|versus|\bvs\b|higher than|lower than|increase", q):
        return "comparison"
    if re.search(r"most of my money|top categor|biggest category|where (is|does) my money", q):
        return "top_category"
    if category is not None and re.search(r"spen[dt]|expense|how much did i", q):
        return "category_spending"
    if re.search(r"income|earn|salary|stipend|freelance", q):
        return "income_total"
    if re.search(r"net cash flow|cash flow|saving rate", q):
        return "cash_flow"
    if re.search(r"how much did i spend|total spending|my spending|total expenses", q):
        return "total_spending"
    if re.search(r"^(hi|hello|hey|namaste)\b", q):
        return "greeting"
    if re.search(r"how (should|can|do) i|explain|what is|tips|advice|guide|budget with", q):
        return "general"
    return "ambiguous"


@dataclass
class AIContext:
    intent: str
    question: str
    period_start: date
    period_end: date
    period_label: str
    category_name: str | None = None
    category_id: int | None = None
    goal_name: str | None = None
    merchant: str | None = None
    facts: dict[str, Any] = field(default_factory=dict)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    sources: list[dict[str, Any]] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    scenario: dict[str, Any] | None = None


def _evidence(items: list[dict], item: dict) -> None:
    if len(items) < 12:
        items.append(item)


def build_context(db: Session, user: User, question: str, today: date | None = None) -> AIContext:
    today = today or date.today()
    q = _clean(question)
    categories = list(category_map(db).values())
    category = detect_category(question, categories)
    goals = goals_for_user(db, user.id, today)
    goal = detect_goal(question, goals)
    merchant = detect_merchant(db, user.id, question)
    has_unknown_goal = bool(
        re.search(r"\b(goal|fund)\b", q)
        and goal is None
        and re.search(r"\b(europe|vacation|holiday|wedding|car|house|iphone)\b", q)
    )
    intent = detect_intent(question, category, goal, merchant, has_unknown_goal)
    start, end, label, explicit_period = detect_period(question, today)
    if intent == "merchant" and not explicit_period:
        earliest = db.scalar(
            select(Transaction.occurred_on)
            .where(Transaction.user_id == user.id)
            .order_by(Transaction.occurred_on.asc())
            .limit(1)
        )
        if earliest:
            start = earliest
            label = f"all recorded transactions ({earliest:%b %Y} to {today:%b %Y})"

    context = AIContext(
        intent=intent,
        question=question,
        period_start=start,
        period_end=end,
        period_label=label,
        category_name=category.name if category else None,
        category_id=category.id if category else None,
        goal_name=goal.name if goal else None,
        merchant=merchant,
    )
    context.limitations = [
        "FinSight only analyses records entered in this app; it has no bank or UPI connection.",
        "Recorded facts are separated from estimates and hypothetical scenarios in this answer.",
        "This is educational information, not regulated financial advice.",
    ]

    if intent in {"injection", "privacy", "action_request"}:
        context.facts = {"blocked_request": intent}
        return context

    if intent == "missing_data":
        if "international" in q:
            context.missing.append(
                "No international-travel category or matching recorded transactions exist. "
                "The Travel category contains domestic-trip records only."
            )
        if has_unknown_goal:
            context.missing.append(
                "No goal matching that name exists. Available goals: "
                + ", ".join(goal.name for goal in goals)
                + "."
            )
        context.facts = {
            "missing_data": context.missing,
            "available_categories": [category.name for category in categories],
        }
        return context

    if intent in {"general", "greeting", "ambiguous", "unsupported_advice"}:
        context.facts = {
            "intent": intent,
            "note": {
                "general": "General financial-education question; no personal transaction facts are required.",
                "greeting": "Greeting; ask how FinSight can help.",
                "ambiguous": "The request lacks enough detail for an exact answer.",
                "unsupported_advice": "The request asks for a guarantee or specific investment recommendation, which FinSight will not provide.",
            }[intent],
        }
        if intent == "ambiguous":
            context.missing.append(
                "Name a period, category, budget, goal, or metric so the answer can be calculated."
            )
        retrieved = retrieve_knowledge(db, question, limit=3)
        context.sources = [
            {
                "chunk_id": item.chunk_id,
                "title": item.title,
                "source": item.source,
                "snippet": item.snippet,
                "similarity": item.similarity,
            }
            for item in retrieved
        ]
        return context

    txns = txns_between(db, user.id, start, end)
    txn_likes = txns_like(txns)
    flow = finance.cash_flow(txn_likes)
    top = category_breakdown(txns)

    facts: dict[str, Any] = {
        "question_period": {"label": label, "start": start.isoformat(), "end": end.isoformat()},
        "cash_flow": {
            "income": format_inr(flow.income),
            "expenses": format_inr(flow.expenses),
            "net": format_inr(flow.net),
            "savings_rate": f"{flow.savings_rate:.1f}%" if flow.savings_rate is not None else "not defined",
            "transaction_count": flow.transaction_count,
        },
        "top_categories": [
            {
                "category": item.name,
                "amount": format_inr(item.amount),
                "share": f"{item.percent:.1f}%",
                "transactions": item.transaction_count,
            }
            for item in top[:5]
        ],
    }
    _evidence(
        context.evidence,
        {
            "id": "cash_flow",
            "label": f"Income, expenses and net cash flow for {label}",
            "value": (
                f"Income {format_inr(flow.income)}; expenses {format_inr(flow.expenses)}; "
                f"net {format_inr(flow.net)}"
            ),
            "source": f"Calculated from {flow.transaction_count} owned transactions",
            "route": "/",
        },
    )

    previous_start, previous_end = finance.previous_period(start, end)
    previous_txns = txns_between(db, user.id, previous_start, previous_end)
    previous_top = {item.category_id: item.amount for item in category_breakdown(previous_txns)}
    previous_flow = finance.cash_flow(txns_like(previous_txns))

    if intent in {"category_spending", "comparison"} and category is not None:
        amount = next(
            (item.amount for item in top if item.category_id == category.id), finance.ZERO
        )
        previous_amount = previous_top.get(category.id, finance.ZERO)
        change = finance.percentage_change(amount, previous_amount)
        count = sum(1 for txn in txns if txn.type == "expense" and txn.category_id == category.id)
        previous_count = sum(
            1
            for txn in previous_txns
            if txn.type == "expense" and txn.category_id == category.id
        )
        facts["category"] = {
            "name": category.name,
            "amount": format_inr(amount),
            "transactions": count,
            "previous_period_amount": format_inr(previous_amount),
            "previous_transactions": previous_count,
            "change": f"{change:+.1f}%" if change is not None else "not comparable (zero baseline)",
            "previous_period": {"start": previous_start.isoformat(), "end": previous_end.isoformat()},
        }
        _evidence(
            context.evidence,
            {
                "id": "category_total",
                "label": f"{category.name} spending, {label}",
                "value": f"{format_inr(amount)} across {count} transactions",
                "source": "Category total calculated from owned transactions",
                "route": f"/transactions?category={category.id}",
            },
        )
        _evidence(
            context.evidence,
            {
                "id": "category_previous",
                "label": "Comparable previous period",
                "value": f"{format_inr(previous_amount)}; change {facts['category']['change']}",
                "source": "Same-length immediately preceding period",
                "route": "/analytics",
            },
        )
    elif intent == "total_spending":
        facts["total_spending"] = {
            "amount": format_inr(flow.expenses),
            "transactions": sum(1 for txn in txns if txn.type == "expense"),
            "previous_period": format_inr(previous_flow.expenses),
            "change": (
                f"{finance.percentage_change(flow.expenses, previous_flow.expenses):+.1f}%"
                if finance.percentage_change(flow.expenses, previous_flow.expenses) is not None
                else "not comparable"
            ),
        }
    elif intent == "income_total":
        facts["income"] = {
            "amount": format_inr(flow.income),
            "previous_period": format_inr(previous_flow.income),
            "transactions": sum(1 for txn in txns if txn.type == "income"),
        }
    elif intent == "merchant" and merchant:
        merchant_txns = db.scalars(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.merchant.ilike(f"%{merchant}%"),
                Transaction.occurred_on <= today,
            )
        ).all()
        total = sum((dec(txn.amount) for txn in merchant_txns if txn.type == "expense"), finance.ZERO)
        last_seen = max((txn.occurred_on for txn in merchant_txns), default=None)
        facts["merchant"] = {
            "name": merchant,
            "total": format_inr(total),
            "transactions": len(merchant_txns),
            "last_seen": last_seen.isoformat() if last_seen else None,
            "average": format_inr(total / len(merchant_txns)) if merchant_txns else format_inr(0),
        }
        _evidence(
            context.evidence,
            {
                "id": "merchant_total",
                "label": f"Spending at {merchant}",
                "value": f"{format_inr(total)} across {len(merchant_txns)} recorded transactions",
                "source": "Merchant-name match in owned transactions",
                "route": f"/transactions?search={merchant}",
            },
        )
    elif intent == "top_category":
        if not top:
            context.missing.append(f"No expense transactions were recorded for {label}.")
        else:
            facts["top_category"] = {
                "name": top[0].name,
                "amount": format_inr(top[0].amount),
                "share": f"{top[0].percent:.1f}%",
                "runner_up": top[1].name if len(top) > 1 else None,
            }
            _evidence(
                context.evidence,
                {
                    "id": "top_category",
                    "label": f"Largest expense category in {label}",
                    "value": (
                        f"{top[0].name} {format_inr(top[0].amount)} "
                        f"({top[0].percent:.1f}% of recorded expenses)"
                    ),
                    "source": "Category aggregation of owned transactions",
                    "route": "/analytics",
                },
            )

    if intent in {"budget_status", "comparison", "category_spending", "total_spending"}:
        month_for_budgets = date(end.year, end.month, 1)
        budgets = budgets_for_month(db, user.id, month_for_budgets, today)
        if category is not None and intent in {"budget_status", "category_spending"}:
            budgets = [budget for budget in budgets if budget.category.id == category.id]
        budget_facts = []
        for budget in budgets[:6]:
            budget_facts.append(
                {
                    "category": budget.category.name,
                    "limit": format_inr(budget.limit_amount),
                    "spent": format_inr(budget.actual_spend),
                    "remaining": format_inr(budget.remaining),
                    "utilization": f"{budget.utilization:.1f}%",
                    "status": budget.status,
                    "projected_spend": (
                        format_inr(budget.risk.projected_spend) if budget.risk else None
                    ),
                    "projected_utilization": (
                        f"{budget.risk.projected_utilization:.1f}%" if budget.risk else None
                    ),
                    "reliability": budget.risk.reliability if budget.risk else None,
                }
            )
            _evidence(
                context.evidence,
                {
                    "id": f"budget_{budget.id}",
                    "label": f"{budget.category.name} budget for {budget.month:%B %Y}",
                    "value": (
                        f"Spent {format_inr(budget.actual_spend)} of {format_inr(budget.limit_amount)} "
                        f"({budget.utilization:.1f}%); status {budget.status}"
                    ),
                    "source": "Budget limit and owned expense transactions",
                    "route": "/budgets",
                },
            )
        facts["budgets"] = budget_facts
        if intent == "budget_status" and not budget_facts:
            context.missing.append(
                f"No budget is configured for {context.category_name or 'this period'}."
            )

    if intent == "goal_status" and goal is not None:
        facts["goal"] = {
            "name": goal.name,
            "target": format_inr(goal.target_amount),
            "saved": format_inr(goal.saved_amount),
            "remaining": format_inr(goal.remaining_amount),
            "progress": f"{goal.progress_percent:.1f}%",
            "required_monthly": (
                format_inr(goal.required_monthly) if goal.required_monthly is not None else None
            ),
            "average_monthly_contribution": format_inr(goal.average_monthly_contribution),
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "status": goal.status,
            "estimated_completion": (
                goal.estimated_completion.isoformat() if goal.estimated_completion else None
            ),
        }
        _evidence(
            context.evidence,
            {
                "id": f"goal_{goal.id}",
                "label": f"{goal.name} goal",
                "value": (
                    f"Saved {format_inr(goal.saved_amount)} of {format_inr(goal.target_amount)} "
                    f"({goal.progress_percent:.1f}%), remaining {format_inr(goal.remaining_amount)}"
                ),
                "source": "Goal target and owned contributions",
                "route": "/goals",
            },
        )
        if "12 month" in q or "12 months" in q:
            monthly = goal.average_monthly_contribution
            facts["goal"]["horizon_check"] = (
                f"At the recent average of {format_inr(monthly)} per month, "
                f"reaching {format_inr(goal.remaining_amount)} more takes about "
                f"{int((goal.remaining_amount / monthly).to_integral_value(rounding='ROUND_CEILING'))} months."
                if monthly > 0
                else "No recent contribution pace is available to test a 12-month horizon."
            )
    elif intent == "goal_status" and goal is None:
        context.missing.append("No matching savings goal exists. Goals: " + ", ".join(g.name for g in goals) + ".")

    if intent == "recurring":
        history = txns_between(db, user.id, today - timedelta(days=220), today)
        candidates = finance.detect_recurring_payments(txns_like(history), today)
        overrides = {
            row.merchant_key: row.status
            for row in db.scalars(
                select(RecurringOverride).where(RecurringOverride.user_id == user.id)
            ).all()
        }
        facts["recurring_candidates"] = [
            {
                "merchant": item.merchant,
                "average": format_inr(item.average_amount),
                "frequency": item.frequency,
                "occurrences": item.occurrences,
                "confidence": f"{item.confidence:.0%}",
                "status": "confirmed" if overrides.get(item.merchant_key) == "confirmed" else "candidate",
            }
            for item in candidates[:5]
        ]
        for item in candidates[:3]:
            _evidence(
                context.evidence,
                {
                    "id": f"recurring_{item.merchant_key}",
                    "label": f"Recurring candidate: {item.merchant}",
                    "value": (
                        f"{item.occurrences} payments averaging {format_inr(item.average_amount)}, "
                        f"{item.frequency}, confidence {item.confidence:.0%}"
                    ),
                    "source": "Merchant, amount and interval similarity detection",
                    "route": "/analytics?tab=recurring",
                },
            )
        if not candidates:
            context.missing.append("No recurring-payment candidates were detected in the last 220 days.")

    if intent == "anomaly":
        history = txns_between(db, user.id, today - timedelta(days=220), today)
        anomalies = finance.detect_anomalies(txns_like(history), today)
        facts["unusual_indicators"] = [
            {
                "merchant": item.merchant,
                "amount": format_inr(item.amount),
                "date": item.occurred_on.isoformat(),
                "category_median": format_inr(item.median_amount),
                "score": item.score,
                "note": "unusual-spending indicator, not fraud",
            }
            for item in anomalies[:3]
        ]
        for item in anomalies[:3]:
            _evidence(
                context.evidence,
                {
                    "id": f"anomaly_{item.transaction_id}",
                    "label": f"Unusual-spending indicator at {item.merchant}",
                    "value": (
                        f"{format_inr(item.amount)} vs category median {format_inr(item.median_amount)}; "
                        f"robust score {item.score:.1f}"
                    ),
                    "source": "Median/MAD detector on owned transaction history",
                    "route": f"/transactions?flagged={item.transaction_id}",
                },
            )
        if not anomalies:
            context.missing.append("No unusual-spending indicators crossed the threshold recently.")

    if intent == "scenario":
        percent_match = re.search(r"(\d+(?:\.\d+)?)\s*%", q)
        percent = Decimal(percent_match.group(1)) if percent_match else Decimal("10")
        months_match = re.search(r"(\d+)\s*months?", q)
        months = int(months_match.group(1)) if months_match else 6
        if "six months" in q:
            months = 6
        chosen = category
        if chosen is None:
            chosen = next((c for c in categories if c.slug == "food-dining"), None)
        if chosen is not None:
            month_start = date(today.year, today.month, 1)
            start_month = finance.add_months(month_start, -3)
            _, end_prev = finance.month_bounds(finance.add_months(month_start, -1))
            base_txns = txns_between(db, user.id, start_month, end_prev)
            baseline = finance.average_monthly_baseline(
                txns_like(base_txns), start_month, end_prev
            )
            used_partial_month = False
            if baseline.months_used == 0:
                base_txns = txns_between(db, user.id, month_start, today)
                baseline = finance.average_monthly_baseline(
                    txns_like(base_txns), month_start, today
                )
                used_partial_month = True
            monthly_total = baseline.category_spend.get(chosen.id, finance.ZERO)
            monthly_saving = finance.q(monthly_total * percent / Decimal(100))
            total_saving = finance.q(monthly_saving * Decimal(months))
            baseline_label = (
                "current partial month"
                if used_partial_month
                else f"{baseline.months_used} observed month"
                f"{'' if baseline.months_used == 1 else 's'}"
            )
            context.scenario = {
                "category": chosen.name,
                "percent": float(percent),
                "months": months,
                "baseline_monthly_spend": format_inr(monthly_total),
                "monthly_saving": format_inr(monthly_saving),
                "total_saving": format_inr(total_saving),
                "baseline_label": baseline_label,
                "months_used": baseline.months_used,
                "uses_partial_month": used_partial_month,
            }
            facts["hypothetical_scenario"] = {
                **context.scenario,
                "label": "Hypothetical, not a prediction",
            }
            _evidence(
                context.evidence,
                {
                    "id": "scenario",
                    "label": "Hypothetical category reduction",
                    "value": (
                        f"Reduce {chosen.name} by {percent}% from a {baseline_label} "
                        f"baseline of {format_inr(monthly_total)}/month for {months} "
                        f"months = {format_inr(total_saving)}"
                    ),
                    "source": "Deterministic scenario arithmetic on observed months",
                    "route": "/analytics?tab=scenarios",
                },
            )
        else:
            context.missing.append("The category needed for this scenario could not be identified.")

    if intent in {"top_category", "comparison", "total_spending", "category_spending"}:
        facts["comparison_period"] = {
            "label": f"previous period ({previous_start.isoformat()} to {previous_end.isoformat()})",
            "income": format_inr(previous_flow.income),
            "expenses": format_inr(previous_flow.expenses),
            "net": format_inr(previous_flow.net),
        }

    if intent == "missing_data":
        if "international" in q:
            context.missing.append(
                "No international-travel category or matching recorded transactions exist. "
                "The Travel category contains domestic-trip records only."
            )
        if has_unknown_goal:
            context.missing.append(
                "No goal matching that name exists. Available goals: "
                + ", ".join(goal.name for goal in goals)
                + "."
            )
        context.facts = {"missing_data": context.missing, "available_categories": [c.name for c in categories]}
        return context

    context.facts = facts
    retrieved = retrieve_knowledge(db, question, limit=3)
    context.sources = [
        {
            "chunk_id": item.chunk_id,
            "title": item.title,
            "source": item.source,
            "snippet": item.snippet,
            "similarity": item.similarity,
        }
        for item in retrieved
    ]
    if not retrieved:
        context.limitations.append("No knowledge-base reference was retrieved for this question.")
    return context
