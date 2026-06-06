"""Ephemeral draw offers in Redis."""

import json
from typing import Any, Optional

from app.db.redis_client import get_redis

DRAW_OFFER_KEY = "game:{game_id}:draw_offer"
DRAW_OFFER_TTL = 172_800


async def set_draw_offer(game_id: str, user_id: str, color: str) -> None:
    redis = await get_redis()
    payload = json.dumps({"user_id": user_id, "color": color})
    await redis.set(DRAW_OFFER_KEY.format(game_id=game_id), payload, ex=DRAW_OFFER_TTL)


async def get_draw_offer(game_id: str) -> Optional[dict[str, Any]]:
    redis = await get_redis()
    raw = await redis.get(DRAW_OFFER_KEY.format(game_id=game_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


async def clear_draw_offer(game_id: str) -> None:
    redis = await get_redis()
    await redis.delete(DRAW_OFFER_KEY.format(game_id=game_id))
