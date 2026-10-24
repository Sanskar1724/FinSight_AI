"""Idempotent demo seed for FinSight AI.

Run:
    python -m app.seed            # create reference data and demo user if absent
    python -m app.seed --reset    # delete and recreate the fictional demo account

All numbers are fictional and reproducible for a given run date (fixed RNG
seed), and every dashboard figure is derived from these records.
"""

from __future__ import annotations

import argparse
import random
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import SessionLocal, utcnow
from app.models import (
    Budget,
    Bill,
    Category,
    GoalContribution,
    KnowledgeChunk,
    KnowledgeDocument,
    NotificationPreference,
    ResearchCase,
    SavingsGoal,
    Transaction,
    User,
)
from app.seed_data import CATEGORIES, KNOWLEDGE_DOCUMENTS, RESEARCH_CASES
from app.services.finance import add_months, month_bounds, q
from app.services.knowledge import chunk_text, embed_text

DEMO_ANOMALY_MONTH_DAY = 2

FOOD_MERCHANTS = [
    "Swiggy",
    "Zomato",
    "Third Wave Coffee",
    "Rameshwaram Cafe",
    "Chai Point",
    "Domino's",
    "College Canteen",
]
GROCERY_MERCHANTS = ["BigBasket", "DMart", "Blinkit", "Zepto", "Local Kirana"]
TRANSPORT_MERCHANTS = ["Uber", "Ola", "Namma Metro", "Rapido", "IndianOil"]
SHOPPING_MERCHANTS = ["Amazon.in", "Myntra", "Flipkart", "Decathlon"]
HEALTHCARE_MERCHANTS = ["Apollo Pharmacy", "Practo", "Wellness Forever"]
EDUCATION_MERCHANTS = ["Coursera", "College Bookstore", "Udemy"]
TRAVEL_MERCHANTS = ["IRCTC", "MakeMyTrip"]


def seed_reference_data(db: Session) -> dict[str, Category]:
    categories: dict[str, Category] = {}
    for payload in CATEGORIES:
        category = db.scalar(select(Category).where(Category.slug == payload["slug"]))
        if category is None:
            category = Category(**payload)
            db.add(category)
        else:
            category.name = payload["name"]
            category.kind = payload["kind"]
            category.icon = payload["icon"]
            category.color = payload["color"]
        categories[payload["slug"]] = category
    db.flush()

    for document_payload in KNOWLEDGE_DOCUMENTS:
        document = db.scalar(
            select(KnowledgeDocument).where(KnowledgeDocument.title == document_payload["title"])
        )
        if document is None:
            document = KnowledgeDocument(**document_payload)
            db.add(document)
            db.flush()
        else:
            document.source = document_payload["source"]
            document.content = document_payload["content"]
        existing_chunks = db.scalars(
            select(KnowledgeChunk).where(KnowledgeChunk.document_id == document.id)
        ).all()
        if not existing_chunks:
            for index, content in enumerate(chunk_text(document.content)):
                db.add(
                    KnowledgeChunk(
                        document_id=document.id,
                        chunk_index=index,
                        content=content,
                        embedding_json=embed_text(content),
                        keywords=content[:300],
                    )
                )

    for case_payload in RESEARCH_CASES:
        case = db.scalar(select(ResearchCase).where(ResearchCase.slug == case_payload["slug"]))
        if case is None:
            db.add(ResearchCase(**case_payload))
        else:
            case.category = case_payload["category"]
            case.question_template = case_payload["question_template"]
            case.focus = case_payload["focus"]

    db.flush()
    return categories


def _paise_split(total: Decimal, count: int, rng: random.Random, minimum: Decimal = Decimal("39")) -> list[Decimal]:
    """Split a target total into realistic, positive amounts using integers."""
    total_paise = int(total * 100)
    min_paise = int(minimum * 100)
    weights = [rng.uniform(0.55, 1.65) for _ in range(count)]
    weight_sum = sum(weights)
    allocations = [max(min_paise, int(total_paise * weight / weight_sum)) for weight in weights]
    difference = total_paise - sum(allocations)
    index = 0
    while difference != 0:
        step = 1 if difference > 0 else -1
        candidate = allocations[index % count] + step
        if candidate >= min_paise:
            allocations[index % count] = candidate
            difference -= step
        index += 1
        if index > count * 100:
            break
    return [Decimal(value) / Decimal(100) for value in allocations]


