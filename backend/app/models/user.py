"""Pydantic schemas for auth and users."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.db.models import User
from app.utils.rating_pools import get_all_user_ratings


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class PoolStats(BaseModel):
    rating: int
    games_played: int
    wins: int
    losses: int
    draws: int


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    rating: int
    games_played: int
    wins: int
    losses: int
    draws: int
    ratings: dict[str, PoolStats]
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, db: Session, user: User) -> "UserResponse":
        ratings = {
            pool: PoolStats(**stats) for pool, stats in get_all_user_ratings(db, user.id).items()
        }
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            rating=user.rating,
            games_played=user.games_played,
            wins=user.wins,
            losses=user.losses,
            draws=user.draws,
            ratings=ratings,
            created_at=user.created_at,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LadderEntry(BaseModel):
    rank: int
    id: str
    username: str
    pool: str
    rating: int
    games_played: int
    wins: int
    losses: int
    draws: int

    class Config:
        from_attributes = True


class LadderPoolInfo(BaseModel):
    id: str
    label: str
    group: str
    hint: str = ""


class LadderViewerStats(BaseModel):
    rank: Optional[int] = None
    rating: int
    games_played: int
    wins: int
    losses: int
    draws: int
    on_page: bool = False


class LadderPageResponse(BaseModel):
    pool: str
    label: str
    total: int
    offset: int
    limit: int
    entries: list[LadderEntry]
    viewer: Optional[LadderViewerStats] = None
