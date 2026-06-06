"""Rating pool classification and per-pool user stats."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import User, UserRating
from app.utils.time_control import parse_time_control_config

STANDARD_POOLS: tuple[str, ...] = ("blitz", "rapid", "classical")
ROYALE_TIER_POOLS: tuple[str, ...] = ("royale_bullet", "royale_blitz", "royale_rapid")
ROYALE_SECONDS: tuple[str, ...] = ("1.5", "3", "5", "7", "11", "15", "20", "30", "45")
ALL_LADDER_POOLS: tuple[str, ...] = STANDARD_POOLS + ROYALE_TIER_POOLS

_POOL_LABELS: dict[str, str] = {
    "blitz": "Standard · Blitz",
    "rapid": "Standard · Rapid",
    "classical": "Standard · Classical",
    "royale_bullet": "Royale · Bullet",
    "royale_blitz": "Royale · Blitz",
    "royale_rapid": "Royale · Rapid",
}

_TIER_HINTS: dict[str, str] = {
    "blitz": "Bullet & blitz (< 10 min)",
    "rapid": "10–30 min",
    "classical": "30+ min",
    "royale_bullet": "1.5, 3 & 5 sec/move",
    "royale_blitz": "7, 11 & 15 sec/move",
    "royale_rapid": "20, 30 & 45 sec/move",
}


def pool_label(pool: str) -> str:
    return _POOL_LABELS.get(pool, pool)


def pool_hint(pool: str) -> str:
    return _TIER_HINTS.get(pool, "")


def royale_tier_pool_for_time_control(time_control: str) -> str:
    seconds = float(time_control.strip().replace("royale/", ""))
    if seconds <= 5:
        return "royale_bullet"
    if seconds <= 15:
        return "royale_blitz"
    return "royale_rapid"


def list_ladder_pools() -> list[dict[str, str]]:
    pools: list[dict[str, str]] = []
    for pool in STANDARD_POOLS:
        pools.append(
            {
                "id": pool,
                "label": pool_label(pool),
                "group": "standard",
                "hint": pool_hint(pool),
            }
        )
    for pool in ROYALE_TIER_POOLS:
        pools.append(
            {
                "id": pool,
                "label": pool_label(pool),
                "group": "royale",
                "hint": pool_hint(pool),
            }
        )
    return pools


def is_royale_pool(pool: str) -> bool:
    return pool in ROYALE_TIER_POOLS


def is_standard_pool(pool: str) -> bool:
    return pool in STANDARD_POOLS


def pool_family(pool: str) -> str:
    return "royale" if is_royale_pool(pool) else "standard"


def is_valid_pool(pool: str) -> bool:
    return pool in ALL_LADDER_POOLS


def get_rating_pool(time_control: str, game_mode: str | None = None) -> str:
    tc = time_control.strip()
    mode = (game_mode or "").strip().lower()
    if mode == "royale" or tc.startswith("royale/"):
        return royale_tier_pool_for_time_control(tc)

    config = parse_time_control_config(tc)
    minutes = config.initial_time_ms / 60_000
    if minutes < 10:
        return "blitz"
    if minutes < 30:
        return "rapid"
    return "classical"


def get_or_create_user_rating(db: Session, user_id: str, pool: str) -> UserRating:
    record = (
        db.query(UserRating)
        .filter(UserRating.user_id == user_id, UserRating.pool == pool)
        .first()
    )
    if record is None:
        record = UserRating(user_id=user_id, pool=pool)
        db.add(record)
        db.flush()
    return record


def get_user_rating(db: Session, user: User, pool: str) -> int:
    record = (
        db.query(UserRating)
        .filter(UserRating.user_id == user.id, UserRating.pool == pool)
        .first()
    )
    return record.rating if record else 1500


def set_user_rating(db: Session, user: User, pool: str, rating: int) -> None:
    record = get_or_create_user_rating(db, user.id, pool)
    record.rating = rating
    if pool == "blitz":
        user.rating = rating


def get_user_pool_stats(db: Session, user_id: str, pool: str) -> dict[str, int]:
    record = (
        db.query(UserRating)
        .filter(UserRating.user_id == user_id, UserRating.pool == pool)
        .first()
    )
    if record is None:
        return {
            "rating": 1500,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
        }
    return {
        "rating": record.rating,
        "games_played": record.games_played,
        "wins": record.wins,
        "losses": record.losses,
        "draws": record.draws,
    }


def get_all_user_ratings(db: Session, user_id: str) -> dict[str, dict[str, int]]:
    records = db.query(UserRating).filter(UserRating.user_id == user_id).all()
    by_pool = {record.pool: record for record in records}
    result: dict[str, dict[str, int]] = {}
    for pool in ALL_LADDER_POOLS:
        record = by_pool.get(pool)
        if record is None:
            result[pool] = {
                "rating": 1500,
                "games_played": 0,
                "wins": 0,
                "losses": 0,
                "draws": 0,
            }
        else:
            result[pool] = {
                "rating": record.rating,
                "games_played": record.games_played,
                "wins": record.wins,
                "losses": record.losses,
                "draws": record.draws,
            }
    return result


def record_pool_result(
    db: Session, user: User, pool: str, result: str, is_white: bool
) -> None:
    record = get_or_create_user_rating(db, user.id, pool)
    record.games_played += 1

    if result == "draw":
        record.draws += 1
    elif (result == "white" and is_white) or (result == "black" and not is_white):
        record.wins += 1
    else:
        record.losses += 1

    if pool == "blitz":
        user.games_played += 1
        if result == "draw":
            user.draws += 1
        elif (result == "white" and is_white) or (result == "black" and not is_white):
            user.wins += 1
        else:
            user.losses += 1


def count_ranked_players(db: Session, pool: str, require_games: bool = True) -> int:
    query = db.query(func.count(UserRating.user_id)).filter(UserRating.pool == pool)
    if require_games:
        query = query.filter(UserRating.games_played > 0)
    return query.scalar() or 0


def get_user_rank(db: Session, user_id: str, pool: str) -> Optional[int]:
    stats = get_user_pool_stats(db, user_id, pool)
    if stats["games_played"] <= 0:
        return None

    user_rating = (
        db.query(UserRating)
        .filter(UserRating.user_id == user_id, UserRating.pool == pool)
        .one()
    )
    higher = (
        db.query(func.count(UserRating.user_id))
        .filter(
            UserRating.pool == pool,
            UserRating.games_played > 0,
            UserRating.rating > user_rating.rating,
        )
        .scalar()
        or 0
    )
    return higher + 1


def page_offset_for_rank(rank: int, limit: int) -> int:
    if rank <= 0:
        return 0
    return ((rank - 1) // limit) * limit