def _days(count: int, max_day: int, rng: random.Random) -> list[int]:
    max_day = max(1, max_day)
    return sorted(rng.randint(1, max_day) for _ in range(count))


def _add_transaction(
    db: Session,
    user: User,
    category: Category,
    txn_type: str,
    amount: Decimal,
    occurred_on: date,
    merchant: str,
    rng: random.Random,
    note: str = "Fictional demo data",
) -> Transaction:
    payment_method = rng.choices(["UPI", "Card", "Netbanking", "Cash"], weights=[72, 16, 7, 5])[0]
    txn = Transaction(
        user_id=user.id,
        category_id=category.id,
        type=txn_type,
        amount=q(amount),
        occurred_on=occurred_on,
        merchant=merchant,
        payment_method=payment_method,
        notes=note,
    )
    db.add(txn)
    return txn


def _seed_transactions(
    db: Session, user: User, categories: dict[str, Category], today: date
) -> None:
    rng = random.Random(20261023)
    current_month = date(today.year, today.month, 1)

    for offset in range(-5, 1):
        month = add_months(current_month, offset)
        _, month_end = month_bounds(month)
        max_day = today.day if offset == 0 else month_end.day

        salary = Decimal("45000") if offset >= -2 else Decimal("42000")
        _add_transaction(
            db,
            user,
            categories["salary"],
            "income",
            salary,
            date(month.year, month.month, min(1, max_day)),
            "Nexora Technologies Pvt Ltd",
            rng,
            "Monthly salary credit (fictional)",
        )

        if offset in {-4, -2}:
            freelance_amount = Decimal("12000") if offset == -4 else Decimal("8000")
            _add_transaction(
                db,
                user,
                categories["freelance-income"],
                "income",
                freelance_amount,
                date(month.year, month.month, min(15, max_day)),
                "Freelance client - design sprint",
                rng,
            )
        if offset == -3:
            _add_transaction(
                db,
                user,
                categories["stipend"],
                "income",
                Decimal("2500"),
                date(month.year, month.month, min(20, max_day)),
                "University exam invigilation",
                rng,
            )

        _add_transaction(
            db,
            user,
            categories["rent"],
            "expense",
            Decimal("12000"),
            date(month.year, month.month, min(2, max_day)),
            "Landlord - Indiranagar flat",
            rng,
        )
        _add_transaction(
            db,
            user,
            categories["subscriptions"],
            "expense",
            Decimal("649"),
            date(month.year, month.month, min(5, max_day)),
            "Netflix",
            rng,
        )
        _add_transaction(
            db,
            user,
            categories["subscriptions"],
            "expense",
            Decimal("119"),
            date(month.year, month.month, min(7, max_day)),
            "Spotify",
            rng,
        )
        _add_transaction(
            db,
            user,
            categories["subscriptions"],
            "expense",
            Decimal("799"),
            date(month.year, month.month, min(11, max_day)),
            "Notion Labs",
            rng,
        )
        _add_transaction(
            db,
            user,
            categories["utilities"],
            "expense",
            Decimal("999"),
            date(month.year, month.month, min(8, max_day)),
            "ACT Fibernet",
            rng,
        )
        electricity = Decimal(rng.choice(["1340", "1480", "1610", "1890"]))
        _add_transaction(
            db,
            user,
            categories["utilities"],
            "expense",
            electricity,
            date(month.year, month.month, min(9, max_day)),
            "BESCOM electricity",
            rng,
        )
        _add_transaction(
            db,
            user,
            categories["utilities"],
            "expense",
            Decimal("299"),
            date(month.year, month.month, min(12, max_day)),
            "Airtel prepaid",
            rng,
        )

        if offset == 0:
            targets = {
                "food-dining": Decimal("4050"),
                "groceries": Decimal("3050"),
                "transport": Decimal("1800"),
                "shopping": Decimal("4350"),
            }
        else:
            targets = {
                "food-dining": Decimal(rng.choice(["5100", "5480", "5720"])),
                "groceries": Decimal(rng.choice(["4150", "4620", "4980"])),
                "transport": Decimal(rng.choice(["1580", "1840", "2260"])),
                "shopping": Decimal(rng.choice(["2450", "3180", "4020"])),
            }

        category_merchants = {
            "food-dining": (FOOD_MERCHANTS, 10, Decimal("89")),
            "groceries": (GROCERY_MERCHANTS, 5, Decimal("189")),
            "transport": (TRANSPORT_MERCHANTS, 8, Decimal("45")),
            "shopping": (SHOPPING_MERCHANTS, 3, Decimal("399")),
        }
        for slug, (merchants, count, minimum) in category_merchants.items():
            amounts = _paise_split(targets[slug], count, rng, minimum)
            days = _days(count, max_day, rng)
            for amount, day in zip(amounts, days):
                _add_transaction(
                    db,
                    user,
                    categories[slug],
                    "expense",
                    amount,
                    date(month.year, month.month, max(1, day)),
                    rng.choice(merchants),
                    rng,
                )

        # Healthcare baseline, with a current-month outlier for the anomaly demo.
        for count in range(2):
            _add_transaction(
                db,
                user,
                categories["healthcare"],
                "expense",
                Decimal(rng.choice(["240", "320", "480", "760", "890"])),
                date(month.year, month.month, min(rng.randint(13, 25), max_day)),
                rng.choice(HEALTHCARE_MERCHANTS),
                rng,
            )
        if offset == 0:
            anomaly_day = max(1, min(today.day - DEMO_ANOMALY_MONTH_DAY, max_day))
            _add_transaction(
                db,
                user,
                categories["healthcare"],
                "expense",
                Decimal("4850"),
                date(month.year, month.month, anomaly_day),
                "Apollo Pharmacy",
                rng,
                "Annual health check-up and medicines (fictional outlier)",
            )

        if offset == -4:
            _add_transaction(
                db,
                user,
                categories["travel"],
                "expense",
                Decimal("6740"),
                date(month.year, month.month, min(18, max_day)),
                "MakeMyTrip",
                rng,
                "Weekend trip to Coorg",
            )
        if offset == -2:
            _add_transaction(
                db,
                user,
                categories["travel"],
                "expense",
                Decimal("1845"),
                date(month.year, month.month, min(21, max_day)),
                "IRCTC",
                rng,
                "Train to Chennai",
            )
        if offset == -3:
            _add_transaction(
                db,
                user,
                categories["education"],
                "expense",
                Decimal("3999"),
                date(month.year, month.month, min(6, max_day)),
                "Coursera",
                rng,
                "Data analytics specialisation",
            )
        if offset == -1:
            _add_transaction(
                db,
                user,
                categories["education"],
                "expense",
                Decimal("799"),
                date(month.year, month.month, min(24, max_day)),
                "Udemy",
                rng,
            )

    db.flush()


