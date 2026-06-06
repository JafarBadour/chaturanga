"""Ladder / leaderboard routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.optional_user import get_optional_user
from app.db.database import get_db
from app.db.models import User, UserRating
from app.models.user import LadderEntry, LadderPageResponse, LadderPoolInfo, LadderViewerStats
from app.utils.rating_pools import (
    count_ranked_players,
    get_user_pool_stats,
    get_user_rank,
    is_valid_pool,
    list_ladder_pools,
    page_offset_for_rank,
    pool_label,
)

router = APIRouter(prefix="/api/v1/ladder", tags=["ladder"])

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


def _build_entries(
    db: Session, pool: str, offset: int, limit: int, require_games: bool
) -> list[LadderEntry]:
    query = (
        db.query(UserRating, User)
        .join(User, User.id == UserRating.user_id)
        .filter(UserRating.pool == pool)
        .order_by(UserRating.rating.desc(), User.username.asc())
    )
    if require_games:
        query = query.filter(UserRating.games_played > 0)

    rows = query.offset(offset).limit(limit).all()
    return [
        LadderEntry(
            rank=offset + index + 1,
            id=user.id,
            username=user.username,
            pool=pool,
            rating=rating.rating,
            games_played=rating.games_played,
            wins=rating.wins,
            losses=rating.losses,
            draws=rating.draws,
        )
        for index, (rating, user) in enumerate(rows)
    ]


def _viewer_stats(db: Session, user: Optional[User], pool: str) -> Optional[LadderViewerStats]:
    if user is None:
        return None
    stats = get_user_pool_stats(db, user.id, pool)
    rank = get_user_rank(db, user.id, pool)
    return LadderViewerStats(rank=rank, **stats)


@router.get("/pools", response_model=list[LadderPoolInfo])
def get_ladder_pools():
    return [LadderPoolInfo(**pool) for pool in list_ladder_pools()]


@router.get("/page", response_model=LadderPageResponse)
def get_ladder_page(
    pool: str = Query("blitz"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    anchor: Optional[str] = Query(None, pattern="^(viewer)$"),
    db: Session = Depends(get_db),
    viewer_user: Optional[User] = Depends(get_optional_user),
):
    if not is_valid_pool(pool):
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown rating pool: {pool}")

    viewer = _viewer_stats(db, viewer_user, pool)
    resolved_offset = offset
    if anchor == "viewer" and viewer and viewer.rank:
        resolved_offset = page_offset_for_rank(viewer.rank, limit)

    total = count_ranked_players(db, pool, require_games=True)
    entries = _build_entries(db, pool, resolved_offset, limit, require_games=True)

    if viewer is not None:
        on_page = bool(
            viewer_user
            and viewer.rank
            and any(entry.id == viewer_user.id for entry in entries)
        )
        viewer = viewer.model_copy(update={"on_page": on_page})

    return LadderPageResponse(
        pool=pool,
        label=pool_label(pool),
        total=total,
        offset=resolved_offset,
        limit=limit,
        entries=entries,
        viewer=viewer,
    )
