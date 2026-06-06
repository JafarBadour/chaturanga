"""In-game social validation, reactions, and chat limits (Redis-backed)."""

import re
import time
from typing import Optional

from app.db.redis_client import get_redis

ALLOWED_REACTIONS = frozenset(
    {"thumbs", "laugh", "fire", "flex", "eyes", "target", "zap", "crown", "party"}
)

MAX_CHAT_LENGTH = 200
MIN_CHAT_LENGTH = 1
CHAT_COOLDOWN_SECONDS = 2
MAX_CHAT_PER_MINUTE = 10
MAX_IDENTICAL_MESSAGES = 3

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_MULTI_SPACE_RE = re.compile(r"\s+")


def normalize_chat_text(text: str) -> str:
    cleaned = _CONTROL_CHARS_RE.sub("", text.strip())
    return _MULTI_SPACE_RE.sub(" ", cleaned)


def validate_chat_message(text: str) -> tuple[str | None, str | None]:
    normalized = normalize_chat_text(text)
    if len(normalized) < MIN_CHAT_LENGTH:
        return None, "Message cannot be empty"
    if len(normalized) > MAX_CHAT_LENGTH:
        return None, f"Message is too long (max {MAX_CHAT_LENGTH} characters)"
    return normalized, None


def _chat_rate_key(user_id: str, game_id: str) -> str:
    return f"chat:rate:{user_id}:{game_id}"


def _chat_dup_key(user_id: str, game_id: str) -> str:
    return f"chat:dup:{user_id}:{game_id}"


async def check_chat_rate(user_id: str, game_id: str, normalized_text: str) -> Optional[str]:
    """Distributed chat rate limit (safe across WS workers)."""
    redis = await get_redis()
    rate_key = _chat_rate_key(user_id, game_id)
    dup_key = _chat_dup_key(user_id, game_id)
    now = time.time()
    window_start = now - 60

    pipe = redis.pipeline()
    pipe.zremrangebyscore(rate_key, 0, window_start)
    pipe.zrange(rate_key, 0, -1)
    pipe.lrange(dup_key, 0, -1)
    _, timestamps_raw, recent_raw = await pipe.execute()

    timestamps = [float(t) for t in timestamps_raw]
    if timestamps and now - timestamps[-1] < CHAT_COOLDOWN_SECONDS:
        wait = int(CHAT_COOLDOWN_SECONDS - (now - timestamps[-1])) + 1
        return f"Wait {wait}s before sending another message"

    if len(timestamps) >= MAX_CHAT_PER_MINUTE:
        return "Message limit reached. Try again in a minute."

    recent = list(recent_raw)
    if (
        len(recent) >= MAX_IDENTICAL_MESSAGES
        and all(t == normalized_text for t in recent)
    ):
        return "Please do not repeat the same message"

    pipe = redis.pipeline()
    pipe.zadd(rate_key, {str(now): now})
    pipe.expire(rate_key, 120)
    pipe.rpush(dup_key, normalized_text)
    pipe.ltrim(dup_key, -MAX_IDENTICAL_MESSAGES, -1)
    pipe.expire(dup_key, 120)
    await pipe.execute()
    return None
