"""Add invite_token for private competitions."""

import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "competitions",
        sa.Column("invite_token", sa.String(length=64), nullable=True),
    )
    op.create_index(
        op.f("ix_competitions_invite_token"),
        "competitions",
        ["invite_token"],
        unique=True,
    )

    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id FROM competitions WHERE is_public = false AND invite_token IS NULL")
    )
    for row in rows:
        connection.execute(
            sa.text("UPDATE competitions SET invite_token = :token WHERE id = :id"),
            {"token": secrets.token_urlsafe(24), "id": row.id},
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_competitions_invite_token"), table_name="competitions")
    op.drop_column("competitions", "invite_token")
