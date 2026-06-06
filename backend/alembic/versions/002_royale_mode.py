"""Add Chess Royale per-move timer fields."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column("game_mode", sa.String(length=20), nullable=False, server_default="classic"),
    )
    op.add_column("games", sa.Column("move_limit_ms", sa.Integer(), nullable=True))
    op.add_column(
        "games",
        sa.Column("white_strikes", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "games",
        sa.Column("black_strikes", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("games", "black_strikes")
    op.drop_column("games", "white_strikes")
    op.drop_column("games", "move_limit_ms")
    op.drop_column("games", "game_mode")
