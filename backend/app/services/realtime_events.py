"""Redis pub/sub: fan-out game and user events across WS workers."""

import asyncio
import json
import logging
from typing import Any

from app.db.redis_client import get_redis

logger = logging.getLogger(__name__)

SEEK_MATCH_CHANNEL = "seek:matched"
COMP_CHANNEL_PREFIX = "comp:"


def comp_channel(competition_id: str) -> str:
    """Spectator / leaderboard events for one competition."""
    return f"{COMP_CHANNEL_PREFIX}{competition_id}"


def comp_match_channel(competition_id: str) -> str:
    """Match notifications scoped to a competition."""
    return f"{COMP_CHANNEL_PREFIX}{competition_id}:matched"


def game_channel(game_id: str) -> str:
    return f"game:{game_id}"


def user_channel(user_id: str) -> str:
    return f"user:{user_id}"


async def publish_game(game_id: str, payload: dict[str, Any]) -> None:
    redis = await get_redis()
    await redis.publish(game_channel(game_id), json.dumps(payload))


async def publish_user(user_id: str, payload: dict[str, Any]) -> None:
    redis = await get_redis()
    await redis.publish(user_channel(user_id), json.dumps(payload))


async def _publish_match_to_users(
    channel: str,
    user_ids: list[str],
    game_id: str,
    *,
    competition_id: str | None = None,
) -> None:
    redis = await get_redis()
    payload: dict[str, Any] = {"users": user_ids, "game_id": game_id}
    if competition_id:
        payload["competition_id"] = competition_id
    await redis.publish(channel, json.dumps(payload))


async def publish_casual_match(user_ids: list[str], game_id: str) -> None:
    """Lobby / quick-pairing match found."""
    await _publish_match_to_users(SEEK_MATCH_CHANNEL, user_ids, game_id)


async def publish_comp_match(user_ids: list[str], game_id: str, competition_id: str) -> None:
    """Competition pool match found — scoped to comp:{id}:matched."""
    await _publish_match_to_users(
        comp_match_channel(competition_id),
        user_ids,
        game_id,
        competition_id=competition_id,
    )


async def publish_comp_broadcast(competition_id: str, payload: dict[str, Any]) -> None:
    redis = await get_redis()
    await redis.publish(comp_channel(competition_id), json.dumps(payload))


async def publish_comp_refresh(
    competition_id: str,
    reason: str,
    participant_user_ids: list[str] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "type": "comp_refresh",
        "competition_id": competition_id,
        "reason": reason,
    }
    await publish_comp_broadcast(competition_id, payload)
    for user_id in participant_user_ids or []:
        await publish_user(user_id, payload)


async def _deliver_matched_to_users(data: dict[str, Any]) -> None:
    from app.services.ws_manager import ws_manager

    game_id = data["game_id"]
    comp_id = data.get("competition_id")
    for uid in data["users"]:
        msg: dict[str, Any] = {"type": "matched", "game_id": game_id}
        if comp_id:
            msg["competition_id"] = comp_id
        await ws_manager.send_to_user(uid, msg)


async def run_realtime_listener() -> None:
    from app.services.ws_manager import ws_manager

    redis = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.psubscribe(
        SEEK_MATCH_CHANNEL,
        "game:*",
        "user:*",
        f"{COMP_CHANNEL_PREFIX}*",
    )
    logger.info(
        "Realtime pub/sub listener started (seek match, game, user, comp events)"
    )

    try:
        async for message in pubsub.listen():
            msg_type = message.get("type")
            if msg_type not in ("message", "pmessage"):
                continue

            channel = message.get("channel")
            if isinstance(channel, bytes):
                channel = channel.decode()

            try:
                data = json.loads(message["data"])
            except (json.JSONDecodeError, TypeError):
                logger.warning("Invalid pub/sub payload on %s", channel)
                continue

            try:
                if channel == SEEK_MATCH_CHANNEL:
                    await _deliver_matched_to_users(data)
                elif channel.startswith(COMP_CHANNEL_PREFIX):
                    if channel.endswith(":matched"):
                        await _deliver_matched_to_users(data)
                    else:
                        comp_id = channel[len(COMP_CHANNEL_PREFIX) :]
                        await ws_manager.broadcast_comp_event(comp_id, data)
                elif channel.startswith("game:"):
                    game_id = channel.split(":", 1)[1]
                    await ws_manager.deliver_game_local(game_id, data)
                elif channel.startswith("user:"):
                    user_id = channel.split(":", 1)[1]
                    await ws_manager.send_to_user(user_id, data)
            except Exception:
                logger.exception("Failed to handle pub/sub on %s", channel)
    finally:
        await pubsub.punsubscribe(
            SEEK_MATCH_CHANNEL,
            "game:*",
            "user:*",
            f"{COMP_CHANNEL_PREFIX}*",
        )
        await pubsub.aclose()
