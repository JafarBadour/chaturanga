"""Redis-backed competition pairing manager."""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Competition, CompetitionParticipant, Game, User
from app.db.redis_client import get_redis
from app.models.competition import CompetitionPendingMatch
from app.services.realtime_events import publish_comp_broadcast, publish_comp_match, publish_user
from app.utils.rating_pools import get_user_rating
from app.utils.time_control import parse_time_control_config

logger = logging.getLogger(__name__)

ACTIVE_SET = "comp:active"
COMP_META = "comp:{comp_id}:meta"
COMP_QUEUE = "comp:{comp_id}:queue"
COMP_USER = "comp:{comp_id}:user:{user_id}"
COMP_USER_ACTIVE = "comp:user:{user_id}"
COMP_LOCK = "comp:lock:{comp_id}"
COMP_OFFERS = "comp:{comp_id}:offers"
COMP_OFFER = "comp:{comp_id}:offer:{offer_id}"
COMP_USER_OFFER = "comp:{comp_id}:user_offer:{user_id}"
COMP_WAITING = "comp:{comp_id}:waiting"
COMP_USER_WAITING = "comp:waiting_user:{user_id}"
COMP_LAST_OPPONENT = "comp:{comp_id}:last_opponent:{user_id}"

MIN_RATING_DIFF = 100
MAX_RATING_DIFF = 400
RATING_EXPAND_PER_SECOND = 10
SEEK_STALE_MS = 30 * 60 * 1000
MATCH_JOIN_WINDOW_MS = 3 * 60 * 1000

WIN_POINTS = 2
DRAW_POINTS = 1


@dataclass
class CompQueueEntry:
    user_id: str
    username: str
    rating: int
    joined_at_ms: int


@dataclass
class ParticipantSnapshot:
    user_id: str
    username: str
    rating: int
    score: int


