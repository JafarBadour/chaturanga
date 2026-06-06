"""Initial schema: users and games

Revision ID: 001
Revises:
Create Date: 2026-06-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("losses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("draws", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "games",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("white_user_id", sa.String(length=36), nullable=False),
        sa.Column("black_user_id", sa.String(length=36), nullable=False),
        sa.Column(
            "fen",
            sa.String(length=100),
            nullable=False,
            server_default="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        ),
        sa.Column("pgn", sa.Text(), nullable=False, server_default=""),
        sa.Column("moves", sa.Text(), nullable=False, server_default=""),
        sa.Column("time_control", sa.String(length=20), nullable=False, server_default="5+0"),
        sa.Column("initial_time_ms", sa.Integer(), nullable=False, server_default="300000"),
        sa.Column("increment_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("white_time_ms", sa.Integer(), nullable=False, server_default="300000"),
        sa.Column("black_time_ms", sa.Integer(), nullable=False, server_default="300000"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("result", sa.String(length=20), nullable=True),
        sa.Column("termination", sa.String(length=30), nullable=True),
        sa.Column("white_rating_before", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("black_rating_before", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("white_rating_after", sa.Integer(), nullable=True),
        sa.Column("black_rating_after", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("last_move_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["black_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["white_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("games")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
