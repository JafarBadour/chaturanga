"""Add competition_id to games."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column("competition_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_games_competition_id",
        "games",
        "competitions",
        ["competition_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_games_competition_id"), "games", ["competition_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_games_competition_id"), table_name="games")
    op.drop_constraint("fk_games_competition_id", "games", type_="foreignkey")
    op.drop_column("games", "competition_id")
