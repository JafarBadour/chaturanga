"""SQLAlchemy database models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    rating: Mapped[int] = mapped_column(Integer, default=1500)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ratings: Mapped[list["UserRating"]] = relationship(
        "UserRating", back_populates="user", cascade="all, delete-orphan"
    )

    games_as_white: Mapped[list["Game"]] = relationship(
        "Game", foreign_keys="Game.white_user_id", back_populates="white_player"
    )
    games_as_black: Mapped[list["Game"]] = relationship(
        "Game", foreign_keys="Game.black_user_id", back_populates="black_player"
    )


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    white_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    black_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    fen: Mapped[str] = mapped_column(
        String(100),
        default="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    )
    pgn: Mapped[str] = mapped_column(Text, default="")
    moves: Mapped[str] = mapped_column(Text, default="")
    time_control: Mapped[str] = mapped_column(String(20), default="5+0")
    game_mode: Mapped[str] = mapped_column(String(20), default="standard")
    move_limit_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_strikes: Mapped[int] = mapped_column(Integer, default=0)
    black_strikes: Mapped[int] = mapped_column(Integer, default=0)
    initial_time_ms: Mapped[int] = mapped_column(Integer, default=300000)
    increment_ms: Mapped[int] = mapped_column(Integer, default=0)
    white_time_ms: Mapped[int] = mapped_column(Integer, default=300000)
    black_time_ms: Mapped[int] = mapped_column(Integer, default=300000)
    status: Mapped[str] = mapped_column(String(20), default="active")
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    termination: Mapped[str | None] = mapped_column(String(30), nullable=True)
    rating_pool: Mapped[str] = mapped_column(String(30), default="blitz")
    white_rating_before: Mapped[int] = mapped_column(Integer, default=1500)
    black_rating_before: Mapped[int] = mapped_column(Integer, default=1500)
    white_rating_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_rating_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_move_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    competition_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("competitions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    white_player: Mapped["User"] = relationship(
        "User", foreign_keys=[white_user_id], back_populates="games_as_white"
    )
    black_player: Mapped["User"] = relationship(
        "User", foreign_keys=[black_user_id], back_populates="games_as_black"
    )


class GameChallenge(Base):
    __tablename__ = "game_challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    creator_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    opponent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    time_control: Mapped[str] = mapped_column(String(20))
    game_mode: Mapped[str] = mapped_column(String(20))
    game_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

    creator: Mapped["User"] = relationship("User", foreign_keys=[creator_id])
    opponent: Mapped["User | None"] = relationship("User", foreign_keys=[opponent_id])


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class UserRating(Base):
    __tablename__ = "user_ratings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    pool: Mapped[str] = mapped_column(String(30), primary_key=True)
    rating: Mapped[int] = mapped_column(Integer, default=1500)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship("User", back_populates="ratings")


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100))
    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    game_mode: Mapped[str] = mapped_column(String(20), default="standard")
    format: Mapped[str] = mapped_column(String(20), default="swiss")
    status: Mapped[str] = mapped_column(String(20), default="upcoming", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    invite_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_control: Mapped[str] = mapped_column(String(20), default="5+0")
    rating_pool: Mapped[str] = mapped_column(String(30), default="blitz")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    created_by: Mapped["User"] = relationship("User")
    participants: Mapped[list["CompetitionParticipant"]] = relationship(
        "CompetitionParticipant", back_populates="competition", cascade="all, delete-orphan"
    )


class CompetitionParticipant(Base):
    __tablename__ = "competition_participants"

    competition_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("competitions.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    score: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    games_played: Mapped[int] = mapped_column(Integer, default=0)

    competition: Mapped["Competition"] = relationship("Competition", back_populates="participants")
    user: Mapped["User"] = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User")
