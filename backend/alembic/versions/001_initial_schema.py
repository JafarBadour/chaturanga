"""Initial schema (consolidated from migrations 001–015).

Revision ID: 001
Revises:
Create Date: 2026-06-06

Fresh installs only. If you previously ran the old multi-step migrations,
drop all tables (or reset the database) before ``alembic upgrade head``.
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
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "token_blacklist",
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index(op.f("ix_token_blacklist_expires_at"), "token_blacklist", ["expires_at"])

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

    op.create_table(
        "competitions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("game_mode", sa.String(length=20), nullable=False, server_default="standard"),
        sa.Column("format", sa.String(length=20), nullable=False, server_default="swiss"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="upcoming"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("min_rating", sa.Integer(), nullable=True),
        sa.Column("max_rating", sa.Integer(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("invite_token", sa.String(length=64), nullable=True),
        sa.Column("max_participants", sa.Integer(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("time_control", sa.String(length=20), nullable=False, server_default="5+0"),
        sa.Column("rating_pool", sa.String(length=30), nullable=False, server_default="blitz"),
        sa.Column("starts_at", sa.DateTime(), nullable=True),
        sa.Column("ends_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_competitions_status"), "competitions", ["status"])
    op.create_index(op.f("ix_competitions_invite_token"), "competitions", ["invite_token"], unique=True)

    op.create_table(
        "competition_participants",
        sa.Column("competition_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wins", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("losses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("draws", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("competition_id", "user_id"),
    )

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
        sa.Column("pgn", sa.Text(), nullable=False),
        sa.Column("moves", sa.Text(), nullable=False),
        sa.Column("time_control", sa.String(length=20), nullable=False, server_default="5+0"),
        sa.Column("game_mode", sa.String(length=20), nullable=False, server_default="standard"),
        sa.Column("move_limit_ms", sa.Integer(), nullable=True),
        sa.Column("white_strikes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("black_strikes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("initial_time_ms", sa.Integer(), nullable=False, server_default="300000"),
        sa.Column("increment_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("white_time_ms", sa.Integer(), nullable=False, server_default="300000"),
        sa.Column("black_time_ms", sa.Integer(), nullable=False, server_default="300000"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("result", sa.String(length=20), nullable=True),
        sa.Column("termination", sa.String(length=30), nullable=True),
        sa.Column("rating_pool", sa.String(length=30), nullable=False, server_default="blitz"),
        sa.Column("white_rating_before", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("black_rating_before", sa.Integer(), nullable=False, server_default="1500"),
        sa.Column("white_rating_after", sa.Integer(), nullable=True),
        sa.Column("black_rating_after", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("last_move_at", sa.DateTime(), nullable=True),
        sa.Column("competition_id", sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(["black_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["white_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_games_competition_id"), "games", ["competition_id"])

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
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["opponent_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_game_challenges_token", "game_challenges", ["token"], unique=True)
    op.create_index("ix_game_challenges_creator_id", "game_challenges", ["creator_id"])
    op.create_index("ix_game_challenges_status", "game_challenges", ["status"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"])
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", "read_at", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_unread", table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_game_challenges_status", table_name="game_challenges")
    op.drop_index("ix_game_challenges_creator_id", table_name="game_challenges")
    op.drop_index("ix_game_challenges_token", table_name="game_challenges")
    op.drop_table("game_challenges")

    op.drop_index(op.f("ix_games_competition_id"), table_name="games")
    op.drop_table("games")

    op.drop_table("competition_participants")

    op.drop_index(op.f("ix_competitions_invite_token"), table_name="competitions")
    op.drop_index(op.f("ix_competitions_status"), table_name="competitions")
    op.drop_table("competitions")

    op.drop_index("ix_user_ratings_pool_rating", table_name="user_ratings")
    op.drop_table("user_ratings")

    op.drop_index(op.f("ix_token_blacklist_expires_at"), table_name="token_blacklist")
    op.drop_table("token_blacklist")

    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
