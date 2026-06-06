"""Per-side opening grace before the clock counts on a player's first turn."""

from datetime import datetime
from typing import Optional

from app.db.models import Game

START_GRACE_MS = 10_000


def is_first_turn(game: Game, color: str) -> bool:
    moves = [m for m in game.moves.split() if m]
    if color == "white":
        return len(moves) == 0
    return len(moves) == 1


def raw_elapsed_ms(game: Game, at: Optional[datetime] = None) -> int:
    if game.last_move_at is None:
        return 0
    moment = at or datetime.utcnow()
    return max(0, int((moment - game.last_move_at).total_seconds() * 1000))


def billable_elapsed_ms(
    game: Game, color: str, at: Optional[datetime] = None
) -> int:
    if game.last_move_at is None:
        return 0
    raw = raw_elapsed_ms(game, at)
    if is_first_turn(game, color):
        return max(0, raw - START_GRACE_MS)
    return raw
