from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Category, Transaction, User
from tests.conftest import TestingSession


def test_nightly_job_restores_demo_without_touching_real_users(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app import main
    from app.seed import seed_demo

    monkeypatch.setattr(main, "SessionLocal", TestingSession)
    demo = seed_demo(db)
    seeded = db.scalar(select(func.count(Transaction.id)).where(Transaction.user_id == demo.id))

    real = User(email="real@example.com", name="Real", password_hash="x")
    db.add(real)
    db.flush()
    category = db.scalar(select(Category).where(Category.slug == "food-dining"))
    for owner in (demo, real):
        db.add(
            Transaction(
                user_id=owner.id,
                type="expense",
                amount=Decimal("123.00"),
                occurred_on=date.today(),
                category_id=category.id,
                merchant="Visitor edit",
                payment_method="UPI",
            )
        )
    db.commit()
    real_id = real.id

    main.scheduled_demo_reset_job()

    with TestingSession() as check:
        new_demo = check.scalar(select(User).where(User.email == settings.demo_email))
        assert new_demo is not None
        demo_count = check.scalar(
            select(func.count(Transaction.id)).where(Transaction.user_id == new_demo.id)
        )
        assert demo_count == seeded
        assert check.scalar(
            select(func.count(Transaction.id)).where(Transaction.merchant == "Visitor edit")
        ) == 1
        assert check.scalar(
            select(func.count(Transaction.id)).where(Transaction.user_id == real_id)
        ) == 1
