"""Redis-backed matchmaking with rating windows that widen over wait time."""

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import Game, User
from app.db.redis_client import get_redis
from app.services.realtime_events import publish_casual_match
from app.utils.rating_pools import get_rating_pool, get_user_rating
from app.utils.time_control import parse_time_control_config

logger = logging.getLogger(__name__)

# Rating window: 100 pts immediately, +10/sec, cap 400 (Lichess-style widening)
MIN_RATING_DIFF = 100
MAX_RATING_DIFF = 400
RATING_EXPAND_PER_SECOND = 10
SEEK_STALE_MS = 30 * 60 * 1000
QUEUE_KEY = "seek:queue:{time_control}"
USER_KEY = "seek:user:{user_id}"
TC_KEY = "seek:tc:{user_id}"
LOCK_KEY = "seek:lock:{time_control}"


@dataclass
class QueueEntry:
    user_id: str
    username: str
    rating: int
    time_control: str
    joined_at_ms: int


class MatchmakingService:
    async def join_queue(self, db: Session, user: User, time_control: str) -> Optional[str]:
        parse_time_control_config(time_control)
        from app.services.competition_manager_service import competition_manager_service

        if await competition_manager_service.is_seeking(user.id):
            raise ValueError("Leave the competition pool before seeking a casual game")

        redis = await get_redis()
        await self.leave_queue(user.id)

        rating = get_user_rating(db, user, get_rating_pool(time_control))
        now_ms = int(time.time() * 1000)

        pipe = redis.pipeline()
        pipe.hset(
            USER_KEY.format(user_id=user.id),
            mapping={
                "user_id": user.id,
                "username": user.username,
                "rating": str(rating),
                "time_control": time_control,
                "joined_at": str(now_ms),
            },
        )
        pipe.set(TC_KEY.format(user_id=user.id), time_control)
        pipe.zadd(QUEUE_KEY.format(time_control=time_control), {user.id: rating})
        await pipe.execute()

        async with redis.lock(LOCK_KEY.format(time_control=time_control), timeout=5):
            opponent = await self._find_opponent(redis, time_control, user.id, rating, now_ms)
            if not opponent:
                return None

            await self._remove_pair(redis, user.id, opponent.user_id, time_control)
            self_entry = QueueEntry(
                user_id=user.id,
                username=user.username,
                rating=rating,
                time_control=time_control,
                joined_at_ms=now_ms,
            )
            game = self._create_game(db, opponent, self_entry, time_control)
            await publish_casual_match([user.id, opponent.user_id], game.id)
            logger.info(
                "Matched game %s: %s vs %s (%s)",
                game.id,
                user.username,
                opponent.username,
                time_control,
            )
            return game.id

    async def leave_queue(self, user_id: str) -> bool:
        redis = await get_redis()
        time_control = await redis.get(TC_KEY.format(user_id=user_id))
        if not time_control:
            return False

        pipe = redis.pipeline()
        pipe.zrem(QUEUE_KEY.format(time_control=time_control), user_id)
        pipe.delete(USER_KEY.format(user_id=user_id))
        pipe.delete(TC_KEY.format(user_id=user_id))
        await pipe.execute()
        return True

    async def is_in_queue(self, user_id: str) -> bool:
        redis = await get_redis()
        return bool(await redis.exists(TC_KEY.format(user_id=user_id)))

    def register_match_callback(self, user_id: str, callback) -> None:
        pass

    def unregister_match_callback(self, user_id: str) -> None:
        pass

    async def _find_opponent(
        self,
        redis,
        time_control: str,
        user_id: str,
        rating: int,
        now_ms: int,
    ) -> Optional[QueueEntry]:
        queue_key = QUEUE_KEY.format(time_control=time_control)
        candidates = await redis.zrangebyscore(
            queue_key, rating - MAX_RATING_DIFF, rating + MAX_RATING_DIFF
        )

        self_joined = await redis.hget(USER_KEY.format(user_id=user_id), "joined_at")
        joined_at_ms = int(self_joined or now_ms)

        best: Optional[QueueEntry] = None
        best_diff = float("inf")

        for candidate_id in candidates:
            if candidate_id == user_id:
                continue

            entry = await self._load_entry(redis, candidate_id, time_control)
            if not entry:
                await redis.zrem(queue_key, candidate_id)
                continue

            if now_ms - entry.joined_at_ms > SEEK_STALE_MS:
                await self._remove_from_queue(redis, candidate_id, time_control)
                continue

            max_wait_sec = max(now_ms - joined_at_ms, now_ms - entry.joined_at_ms) / 1000
            allowed_diff = min(
                MAX_RATING_DIFF,
                max(MIN_RATING_DIFF, int(max_wait_sec * RATING_EXPAND_PER_SECOND)),
            )
            diff = abs(entry.rating - rating)
            if diff <= allowed_diff and diff < best_diff:
                best_diff = diff
                best = entry

        return best

    async def _load_entry(
        self, redis, user_id: str, time_control: str
    ) -> Optional[QueueEntry]:
        data = await redis.hgetall(USER_KEY.format(user_id=user_id))
        if not data or data.get("time_control") != time_control:
            return None
        return QueueEntry(
            user_id=data["user_id"],
            username=data["username"],
            rating=int(data["rating"]),
            time_control=data["time_control"],
            joined_at_ms=int(data["joined_at"]),
        )

    async def _remove_pair(
        self, redis, user_a: str, user_b: str, time_control: str
    ) -> None:
        queue_key = QUEUE_KEY.format(time_control=time_control)
        pipe = redis.pipeline()
        pipe.zrem(queue_key, user_a, user_b)
        pipe.delete(USER_KEY.format(user_id=user_a))
        pipe.delete(USER_KEY.format(user_id=user_b))
        pipe.delete(TC_KEY.format(user_id=user_a))
        pipe.delete(TC_KEY.format(user_id=user_b))
        await pipe.execute()

    async def _remove_from_queue(self, redis, user_id: str, time_control: str) -> None:
        pipe = redis.pipeline()
        pipe.zrem(QUEUE_KEY.format(time_control=time_control), user_id)
        pipe.delete(USER_KEY.format(user_id=user_id))
        pipe.delete(TC_KEY.format(user_id=user_id))
        await pipe.execute()

    def _create_game(
        self,
        db: Session,
        player_a: QueueEntry,
        player_b: QueueEntry,
        time_control: str,
    ) -> Game:
        config = parse_time_control_config(time_control)
        pool = get_rating_pool(time_control, config.mode)
        white, black = (
            (player_a, player_b) if player_a.rating >= player_b.rating else (player_b, player_a)
        )

        game_kwargs = dict(
            white_user_id=white.user_id,
            black_user_id=black.user_id,
            time_control=time_control,
            game_mode=config.mode,
            rating_pool=pool,
            white_rating_before=white.rating,
            black_rating_before=black.rating,
            status="active",
        )

        if config.mode == "royale":
            game_kwargs.update(
                move_limit_ms=config.move_limit_ms,
                initial_time_ms=0,
                increment_ms=0,
                white_time_ms=0,
                black_time_ms=0,
                last_move_at=None,
            )
        else:
            game_kwargs.update(
                last_move_at=datetime.utcnow(),
                initial_time_ms=config.initial_time_ms,
                increment_ms=config.increment_ms,
                white_time_ms=config.initial_time_ms,
                black_time_ms=config.initial_time_ms,
            )

        game = Game(**game_kwargs)
        db.add(game)
        db.commit()
        db.refresh(game)
        return game


matchmaking_service = MatchmakingService()
