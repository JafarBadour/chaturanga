"""Build Swiss tournament bracket structure for the competition detail view."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Literal

from sqlalchemy.orm import Session, joinedload

from app.db.models import Competition, CompetitionParticipant, Game
from app.db.redis_client import get_redis
from app.models.competition import (
    SwissMatchEntry,
    SwissPlayerChip,
    SwissRecordGroup,
    SwissRound,
    SwissStructure,
)
from app.services.competition_manager_service import COMP_OFFER, COMP_OFFERS, COMP_WAITING

SWISS_ADVANCE_WINS = 3
SWISS_ELIMINATE_LOSSES = 3


def _record_label(wins: int, losses: int) -> str:
    return f"{wins}-{losses}"


def _record_tone(wins: int, losses: int) -> Literal["positive", "negative", "even"]:
    if wins > losses:
        return "positive"
    if wins < losses:
        return "negative"
    return "even"


def _player_status(wins: int, losses: int) -> Literal["active", "advanced", "eliminated"]:
    if wins >= SWISS_ADVANCE_WINS:
        return "advanced"
    if losses >= SWISS_ELIMINATE_LOSSES:
        return "eliminated"
    return "active"


def _outcome_for_color(result: str, color: str) -> str:
    if result == "draw":
        return "draw"
    if result == color:
        return "win"
    return "loss"


def _apply_result(wl: dict[str, tuple[int, int]], user_id: str, outcome: str) -> None:
    wins, losses = wl[user_id]
    if outcome == "win":
        wl[user_id] = (wins + 1, losses)
    elif outcome == "loss":
        wl[user_id] = (wins, losses + 1)


class SwissStructureService:
    async def build(self, db: Session, comp: Competition) -> SwissStructure:
        participants = (
            db.query(CompetitionParticipant)
            .options(joinedload(CompetitionParticipant.user))
            .filter(CompetitionParticipant.competition_id == comp.id)
            .all()
        )
        usernames = {
            p.user_id: p.user.username if p.user else "—"
            for p in participants
        }
        live_wl = {p.user_id: (p.wins, p.losses) for p in participants}

        games = (
            db.query(Game)
            .options(
                joinedload(Game.white_player),
                joinedload(Game.black_player),
            )
            .filter(Game.competition_id == comp.id)
            .order_by(Game.created_at.asc())
            .all()
        )

        round_matches: dict[int, dict[str, list[SwissMatchEntry]]] = defaultdict(
            lambda: defaultdict(list)
        )
        replay_wl: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))
        for p in participants:
            replay_wl[p.user_id] = (0, 0)

        busy_users: set[str] = set()
        seen_match_keys: set[str] = set()

        for game in games:
            white_id = game.white_user_id
            black_id = game.black_user_id
            w_pre = replay_wl[white_id]
            b_pre = replay_wl[black_id]
            record = _record_label(w_pre[0], w_pre[1])
            round_num = w_pre[0] + w_pre[1] + 1

            if game.status == "active":
                busy_users.add(white_id)
                busy_users.add(black_id)
                match_status: Literal["scheduled", "joining", "active", "finished"] = "active"
            else:
                match_status = "finished"

            match_key = game.id
            entry = SwissMatchEntry(
                match_id=game.id,
                offer_id=None,
                white_user_id=white_id,
                black_user_id=black_id,
                white_username=game.white_player.username if game.white_player else usernames.get(white_id, "—"),
                black_username=game.black_player.username if game.black_player else usernames.get(black_id, "—"),
                status=match_status,
                result=game.result if game.status == "finished" else None,
                record=record,
            )
            round_matches[round_num][record].append(entry)
            seen_match_keys.add(match_key)

            if game.status == "finished" and game.result:
                _apply_result(
                    replay_wl,
                    white_id,
                    _outcome_for_color(game.result, "white"),
                )
                _apply_result(
                    replay_wl,
                    black_id,
                    _outcome_for_color(game.result, "black"),
                )

        redis = await get_redis()
        offer_ids = await redis.smembers(COMP_OFFERS.format(comp_id=comp.id))
        now_ms = int(time.time() * 1000)

        for offer_id in offer_ids:
            offer_key = COMP_OFFER.format(comp_id=comp.id, offer_id=offer_id)
            data = await redis.hgetall(offer_key)
            if not data:
                continue
            expires_at_ms = int(data["expires_at_ms"])
            if now_ms >= expires_at_ms:
                continue

            user_a = data["user_a"]
            user_b = data["user_b"]
            white_id = data.get("white_user_id") or user_a
            black_id = user_b if white_id == user_a else user_a
            username_a = data.get("username_a", "—")
            username_b = data.get("username_b", "—")

            w_wins, w_losses = live_wl.get(white_id, (0, 0))
            record = _record_label(w_wins, w_losses)
            round_num = w_wins + w_losses + 1

            joined_key = f"{offer_key}:joined"
            joined = await redis.smembers(joined_key)
            offer_status: Literal["scheduled", "joining", "active", "finished"] = (
                "joining" if joined else "scheduled"
            )

            busy_users.add(user_a)
            busy_users.add(user_b)

            entry = SwissMatchEntry(
                match_id=None,
                offer_id=offer_id,
                white_user_id=white_id,
                black_user_id=black_id,
                white_username=username_a if white_id == user_a else username_b,
                black_username=username_b if black_id == user_b else username_a,
                status=offer_status,
                result=None,
                record=record,
            )
            round_matches[round_num][record].append(entry)

        advanced: list[SwissPlayerChip] = []
        eliminated: list[SwissPlayerChip] = []
        for p in participants:
            status = _player_status(p.wins, p.losses)
            chip = SwissPlayerChip(
                user_id=p.user_id,
                username=usernames[p.user_id],
                wins=p.wins,
                losses=p.losses,
                status=status,
            )
            if status == "advanced":
                advanced.append(chip)
            elif status == "eliminated":
                eliminated.append(chip)

        advanced.sort(key=lambda c: (-c.wins, c.username.lower()))
        eliminated.sort(key=lambda c: (c.losses, c.username.lower()))

        redis = await get_redis()
        waiting_users = await redis.smembers(COMP_WAITING.format(comp_id=comp.id))

        max_round = max(round_matches.keys()) if round_matches else 1
        active_live_round = max(
            (
                w + l + 1
                for w, l in live_wl.values()
                if _player_status(w, l) == "active"
            ),
            default=1,
        )
        max_round = max(max_round, active_live_round)
        if comp.status == "upcoming" or (comp.status == "running" and not round_matches and not busy_users):
            max_round = max(max_round, 1)

        rounds: list[SwissRound] = []
        for round_num in range(1, max_round + 1):
            groups: list[SwissRecordGroup] = []
            records_in_round = dict(round_matches.get(round_num, {}))

            if round_num == max_round:
                for p in participants:
                    wins, losses = live_wl.get(p.user_id, (0, 0))
                    if _player_status(wins, losses) != "active":
                        continue
                    record = _record_label(wins, losses)
                    records_in_round.setdefault(record, [])

            if round_num == 1 and not records_in_round and participants:
                records_in_round = {"0-0": []}

            for record, matches in sorted(
                records_in_round.items(),
                key=lambda item: (-int(item[0].split("-")[0]), int(item[0].split("-")[1])),
            ):
                wins_s, losses_s = record.split("-")
                wins, losses = int(wins_s), int(losses_s)
                idle: list[SwissPlayerChip] = []
                if round_num == max_round:
                    for p in participants:
                        if live_wl.get(p.user_id) != (wins, losses):
                            continue
                        if p.user_id in busy_users:
                            continue
                        if p.user_id not in waiting_users:
                            continue
                        status = _player_status(p.wins, p.losses)
                        if status != "active":
                            continue
                        idle.append(
                            SwissPlayerChip(
                                user_id=p.user_id,
                                username=usernames[p.user_id],
                                wins=p.wins,
                                losses=p.losses,
                                status=status,
                            )
                        )
                    idle.sort(key=lambda c: c.username.lower())

                groups.append(
                    SwissRecordGroup(
                        record=record,
                        wins=wins,
                        losses=losses,
                        tone=_record_tone(wins, losses),
                        matches=matches,
                        players_idle=idle,
                    )
                )

            if groups:
                rounds.append(SwissRound(round=round_num, groups=groups))

        advance_slots = None
        if comp.max_participants is not None and comp.max_participants >= 2:
            advance_slots = comp.max_participants // 2

        return SwissStructure(
            advance_wins=SWISS_ADVANCE_WINS,
            eliminate_losses=SWISS_ELIMINATE_LOSSES,
            advance_slots=advance_slots,
            rounds=rounds,
            advanced=advanced,
            eliminated=eliminated,
        )


swiss_structure_service = SwissStructureService()
