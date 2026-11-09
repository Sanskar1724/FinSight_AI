"""add accounts, account transfers and transactions.account_id

Revision ID: e3a9c7d2b4f1
Revises: d7b2e9c4a1f5
Create Date: 2026-11-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3a9c7d2b4f1"
down_revision: Union[str, None] = "d7b2e9c4a1f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("institution", sa.String(length=120), nullable=True),
        sa.Column("last4", sa.String(length=4), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="INR"),
        sa.Column("opening_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("opening_date", sa.Date(), nullable=False),
        sa.Column("credit_limit", sa.Numeric(14, 2), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"])
    op.create_index("ix_accounts_user_name", "accounts", ["user_id", "name"])

    op.create_table(
        "account_transfers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "from_account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "to_account_id", sa.Integer(), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=240), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_account_transfers_user_id", "account_transfers", ["user_id"])
    op.create_index("ix_account_transfers_from_account_id", "account_transfers", ["from_account_id"])
    op.create_index("ix_account_transfers_to_account_id", "account_transfers", ["to_account_id"])
    op.create_index("ix_account_transfers_user_date", "account_transfers", ["user_id", "occurred_on"])

    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("account_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_transactions_account_id", ["account_id"])
        batch_op.create_foreign_key(
            "fk_transactions_account_id", "accounts", ["account_id"], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    with op.batch_alter_table("transactions", schema=None) as batch_op:
        batch_op.drop_constraint("fk_transactions_account_id", type_="foreignkey")
        batch_op.drop_index("ix_transactions_account_id")
        batch_op.drop_column("account_id")
    op.drop_table("account_transfers")
    op.drop_table("accounts")
