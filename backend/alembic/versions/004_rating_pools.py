"""Per-pool ratings: blitz, rapid, classical, royale."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_POOLS = ("blitz", "rapid", "classical", "royale")


def upgrade() -> None:
    for pool in _POOLS:
        op.add_column(
            "users",
            sa.Column(f"rating_{pool}", sa.Integer(), nullable=False, server_default="1500"),
        )
        op.add_column(
            "users",
            sa.Column(f"games_{pool}", sa.Integer(), nullable=False, server_default="0"),
        )
        op.add_column(
            "users",
            sa.Column(f"wins_{pool}", sa.Integer(), nullable=False, server_default="0"),
        )
        op.add_column(
            "users",
            sa.Column(f"losses_{pool}", sa.Integer(), nullable=False, server_default="0"),
        )
        op.add_column(
            "users",
            sa.Column(f"draws_{pool}", sa.Integer(), nullable=False, server_default="0"),
        )

    op.add_column(
        "games",
        sa.Column("rating_pool", sa.String(length=20), nullable=False, server_default="blitz"),
    )

    op.execute(
        """
        UPDATE users SET
            rating_blitz = rating,
            games_blitz = games_played,
            wins_blitz = wins,
            losses_blitz = losses,
            draws_blitz = draws
        """
    )


def downgrade() -> None:
    op.drop_column("games", "rating_pool")
    for pool in reversed(_POOLS):
        op.drop_column("users", f"draws_{pool}")
        op.drop_column("users", f"losses_{pool}")
        op.drop_column("users", f"wins_{pool}")
        op.drop_column("users", f"games_{pool}")
        op.drop_column("users", f"rating_{pool}")