class CompetitionManagerService:
    async def sync_running_competitions(self, db: Session) -> None:
        from app.services.competition_service import competition_service
        from app.services.notification_service import notification_service

        newly_running = competition_service.sync_statuses(db)
        redis = await get_redis()

        running = db.query(Competition).filter(Competition.status == "running").all()
        running_ids = {comp.id for comp in running}

        cached = await redis.smembers(ACTIVE_SET)
        for stale_id in cached - running_ids:
            await redis.srem(ACTIVE_SET, stale_id)

        for comp in running:
            await redis.sadd(ACTIVE_SET, comp.id)
            await redis.hset(
                COMP_META.format(comp_id=comp.id),
                mapping={
                    "competition_id": comp.id,
                    "format": comp.format,
                    "time_control": comp.time_control,
                    "rating_pool": comp.rating_pool,
                    "game_mode": comp.game_mode,
                    "name": comp.name,
                },
            )

        for comp in newly_running:
            await notification_service.notify_competition_started(db, comp)

    async def is_seeking(self, user_id: str) -> bool:
        redis = await get_redis()
        return bool(await redis.exists(COMP_USER_ACTIVE.format(user_id=user_id)))

    async def active_competition_id(self, user_id: str) -> Optional[str]:
        redis = await get_redis()
        return await redis.get(COMP_USER_ACTIVE.format(user_id=user_id))

    async def join_pool(self, db: Session, user: User, competition_id: str) -> None:
        """Enter FIFM matchmaking queue (prefer enter_availability)."""
        await self.enter_availability(db, user, competition_id)

    async def enter_availability(self, db: Session, user: User, competition_id: str) -> None:
        from app.services.competition_service import competition_service

        comp = competition_service._get_competition(db, competition_id)
        if comp.status != "running":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Competition is not running")

        participant = (
            db.query(CompetitionParticipant)
            .filter(
                CompetitionParticipant.competition_id == competition_id,
                CompetitionParticipant.user_id == user.id,
            )
            .first()
        )
        if participant is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Join the competition first")

        if self._user_in_active_game(db, competition_id, user.id):
            return

        if comp.format == "fifm":
            await self._join_fifm_pool(db, user, comp)
        elif comp.format in ("swiss", "candidates"):
            await self._join_waiting_pool(user.id, competition_id, comp.name)
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported competition format")

    async def _join_fifm_pool(self, db: Session, user: User, comp: Competition) -> None:
        from app.services.matchmaking_service import matchmaking_service

        await matchmaking_service.leave_queue(user.id)
        await self.leave_pool(user.id)

        rating = get_user_rating(db, user, comp.rating_pool)
        now_ms = int(time.time() * 1000)
        redis = await get_redis()

        pipe = redis.pipeline()
        pipe.hset(
            COMP_USER.format(comp_id=comp.id, user_id=user.id),
            mapping={
                "user_id": user.id,
                "username": user.username,
                "rating": str(rating),
                "joined_at": str(now_ms),
            },
        )
        pipe.zadd(COMP_QUEUE.format(comp_id=comp.id), {user.id: rating})
        pipe.set(COMP_USER_ACTIVE.format(user_id=user.id), comp.id)
        await pipe.execute()

        await publish_user(
            user.id,
            {
                "type": "comp_seeking",
                "competition_id": comp.id,
                "competition_name": comp.name,
            },
        )

    async def _join_waiting_pool(
        self, user_id: str, comp_id: str, comp_name: str
    ) -> None:
        redis = await get_redis()
        if await redis.get(COMP_USER_OFFER.format(comp_id=comp_id, user_id=user_id)):
            return

        pipe = redis.pipeline()
        pipe.sadd(COMP_WAITING.format(comp_id=comp_id), user_id)
        pipe.set(COMP_USER_WAITING.format(user_id=user_id), comp_id)
        await pipe.execute()

        await publish_user(
            user_id,
            {
                "type": "comp_seeking",
                "competition_id": comp_id,
                "competition_name": comp_name,
            },
        )

    async def leave_pool(self, user_id: str) -> bool:
        """Leave FIFM queue only."""
        return await self._leave_fifm_pool(user_id)

    async def leave_availability(
        self, user_id: str, competition_id: str | None = None
    ) -> bool:
        left = await self._leave_fifm_pool(user_id)
        left_waiting = await self._leave_waiting_pool(user_id, competition_id)
        return left or left_waiting

    async def _leave_fifm_pool(self, user_id: str) -> bool:
        redis = await get_redis()
        comp_id = await redis.get(COMP_USER_ACTIVE.format(user_id=user_id))
        if not comp_id:
            return False

        pipe = redis.pipeline()
        pipe.zrem(COMP_QUEUE.format(comp_id=comp_id), user_id)
        pipe.delete(COMP_USER.format(comp_id=comp_id, user_id=user_id))
        pipe.delete(COMP_USER_ACTIVE.format(user_id=user_id))
        await pipe.execute()

        await publish_user(user_id, {"type": "comp_seek_cancelled"})
        return True

    async def _leave_waiting_pool(
        self, user_id: str, competition_id: str | None = None
    ) -> bool:
        redis = await get_redis()
        comp_id = competition_id or await redis.get(COMP_USER_WAITING.format(user_id=user_id))
        if not comp_id:
            return False

        pipe = redis.pipeline()
        pipe.srem(COMP_WAITING.format(comp_id=comp_id), user_id)
        pipe.delete(COMP_USER_WAITING.format(user_id=user_id))
        await pipe.execute()

        await publish_user(user_id, {"type": "comp_seek_cancelled"})
        return True

    def _user_in_active_game(self, db: Session, comp_id: str, user_id: str) -> bool:
        return (
            db.query(Game.id)
            .filter(
                Game.competition_id == comp_id,
                Game.status == "active",
                ((Game.white_user_id == user_id) | (Game.black_user_id == user_id)),
            )
            .first()
            is not None
        )

    async def run_pairing_tick(self, db: Session) -> int:
        redis = await get_redis()
        comp_ids = await redis.smembers(ACTIVE_SET)
        paired = 0

        for comp_id in comp_ids:
            meta = await redis.hgetall(COMP_META.format(comp_id=comp_id))
            if not meta:
                continue

            fmt = meta.get("format", "fifm")
            lock_key = COMP_LOCK.format(comp_id=comp_id)
            try:
                async with redis.lock(lock_key, timeout=3, blocking_timeout=0.1):
                    if fmt in ("swiss", "candidates"):
                        paired += await self._expire_stale_offers(db, redis, comp_id)
                    if fmt == "fifm":
                        paired += await self._pair_fifm(db, redis, comp_id, meta)
                    elif fmt == "swiss":
                        paired += await self._schedule_swiss(db, redis, comp_id, meta)
                    elif fmt == "candidates":
                        paired += await self._schedule_candidates(db, redis, comp_id, meta)
            except Exception:
                logger.debug("Could not acquire comp lock %s", comp_id, exc_info=True)

        return paired

    async def _pair_fifm(self, db: Session, redis, comp_id: str, meta: dict) -> int:
        queue_key = COMP_QUEUE.format(comp_id=comp_id)
        members = await redis.zrange(queue_key, 0, -1)
        if len(members) < 2:
            return 0

        now_ms = int(time.time() * 1000)
        matched_ids: set[str] = set()
        paired = 0

        for user_id in members:
            if user_id in matched_ids:
                continue

            entry = await self._load_entry(redis, comp_id, user_id)
            if not entry:
                await redis.zrem(queue_key, user_id)
                continue

            if now_ms - entry.joined_at_ms > SEEK_STALE_MS:
                await self._remove_from_queue(redis, comp_id, user_id)
                continue

            last_opponent_id = await self._get_last_opponent(db, redis, comp_id, user_id)
            opponent = await self._find_opponent(
                redis,
                comp_id,
                user_id,
                entry.rating,
                entry.joined_at_ms,
                now_ms,
                matched_ids,
                blocked_opponent_id=last_opponent_id,
            )
            if not opponent:
                continue

            await self._remove_pair(redis, comp_id, user_id, opponent.user_id)
            matched_ids.add(user_id)
            matched_ids.add(opponent.user_id)

            game = self._create_comp_game(db, comp_id, meta, entry, opponent)
            await self._set_last_opponents(redis, comp_id, user_id, opponent.user_id)
            await publish_comp_match(
                [user_id, opponent.user_id],
                game.id,
                comp_id,
            )
            await publish_comp_broadcast(
                comp_id,
                {
                    "type": "comp_pairing",
                    "competition_id": comp_id,
                    "game_id": game.id,
                    "white_user_id": game.white_user_id,
                    "black_user_id": game.black_user_id,
                    "format": "fifm",
                },
            )
            from app.services.notification_service import notification_service
            from app.services.realtime_events import publish_comp_refresh

            comp_name = meta.get("name", "Competition")
            for uid in (user_id, opponent.user_id):
                await notification_service.notify_comp_match_found(
                    db,
                    uid,
                    competition_id=comp_id,
                    competition_name=comp_name,
                    game_id=game.id,
                )
            await publish_comp_refresh(comp_id, "pairing", [user_id, opponent.user_id])
            logger.info(
                "Comp FIFM match %s in %s: %s vs %s",
                game.id,
                comp_id,
                entry.username,
                opponent.username,
            )
            paired += 1

        return paired

    def _busy_user_ids(self, db: Session, comp_id: str) -> set[str]:
        rows = (
            db.query(Game.white_user_id, Game.black_user_id)
            .filter(Game.competition_id == comp_id, Game.status == "active")
            .all()
        )
        busy: set[str] = set()
        for white_id, black_id in rows:
            busy.add(white_id)
            busy.add(black_id)
        return busy

    def _load_participants(self, db: Session, comp_id: str) -> list[ParticipantSnapshot]:
        rows = (
            db.query(CompetitionParticipant, User)
            .join(User, User.id == CompetitionParticipant.user_id)
            .filter(CompetitionParticipant.competition_id == comp_id)
            .all()
        )
        comp = db.query(Competition).filter(Competition.id == comp_id).one()
        snapshots: list[ParticipantSnapshot] = []
        for participant, user in rows:
            snapshots.append(
                ParticipantSnapshot(
                    user_id=user.id,
                    username=user.username,
                    rating=get_user_rating(db, user, comp.rating_pool),
                    score=participant.score,
                )
            )
        return snapshots

    async def _users_with_pending_offers(self, redis, comp_id: str) -> set[str]:
        offer_ids = await redis.smembers(COMP_OFFERS.format(comp_id=comp_id))
        pending: set[str] = set()
        for offer_id in offer_ids:
            data = await redis.hgetall(COMP_OFFER.format(comp_id=comp_id, offer_id=offer_id))
            if data:
                pending.add(data["user_a"])
                pending.add(data["user_b"])
        return pending

    def _offer_key(self, comp_id: str, offer_id: str) -> str:
        return COMP_OFFER.format(comp_id=comp_id, offer_id=offer_id)

    def _offer_joined_key(self, comp_id: str, offer_id: str) -> str:
        return f"{self._offer_key(comp_id, offer_id)}:joined"

    def _offer_white_user_id(self, data: dict[str, str]) -> str:
        stored = data.get("white_user_id")
        if stored:
            return stored
        rating_a = int(data["rating_a"])
        rating_b = int(data["rating_b"])
        if rating_a >= rating_b:
            return data["user_a"]
        return data["user_b"]

    def _swapped_white_user_id(self, data: dict[str, str]) -> str:
        current_white = self._offer_white_user_id(data)
        return data["user_b"] if current_white == data["user_a"] else data["user_a"]

    async def _remove_from_waiting(self, comp_id: str, *user_ids: str) -> None:
        if not user_ids:
            return
        redis = await get_redis()
        pipe = redis.pipeline()
        for user_id in user_ids:
            pipe.srem(COMP_WAITING.format(comp_id=comp_id), user_id)
            pipe.delete(COMP_USER_WAITING.format(user_id=user_id))
        await pipe.execute()

    async def _create_match_offer(
        self,
        db: Session,
        redis,
        comp_id: str,
        meta: dict,
        player_a: ParticipantSnapshot,
        player_b: ParticipantSnapshot,
        *,
        white_user_id: str | None = None,
    ) -> str:
        offer_id = str(uuid.uuid4())
        now_ms = int(time.time() * 1000)
        expires_at_ms = now_ms + MATCH_JOIN_WINDOW_MS
        offer_key = self._offer_key(comp_id, offer_id)

        if white_user_id is None:
            white_user_id = (
                player_a.user_id
                if player_a.rating >= player_b.rating
                else player_b.user_id
            )

        pipe = redis.pipeline()
        pipe.hset(
            offer_key,
            mapping={
                "offer_id": offer_id,
                "user_a": player_a.user_id,
                "user_b": player_b.user_id,
                "username_a": player_a.username,
                "username_b": player_b.username,
                "rating_a": str(player_a.rating),
                "rating_b": str(player_b.rating),
                "white_user_id": white_user_id,
                "created_at_ms": str(now_ms),
                "expires_at_ms": str(expires_at_ms),
            },
        )
        pipe.set(COMP_USER_OFFER.format(comp_id=comp_id, user_id=player_a.user_id), offer_id)
        pipe.set(COMP_USER_OFFER.format(comp_id=comp_id, user_id=player_b.user_id), offer_id)
        pipe.sadd(COMP_OFFERS.format(comp_id=comp_id), offer_id)
        await pipe.execute()

        await self._remove_from_waiting(comp_id, player_a.user_id, player_b.user_id)

        fmt = meta.get("format", "swiss")
        comp_name = meta.get("name", "Competition")
        for user_id, opponent in (
            (player_a.user_id, player_b),
            (player_b.user_id, player_a),
        ):
            await publish_user(
                user_id,
                {
                    "type": "comp_match_offer",
                    "competition_id": comp_id,
                    "offer_id": offer_id,
                    "opponent_user_id": opponent.user_id,
                    "opponent_username": opponent.username,
                    "expires_at_ms": expires_at_ms,
                    "format": fmt,
                },
            )
            from app.services.notification_service import notification_service

            await notification_service.notify_match_offer(
                db,
                user_id,
                competition_id=comp_id,
                competition_name=comp_name,
                opponent_username=opponent.username,
                comp_format=fmt,
            )

        await publish_comp_broadcast(
            comp_id,
            {
                "type": "comp_match_scheduled",
                "competition_id": comp_id,
                "offer_id": offer_id,
                "user_a": player_a.user_id,
                "user_b": player_b.user_id,
                "format": fmt,
            },
        )
        logger.info(
            "Comp %s offer %s in %s: %s vs %s",
            fmt,
            offer_id,
            comp_id,
            player_a.username,
            player_b.username,
        )
        return offer_id

    async def _publish_offer_update(
        self, comp_id: str, offer_id: str, data: dict[str, str]
    ) -> None:
        joined_key = self._offer_joined_key(comp_id, offer_id)
        redis = await get_redis()
        joined = await redis.smembers(joined_key)
        expires_at_ms = int(data["expires_at_ms"])

        for user_id in (data["user_a"], data["user_b"]):
            opponent_id = data["user_b"] if user_id == data["user_a"] else data["user_a"]
            opponent_username = (
                data["username_b"] if user_id == data["user_a"] else data["username_a"]
            )
            await publish_user(
                user_id,
                {
                    "type": "comp_match_offer_update",
                    "competition_id": comp_id,
                    "offer_id": offer_id,
                    "opponent_user_id": opponent_id,
                    "opponent_username": opponent_username,
                    "expires_at_ms": expires_at_ms,
                    "you_joined": user_id in joined,
                    "opponent_joined": opponent_id in joined,
                },
            )

    async def _clear_offer(self, redis, comp_id: str, offer_id: str, data: dict[str, str]) -> None:
        offer_key = self._offer_key(comp_id, offer_id)
        pipe = redis.pipeline()
        pipe.delete(offer_key)
        pipe.delete(self._offer_joined_key(comp_id, offer_id))
        pipe.delete(COMP_USER_OFFER.format(comp_id=comp_id, user_id=data["user_a"]))
        pipe.delete(COMP_USER_OFFER.format(comp_id=comp_id, user_id=data["user_b"]))
        pipe.srem(COMP_OFFERS.format(comp_id=comp_id), offer_id)
        await pipe.execute()

    async def _finalize_offer(
        self,
        db: Session,
        redis,
        comp_id: str,
        meta: dict,
        offer_id: str,
        data: dict[str, str],
    ) -> None:
        offer_key = self._offer_key(comp_id, offer_id)
        lock_key = f"comp:offer:lock:{offer_id}"
        try:
            async with redis.lock(lock_key, timeout=5, blocking_timeout=0.2):
                if not await redis.exists(offer_key):
                    return
                player_a = CompQueueEntry(
                    user_id=data["user_a"],
                    username=data["username_a"],
                    rating=int(data["rating_a"]),
                    joined_at_ms=0,
                )
                player_b = CompQueueEntry(
                    user_id=data["user_b"],
                    username=data["username_b"],
                    rating=int(data["rating_b"]),
                    joined_at_ms=0,
                )
                white_user_id = self._offer_white_user_id(data)
                game = self._create_comp_game(
                    db,
                    comp_id,
                    meta,
                    player_a,
                    player_b,
                    white_user_id=white_user_id,
                )
                await self._clear_offer(redis, comp_id, offer_id, data)
        except Exception:
            logger.debug("Could not finalize offer %s", offer_id, exc_info=True)
            return

        await publish_comp_match([data["user_a"], data["user_b"]], game.id, comp_id)
        await publish_comp_broadcast(
            comp_id,
            {
                "type": "comp_pairing",
                "competition_id": comp_id,
                "game_id": game.id,
                "white_user_id": game.white_user_id,
                "black_user_id": game.black_user_id,
                "format": meta.get("format", "swiss"),
            },
        )

    def _record_mutual_draw(self, db: Session, comp_id: str, user_a: str, user_b: str) -> None:
        for user_id in (user_a, user_b):
            participant = (
                db.query(CompetitionParticipant)
                .filter(
                    CompetitionParticipant.competition_id == comp_id,
                    CompetitionParticipant.user_id == user_id,
                )
                .first()
            )
            if participant is None:
                continue
            participant.games_played += 1
            participant.draws += 1
            participant.score += DRAW_POINTS
        db.commit()

        comp = db.query(Competition).filter(Competition.id == comp_id).first()
        if comp is None:
            return

        participant_ids = [
            row[0]
            for row in db.query(CompetitionParticipant.user_id)
            .filter(CompetitionParticipant.competition_id == comp.id)
            .all()
        ]
        from app.services.notification_service import notification_service

        notification_service.schedule_standings_updated(comp.id, comp.name, participant_ids)

    async def _rematch_swiss_offer(
        self,
        db: Session,
        redis,
        comp_id: str,
        meta: dict,
        data: dict[str, str],
    ) -> None:
        participants = self._load_participants(db, comp_id)
        by_id = {p.user_id: p for p in participants}
        player_a = by_id.get(data["user_a"])
        player_b = by_id.get(data["user_b"])
        if player_a is None or player_b is None:
            return

        await self._create_match_offer(
            db,
            redis,
            comp_id,
            meta,
            player_a,
            player_b,
            white_user_id=self._swapped_white_user_id(data),
        )

    async def _expire_stale_offers(self, db: Session, redis, comp_id: str) -> int:
        offer_ids = await redis.smembers(COMP_OFFERS.format(comp_id=comp_id))
        if not offer_ids:
            return 0

        now_ms = int(time.time() * 1000)
        expired = 0
        for offer_id in offer_ids:
            offer_key = self._offer_key(comp_id, offer_id)
            data = await redis.hgetall(offer_key)
            if not data:
                await redis.srem(COMP_OFFERS.format(comp_id=comp_id), offer_id)
                continue

            if now_ms < int(data["expires_at_ms"]):
                continue

            joined = await redis.smembers(self._offer_joined_key(comp_id, offer_id))
            if len(joined) >= 2:
                meta = await redis.hgetall(COMP_META.format(comp_id=comp_id))
                if meta:
                    await self._finalize_offer(db, redis, comp_id, meta, offer_id, data)
                continue

            meta = await redis.hgetall(COMP_META.format(comp_id=comp_id))
            fmt = meta.get("format", "swiss") if meta else "swiss"
            forfeit_draw = False
            rematch = False

            if len(joined) == 0 and fmt == "candidates":
                self._record_mutual_draw(db, comp_id, data["user_a"], data["user_b"])
                forfeit_draw = True
                from app.services.realtime_events import publish_comp_refresh

                await publish_comp_refresh(
                    comp_id,
                    "pairing_forfeit_draw",
                    [data["user_a"], data["user_b"]],
                )
            elif len(joined) < 2 and fmt == "swiss" and meta:
                rematch = True

            await self._clear_offer(redis, comp_id, offer_id, data)

            if rematch and meta:
                await self._rematch_swiss_offer(db, redis, comp_id, meta, data)

            for user_id in (data["user_a"], data["user_b"]):
                await publish_user(
                    user_id,
                    {
                        "type": "comp_match_offer_expired",
                        "competition_id": comp_id,
                        "offer_id": offer_id,
                        "forfeit_draw": forfeit_draw,
                        "rematch": rematch,
                    },
                )
            expired += 1
        return expired

    async def _schedule_swiss(self, db: Session, redis, comp_id: str, meta: dict) -> int:
        busy = self._busy_user_ids(db, comp_id)
        pending_users = await self._users_with_pending_offers(redis, comp_id)
        waiting_users = await redis.smembers(COMP_WAITING.format(comp_id=comp_id))
        participants = self._load_participants(db, comp_id)
        free = [
            p
            for p in participants
            if p.user_id in waiting_users
            and p.user_id not in busy
            and p.user_id not in pending_users
        ]
        if len(free) < 2:
            return 0

        free.sort(key=lambda p: (-p.score, p.user_id))
        created = 0
        used: set[str] = set()

        for i, player_a in enumerate(free):
            if player_a.user_id in used:
                continue
            for player_b in free[i + 1 :]:
                if player_b.user_id in used:
                    continue
                if player_a.score != player_b.score:
                    break
                if abs(player_a.rating - player_b.rating) > MAX_RATING_DIFF:
                    continue
                await self._create_match_offer(db, redis, comp_id, meta, player_a, player_b)
                used.add(player_a.user_id)
                used.add(player_b.user_id)
                created += 1
                break

        return created

    async def _schedule_candidates(self, db: Session, redis, comp_id: str, meta: dict) -> int:
        busy = self._busy_user_ids(db, comp_id)
        pending_users = await self._users_with_pending_offers(redis, comp_id)
        waiting_users = await redis.smembers(COMP_WAITING.format(comp_id=comp_id))
        participants = self._load_participants(db, comp_id)
        free = [
            p
            for p in participants
            if p.user_id in waiting_users
            and p.user_id not in busy
            and p.user_id not in pending_users
        ]
        if len(free) < 2:
            return 0

        free.sort(key=lambda p: (-p.rating, p.user_id))
        created = 0
        for i in range(0, len(free) - 1, 2):
            await self._create_match_offer(db, redis, comp_id, meta, free[i], free[i + 1])
            created += 1
        return created

    async def join_scheduled_match(
        self, db: Session, user: User, competition_id: str, offer_id: str
    ) -> None:
        redis = await get_redis()
        offer_key = self._offer_key(competition_id, offer_id)
        data = await redis.hgetall(offer_key)
        if not data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Match offer not found or expired")

        if user.id not in (data["user_a"], data["user_b"]):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your match")

        now_ms = int(time.time() * 1000)
        if now_ms >= int(data["expires_at_ms"]):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Join window expired")

        busy = self._busy_user_ids(db, competition_id)
        if user.id in busy:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Finish your current game first")

        joined_key = self._offer_joined_key(competition_id, offer_id)
        await redis.sadd(joined_key, user.id)
        await self._publish_offer_update(competition_id, offer_id, data)

        joined = await redis.smembers(joined_key)
        if len(joined) >= 2:
            meta = await redis.hgetall(COMP_META.format(comp_id=competition_id))
            if not meta:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Competition unavailable")
            await self._finalize_offer(db, redis, competition_id, meta, offer_id, data)

    async def get_pending_offer(
        self, comp_id: str, user_id: str
    ) -> Optional[CompetitionPendingMatch]:
        redis = await get_redis()
        offer_id = await redis.get(COMP_USER_OFFER.format(comp_id=comp_id, user_id=user_id))
        if not offer_id:
            return None

        offer_key = self._offer_key(comp_id, offer_id)
        data = await redis.hgetall(offer_key)
        if not data:
            return None

        now_ms = int(time.time() * 1000)
        expires_at_ms = int(data["expires_at_ms"])
        if now_ms >= expires_at_ms:
            await self._clear_offer(redis, comp_id, offer_id, data)
            return None

        if user_id == data["user_a"]:
            opponent_id = data["user_b"]
            opponent_username = data["username_b"]
        else:
            opponent_id = data["user_a"]
            opponent_username = data["username_a"]

        joined = await redis.smembers(self._offer_joined_key(comp_id, offer_id))
        meta = await redis.hgetall(COMP_META.format(comp_id=comp_id))
        fmt = meta.get("format", "swiss") if meta else "swiss"
        return CompetitionPendingMatch(
            offer_id=offer_id,
            opponent_user_id=opponent_id,
            opponent_username=opponent_username,
            expires_at=datetime.utcfromtimestamp(expires_at_ms / 1000),
            you_joined=user_id in joined,
            opponent_joined=opponent_id in joined,
            format=fmt,
        )

    def _last_opponent_from_db(
        self, db: Session, comp_id: str, user_id: str
    ) -> Optional[str]:
        game = (
            db.query(Game)
            .filter(
                Game.competition_id == comp_id,
                Game.status == "finished",
                ((Game.white_user_id == user_id) | (Game.black_user_id == user_id)),
            )
            .order_by(Game.finished_at.desc().nullslast(), Game.created_at.desc())
            .first()
        )
        if game is None:
            return None
        return game.black_user_id if game.white_user_id == user_id else game.white_user_id

    async def _get_last_opponent(
        self, db: Session, redis, comp_id: str, user_id: str
    ) -> Optional[str]:
        key = COMP_LAST_OPPONENT.format(comp_id=comp_id, user_id=user_id)
        cached = await redis.get(key)
        if cached:
            return cached
        last = self._last_opponent_from_db(db, comp_id, user_id)
        if last:
            await redis.set(key, last)
        return last

    async def _set_last_opponents(
        self, redis, comp_id: str, user_a: str, user_b: str
    ) -> None:
        pipe = redis.pipeline()
        pipe.set(COMP_LAST_OPPONENT.format(comp_id=comp_id, user_id=user_a), user_b)
        pipe.set(COMP_LAST_OPPONENT.format(comp_id=comp_id, user_id=user_b), user_a)
        await pipe.execute()

    async def _find_opponent(
        self,
        redis,
        comp_id: str,
        user_id: str,
        rating: int,
        joined_at_ms: int,
        now_ms: int,
        skip: set[str],
        *,
        blocked_opponent_id: Optional[str] = None,
    ) -> Optional[CompQueueEntry]:
        queue_key = COMP_QUEUE.format(comp_id=comp_id)
        candidates = await redis.zrangebyscore(
            queue_key, rating - MAX_RATING_DIFF, rating + MAX_RATING_DIFF
        )

        best: Optional[CompQueueEntry] = None
        best_diff = float("inf")

        for candidate_id in candidates:
            if candidate_id == user_id or candidate_id in skip:
                continue
            if blocked_opponent_id and candidate_id == blocked_opponent_id:
                continue

            entry = await self._load_entry(redis, comp_id, candidate_id)
            if not entry:
                await redis.zrem(queue_key, candidate_id)
                continue

            if now_ms - entry.joined_at_ms > SEEK_STALE_MS:
                await self._remove_from_queue(redis, comp_id, candidate_id)
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

    async def _load_entry(self, redis, comp_id: str, user_id: str) -> Optional[CompQueueEntry]:
        data = await redis.hgetall(COMP_USER.format(comp_id=comp_id, user_id=user_id))
        if not data:
            return None
        return CompQueueEntry(
            user_id=data["user_id"],
            username=data["username"],
            rating=int(data["rating"]),
            joined_at_ms=int(data["joined_at"]),
        )

    async def _remove_pair(self, redis, comp_id: str, user_a: str, user_b: str) -> None:
        queue_key = COMP_QUEUE.format(comp_id=comp_id)
        pipe = redis.pipeline()
        pipe.zrem(queue_key, user_a, user_b)
        pipe.delete(COMP_USER.format(comp_id=comp_id, user_id=user_a))
        pipe.delete(COMP_USER.format(comp_id=comp_id, user_id=user_b))
        pipe.delete(COMP_USER_ACTIVE.format(user_id=user_a))
        pipe.delete(COMP_USER_ACTIVE.format(user_id=user_b))
        await pipe.execute()

    async def _remove_from_queue(self, redis, comp_id: str, user_id: str) -> None:
        pipe = redis.pipeline()
        pipe.zrem(COMP_QUEUE.format(comp_id=comp_id), user_id)
        pipe.delete(COMP_USER.format(comp_id=comp_id, user_id=user_id))
        pipe.delete(COMP_USER_ACTIVE.format(user_id=user_id))
        await pipe.execute()

    def _create_comp_game(
        self,
        db: Session,
        comp_id: str,
        meta: dict,
        player_a: CompQueueEntry,
        player_b: CompQueueEntry,
        *,
        white_user_id: str | None = None,
    ) -> Game:
        time_control = meta["time_control"]
        config = parse_time_control_config(time_control)
        pool = meta.get("rating_pool") or "blitz"

        if white_user_id == player_a.user_id:
            white, black = player_a, player_b
        elif white_user_id == player_b.user_id:
            white, black = player_b, player_a
        else:
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
            competition_id=comp_id,
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

    def record_game_result(self, db: Session, game: Game) -> None:
        if not game.competition_id or game.result is None:
            return

        for user_id, outcome in (
            (game.white_user_id, self._outcome_for_color(game.result, "white")),
            (game.black_user_id, self._outcome_for_color(game.result, "black")),
        ):
            participant = (
                db.query(CompetitionParticipant)
                .filter(
                    CompetitionParticipant.competition_id == game.competition_id,
                    CompetitionParticipant.user_id == user_id,
                )
                .first()
            )
            if participant is None:
                continue

            participant.games_played += 1
            if outcome == "win":
                participant.wins += 1
                participant.score += WIN_POINTS
            elif outcome == "draw":
                participant.draws += 1
                participant.score += DRAW_POINTS
            else:
                participant.losses += 1

        db.commit()

        comp = db.query(Competition).filter(Competition.id == game.competition_id).first()
        if comp is None:
            return

        participant_ids = [
            row[0]
            for row in db.query(CompetitionParticipant.user_id)
            .filter(CompetitionParticipant.competition_id == comp.id)
            .all()
        ]
        from app.services.notification_service import notification_service

        notification_service.schedule_standings_updated(comp.id, comp.name, participant_ids)

    @staticmethod
    def _outcome_for_color(result: str, color: str) -> str:
        if result == "draw":
            return "draw"
        if result == color:
            return "win"
        return "loss"


competition_manager_service = CompetitionManagerService()
