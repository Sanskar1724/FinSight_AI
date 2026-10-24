"""add users.terms_accepted_at for sign-up consent

Revision ID: d7b2e9c4a1f5
Revises: c4e8a1f0b2d3
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7b2e9c4a1f5"
down_revision: Union[str, None] = "c4e8a1f0b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("terms_accepted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("terms_accepted_at")
