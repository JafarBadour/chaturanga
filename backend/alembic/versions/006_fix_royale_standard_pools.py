"""Fix royale vs standard rating pools and drop legacy user rating columns."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_LEGACY_POOL_COLUMNS = ("blitz", "rapid", "classical", "royale")


def upgrade() -> None:
    op.alter_column(
        "games",
        "rating_pool",
        existing_type=sa.String(length=20),
        type_=sa.String(length=30),
        existing_nullable=False,
    )

    op.execute(
        """
        UPDATE games
        SET game_mode = 'standard'
        WHERE game_mode = 'classic'
        """
    )

    op.execute(
        """
        UPDATE games
        SET game_mode = 'royale', rating_pool = time_control
        WHERE time_control LIKE 'royale/%'
        """
    )

    op.execute(
        """
        UPDATE games
        SET rating_pool = CASE
            WHEN (initial_time_ms / 60000) < 10 THEN 'blitz'
            WHEN (initial_time_ms / 60000) < 30 THEN 'rapid'
            ELSE 'classical'
        END
        WHERE game_mode = 'standard'
        """
    )

    bind = op.get_bind()
    from sqlalchemy.orm import Session

    from app.services.rating_service import rating_service

    session = Session(bind=bind)
    try:
        rating_service.rebuild_all_ratings(session)
    finally:
        session.close()

    for pool in _LEGACY_POOL_COLUMNS:
        op.drop_column("users", f"draws_{pool}")
        op.drop_column("users", f"losses_{pool}")
        op.drop_column("users", f"wins_{pool}")
        op.drop_column("users", f"games_{pool}")
        op.drop_column("users", f"rating_{pool}")


def downgrade() -> None:
    for pool in _LEGACY_POOL_COLUMNS:
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

    op.alter_column(
        "games",
        "rating_pool",
        existing_type=sa.String(length=30),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
