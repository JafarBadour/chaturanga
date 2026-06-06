"""Extend competitions with visibility, capacity, duration, time control."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "competitions",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column("competitions", sa.Column("max_participants", sa.Integer(), nullable=True))
    op.add_column("competitions", sa.Column("duration_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "competitions",
        sa.Column("time_control", sa.String(length=20), nullable=False, server_default="5+0"),
    )
    op.add_column(
        "competitions",
        sa.Column("rating_pool", sa.String(length=30), nullable=False, server_default="blitz"),
    )


def downgrade() -> None:
    op.drop_column("competitions", "rating_pool")
    op.drop_column("competitions", "time_control")
    op.drop_column("competitions", "duration_minutes")
    op.drop_column("competitions", "max_participants")
    op.drop_column("competitions", "is_public")