BUDGET_LIMITS_CURRENT = {
    "food-dining": Decimal("4500"),
    "groceries": Decimal("5000"),
    "transport": Decimal("2500"),
    "shopping": Decimal("4000"),
    "utilities": Decimal("3200"),
    "subscriptions": Decimal("1800"),
    "rent": Decimal("15000"),
}
BUDGET_LIMITS_PRIOR = {
    "food-dining": Decimal("5500"),
    "groceries": Decimal("4800"),
    "transport": Decimal("2200"),
    "shopping": Decimal("3500"),
    "utilities": Decimal("3200"),
    "subscriptions": Decimal("1800"),
    "rent": Decimal("15000"),
}


def _seed_budgets(
    db: Session, user: User, categories: dict[str, Category], today: date
) -> None:
    current_month = date(today.year, today.month, 1)
    for offset in (-2, -1, 0):
        month = add_months(current_month, offset)
        limits = BUDGET_LIMITS_CURRENT if offset == 0 else BUDGET_LIMITS_PRIOR
        for slug, limit in limits.items():
            db.add(
                Budget(
                    user_id=user.id,
                    category_id=categories[slug].id,
                    month=month,
                    limit_amount=limit,
                    warning_threshold=70,
                    critical_threshold=90,
                )
            )
    db.flush()


