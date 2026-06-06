"""Per-pool user_ratings table with royale time controls."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STANDARD = ("blitz", "rapid", "classical")


def upgrade() -> None:
    op.create_table(
        "user_ratings",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("pool", sa.String(length=30), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("losses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("draws", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "pool"),
    )
    op.create_index("ix_user_ratings_pool_rating", "user_ratings", ["pool", "rating"])

    for pool in _STANDARD:
        op.execute(
            f"""
            INSERT INTO user_ratings (user_id, pool, rating, games_played, wins, losses, draws)
            SELECT id, '{pool}', rating_{pool}, games_{pool}, wins_{pool}, losses_{pool}, draws_{pool}
            FROM users
            WHERE games_{pool} > 0
            """
        )

    op.execute(
        """
        UPDATE games SET rating_pool = time_control
        WHERE game_mode = 'royale' AND rating_pool = 'royale'
        """
    )


def downgrade() -> None:
    op.drop_index("ix_user_ratings_pool_rating", table_name="user_ratings")
    op.drop_table("user_ratings")
