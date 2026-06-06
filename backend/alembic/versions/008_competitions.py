"""Add competitions table."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "competitions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("game_mode", sa.String(length=20), nullable=False, server_default="standard"),
        sa.Column("format", sa.String(length=20), nullable=False, server_default="swiss"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="upcoming"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("min_rating", sa.Integer(), nullable=True),
        sa.Column("max_rating", sa.Integer(), nullable=True),
        sa.Column("starts_at", sa.DateTime(), nullable=True),
        sa.Column("ends_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_competitions_status"), "competitions", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_competitions_status"), table_name="competitions")
    op.drop_table("competitions")