def _seed_goals(
    db: Session, user: User, categories: dict[str, Category], today: date
) -> None:
    def month_day(offset: int, day: int) -> date:
        month = add_months(date(today.year, today.month, 1), offset)
        _, last = month_bounds(month)
        return date(month.year, month.month, min(day, last.day))

    goals_spec = [
        {
            "name": "Emergency Fund",
            "target": Decimal("100000"),
            "target_date": month_day(10, 1),
            "created": month_day(-8, 1),
            "contributions": [
                (month_day(-7, 3), Decimal("15000"), "Opening transfer"),
                (month_day(-5, 3), Decimal("4500"), "Monthly transfer"),
                (month_day(-4, 3), Decimal("4500"), "Monthly transfer"),
                (month_day(-3, 3), Decimal("4500"), "Monthly transfer"),
                (month_day(-2, 3), Decimal("4500"), "Monthly transfer"),
                (month_day(-1, 3), Decimal("4500"), "Monthly transfer"),
                (month_day(0, min(3, today.day)), Decimal("4500"), "Monthly transfer"),
            ],
        },
        {
            "name": "Japan Trip",
            "target": Decimal("120000"),
            "target_date": month_day(8, 15),
            "created": month_day(-4, 5),
            "contributions": [
                (month_day(-3, 10), Decimal("5000"), "Travel fund start"),
                (month_day(-2, 10), Decimal("4000"), "Monthly transfer"),
                (month_day(-1, 10), Decimal("5000"), "Monthly transfer"),
                (month_day(0, min(10, today.day)), Decimal("3000"), "Monthly transfer"),
            ],
        },
        {
            "name": "New Laptop",
            "target": Decimal("80000"),
            "target_date": month_day(3, 20),
            "created": month_day(-4, 20),
            "contributions": [
                (month_day(-3, 20), Decimal("40000"), "Sold old laptop and saved"),
                (month_day(-2, 20), Decimal("5000"), "Monthly transfer"),
                (month_day(-1, 20), Decimal("5000"), "Monthly transfer"),
                (month_day(0, min(20, today.day)), Decimal("5000"), "Monthly transfer"),
            ],
        },
    ]
    for spec in goals_spec:
        goal = SavingsGoal(
            user_id=user.id,
            name=spec["name"],
            target_amount=spec["target"],
            target_date=spec["target_date"],
            created_at=datetime.combine(spec["created"], datetime.min.time()),
        )
        db.add(goal)
        db.flush()
        for contributed_on, amount, note in spec["contributions"]:
            db.add(
                GoalContribution(
                    goal_id=goal.id,
                    user_id=user.id,
                    amount=amount,
                    contributed_on=contributed_on,
                    note=note,
                )
            )
    db.flush()


def _seed_bills(db: Session, user: User, today: date) -> None:
    db.add_all(
        [
            Bill(user_id=user.id, name="ACT Fibernet bill", amount=Decimal("999"), due_date=today + timedelta(days=4)),
            Bill(
                user_id=user.id,
                name="HDFC Credit Card bill",
                amount=Decimal("12480"),
                due_date=today + timedelta(days=9),
            ),
            Bill(
                user_id=user.id,
                name="College fee instalment",
                amount=Decimal("15000"),
                due_date=today + timedelta(days=18),
            ),
        ]
    )
    db.flush()


def seed_demo(db: Session, reset: bool = False) -> User:
    """Create the fictional demo account, optionally resetting all its records."""
    seed_reference_data(db)
    demo = db.scalar(select(User).where(User.email == settings.demo_email))
    if demo is not None and reset:
        db.delete(demo)
        db.flush()
        demo = None
    if demo is not None:
        if demo.preference is None:
            db.add(NotificationPreference(user_id=demo.id))
            db.flush()
        db.commit()
        return demo

    today = date.today()
    demo = User(
        email=settings.demo_email,
        name=settings.demo_name,
        password_hash=hash_password(settings.demo_password),
        is_demo=True,
        timezone=settings.timezone,
    )
    db.add(demo)
    db.flush()
    categories = seed_reference_data(db)
    db.add(NotificationPreference(user_id=demo.id))
    _seed_transactions(db, demo, categories, today)
    _seed_budgets(db, demo, categories, today)
    _seed_goals(db, demo, categories, today)
    _seed_bills(db, demo, today)
    db.commit()

    from app.services.notifications import evaluate_notifications

    evaluate_notifications(db, demo, force=True)
    db.commit()
    return demo


def reset_demo(db: Session) -> User:
    return seed_demo(db, reset=True)


def ensure_schema_and_demo() -> None:
    from app.db.migrate import upgrade_database

    upgrade_database()
    with SessionLocal() as db:
        seed_demo(db)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed FinSight AI demo data")
    parser.add_argument("--reset", action="store_true", help="Delete and recreate the demo account")
    args = parser.parse_args()
    from app.db.migrate import upgrade_database

    upgrade_database()
    with SessionLocal() as db:
        user = seed_demo(db, reset=args.reset)
        print(f"Demo user ready: {user.email} (id={user.id})")
        print(f"Demo password: {settings.demo_password}")
        print("All demo financial records are fictional.")


if __name__ == "__main__":
    main()
