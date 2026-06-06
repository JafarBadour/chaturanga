"""Competition participant standings columns."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "competition_participants",
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "competition_participants",
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "competition_participants",
        sa.Column("losses", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "competition_participants",
        sa.Column("draws", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "competition_participants",
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("competition_participants", "games_played")
    op.drop_column("competition_participants", "draws")
    op.drop_column("competition_participants", "losses")
    op.drop_column("competition_participants", "wins")
    op.drop_column("competition_participants", "score")
