"""Merge royale per-second pools into bullet/blitz/rapid tiers."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM user_ratings
        WHERE pool LIKE 'royale/%'
        """
    )

    op.execute(
        """
        UPDATE games
        SET rating_pool = CASE
            WHEN time_control IN ('royale/1.5', 'royale/3', 'royale/5') THEN 'royale_bullet'
            WHEN time_control IN ('royale/7', 'royale/11', 'royale/15') THEN 'royale_blitz'
            WHEN time_control LIKE 'royale/%' THEN 'royale_rapid'
            ELSE rating_pool
        END
        WHERE game_mode = 'royale'
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


def downgrade() -> None:
    pass
