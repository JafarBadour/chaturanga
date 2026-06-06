"""Direct game challenges via shareable links."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_challenges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("creator_id", sa.String(length=36), nullable=False),
        sa.Column("opponent_id", sa.String(length=36), nullable=True),
        sa.Column("time_control", sa.String(length=20), nullable=False),
        sa.Column("game_mode", sa.String(length=20), nullable=False),
        sa.Column("game_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opponent_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_game_challenges_token", "game_challenges", ["token"], unique=True)
    op.create_index("ix_game_challenges_creator_id", "game_challenges", ["creator_id"])
    op.create_index("ix_game_challenges_status", "game_challenges", ["status"])


def downgrade() -> None:
    op.drop_index("ix_game_challenges_status", table_name="game_challenges")
    op.drop_index("ix_game_challenges_creator_id", table_name="game_challenges")
    op.drop_index("ix_game_challenges_token", table_name="game_challenges")
    op.drop_table("game_challenges")
