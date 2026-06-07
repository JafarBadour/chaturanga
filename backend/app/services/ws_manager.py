"""WebSocket connection manager — local sockets; Redis pub/sub for cross-worker fan-out."""

import logging
from datetime import datetime
from typing import Any

from fastapi import HTTPException, WebSocket
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.services.game_play_service import game_play_service
from app.services.competition_manager_service import competition_manager_service
from app.services.matchmaking_service import matchmaking_service
from app.services.realtime_events import publish_game, publish_user
from app.utils.draw_offers import clear_draw_offer, get_draw_offer, set_draw_offer
from app.utils.game_social import ALLOWED_REACTIONS, check_chat_rate, validate_chat_message

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Local-only: which users on THIS worker are watching which games
        self.user_sockets: dict[str, WebSocket] = {}
        self.game_subscribers: dict[str, set[str]] = {}
        self.user_games: dict[str, set[str]] = {}
        self.comp_watchers: dict[str, set[str]] = {}
        self.user_comps: dict[str, set[str]] = {}

    async def connect_user(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if user_id in self.user_sockets:
            try:
                await self.user_sockets[user_id].close()
            except Exception:
                pass
        self.user_sockets[user_id] = websocket

    async def disconnect_user(self, user_id: str) -> None:
        await matchmaking_service.leave_queue(user_id)
        await competition_manager_service.leave_availability(user_id)
        self.user_sockets.pop(user_id, None)
        for game_id in self.user_games.pop(user_id, set()):
            subs = self.game_subscribers.get(game_id)
            if subs:
                subs.discard(user_id)
                if not subs:
                    self.game_subscribers.pop(game_id, None)
        for comp_id in self.user_comps.pop(user_id, set()):
            watchers = self.comp_watchers.get(comp_id)
            if watchers:
                watchers.discard(user_id)
                if not watchers:
                    self.comp_watchers.pop(comp_id, None)

    async def broadcast_comp_event(self, competition_id: str, payload: dict[str, Any]) -> None:
        for user_id in list(self.comp_watchers.get(competition_id, set())):
            await self.send_to_user(user_id, payload)

    def watch_competition(self, competition_id: str, user_id: str) -> None:
        self.comp_watchers.setdefault(competition_id, set()).add(user_id)
        self.user_comps.setdefault(user_id, set()).add(competition_id)

    def unwatch_competition(self, competition_id: str, user_id: str) -> None:
        watchers = self.comp_watchers.get(competition_id)
        if watchers:
            watchers.discard(user_id)
            if not watchers:
                self.comp_watchers.pop(competition_id, None)
        comps = self.user_comps.get(user_id)
        if comps:
            comps.discard(competition_id)
            if not comps:
                self.user_comps.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: dict[str, Any]) -> None:
        ws = self.user_sockets.get(user_id)
        if ws:
            await ws.send_json(payload)

    async def deliver_game_local(self, game_id: str, payload: dict[str, Any]) -> None:
        """Deliver a Redis game event to local subscribers only."""
        for user_id in list(self.game_subscribers.get(game_id, set())):
            await self.send_to_user(user_id, payload)

    def subscribe_game(self, game_id: str, user_id: str) -> None:
        self.game_subscribers.setdefault(game_id, set()).add(user_id)
        self.user_games.setdefault(user_id, set()).add(game_id)

    async def _broadcast_social(
        self, db: Session, game_id: str, user_id: str, payload: dict[str, Any]
    ) -> None:
        game = game_play_service.get_game(db, game_id)
        game_play_service.ensure_participant(game, user_id)
        self.subscribe_game(game_id, user_id)
        await publish_game(game_id, payload)

    async def _send_game_state(
        self,
        db: Session,
        game_id: str,
        game,
        msg_type: str,
        strike_event=None,
        *,
        broadcast: bool = False,
        user_id: str | None = None,
    ) -> None:
        payload = game_play_service.build_ws_payload(db, game, msg_type, strike_event)
        if broadcast:
            await publish_game(game_id, payload)
        elif user_id:
            await self.send_to_user(user_id, payload)

    async def _publish_game_payload(
        self,
        db: Session,
        game_id: str,
        game,
        msg_type: str,
        strike_event=None,
    ) -> None:
        payload = game_play_service.build_ws_payload(db, game, msg_type, strike_event)
        offer = await get_draw_offer(game_id)
        if offer:
            payload["draw_offer"] = offer
        await publish_game(game_id, payload)

    async def handle_message(self, user_id: str, data: dict[str, Any]) -> None:
        msg_type = data.get("type")

        if msg_type == "ping":
            await self.send_to_user(user_id, {"type": "pong", "t": data.get("t")})
            return

        db = SessionLocal()
        try:
            if msg_type == "seek":
                from app.services.auth_service import auth_service

                try:
                    user = auth_service.get_user_by_id(db, user_id)
                    time_control = data.get("time_control", "5+0")
                    game_id = await matchmaking_service.join_queue(db, user, time_control)
                    if not game_id:
                        await publish_user(
                            user_id,
                            {"type": "seeking", "time_control": time_control},
                        )
                except Exception as e:
                    logger.exception("Seek failed for user %s", user_id)
                    await matchmaking_service.leave_queue(user_id)
                    await publish_user(
                        user_id, {"type": "seek_error", "message": str(e)}
                    )

            elif msg_type == "cancel_seek":
                await matchmaking_service.leave_queue(user_id)
                await publish_user(user_id, {"type": "seek_cancelled"})

            elif msg_type == "comp_seek":
                from app.services.auth_service import auth_service

                try:
                    user = auth_service.get_user_by_id(db, user_id)
                    competition_id = data.get("competition_id")
                    if not competition_id:
                        return
                    await competition_manager_service.enter_availability(
                        db, user, competition_id
                    )
                except HTTPException as exc:
                    await competition_manager_service.leave_availability(
                        user_id, data.get("competition_id")
                    )
                    await publish_user(
                        user_id,
                        {"type": "comp_seek_error", "message": exc.detail},
                    )
                except Exception as e:
                    logger.exception("Comp seek failed for user %s", user_id)
                    await competition_manager_service.leave_availability(
                        user_id, data.get("competition_id")
                    )
                    await publish_user(
                        user_id,
                        {"type": "comp_seek_error", "message": str(e)},
                    )

            elif msg_type == "comp_cancel_seek":
                competition_id = data.get("competition_id")
                await competition_manager_service.leave_availability(
                    user_id, competition_id
                )

            elif msg_type == "comp_join_match":
                from app.services.auth_service import auth_service

                try:
                    user = auth_service.get_user_by_id(db, user_id)
                    competition_id = data.get("competition_id")
                    offer_id = data.get("offer_id")
                    if not competition_id or not offer_id:
                        return
                    await competition_manager_service.join_scheduled_match(
                        db, user, competition_id, offer_id
                    )
                except HTTPException as exc:
                    await publish_user(
                        user_id,
                        {
                            "type": "comp_join_match_error",
                            "message": exc.detail,
                            "competition_id": data.get("competition_id"),
                            "offer_id": data.get("offer_id"),
                        },
                    )
                except Exception as e:
                    logger.exception("Comp join match failed for user %s", user_id)
                    await publish_user(
                        user_id,
                        {
                            "type": "comp_join_match_error",
                            "message": str(e),
                            "competition_id": data.get("competition_id"),
                            "offer_id": data.get("offer_id"),
                        },
                    )

            elif msg_type == "comp_watch":
                competition_id = data.get("competition_id")
                if competition_id:
                    self.watch_competition(competition_id, user_id)

            elif msg_type == "comp_unwatch":
                competition_id = data.get("competition_id")
                if competition_id:
                    self.unwatch_competition(competition_id, user_id)

            elif msg_type == "join_game":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                if game.competition_id:
                    await competition_manager_service.leave_availability(
                        user_id, game.competition_id
                    )
                self.subscribe_game(game_id, user_id)

                from app.db.redis_client import get_redis

                redis = await get_redis()
                joined_key = f"game:{game_id}:joined"
                await redis.sadd(joined_key, user_id)
                await redis.expire(joined_key, 172_800)
                both_present = (await redis.scard(joined_key)) >= 2
                game = game_play_service.sync_royale_clock_on_join(
                    db, game, both_present
                )

                if game.game_mode != "royale":
                    game = game_play_service.sync_standard_clock_state(db, game)

                game, strike_event = game_play_service.process_move_timeout(db, game)
                if game.status == "finished":
                    msg_type_out = "game_over"
                    await clear_draw_offer(game_id)
                elif strike_event:
                    msg_type_out = "strike"
                else:
                    msg_type_out = "game_state"

                payload = game_play_service.build_ws_payload(
                    db, game, msg_type_out, strike_event
                )
                offer = await get_draw_offer(game_id)
                if offer:
                    payload["draw_offer"] = offer
                if msg_type_out in ("game_over", "strike"):
                    await publish_game(game_id, payload)
                else:
                    await self.send_to_user(user_id, payload)

            elif msg_type == "flag":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                self.subscribe_game(game_id, user_id)
                updated = game_play_service.process_standard_flag(db, game)
                if updated.status == "finished":
                    await clear_draw_offer(game_id)
                msg_type_out = "game_over" if updated.status == "finished" else "game_update"
                await self._publish_game_payload(db, game_id, updated, msg_type_out)

            elif msg_type == "offer_draw":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                color = game_play_service.offer_draw(db, game, user_id)
                self.subscribe_game(game_id, user_id)
                await set_draw_offer(game_id, user_id, color)
                await publish_game(
                    game_id,
                    {
                        "type": "draw_offered",
                        "game_id": game_id,
                        "draw_offer": {"user_id": user_id, "color": color},
                    },
                )

            elif msg_type == "accept_draw":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                self.subscribe_game(game_id, user_id)
                offer = await get_draw_offer(game_id)
                if not offer or offer.get("user_id") == user_id:
                    await publish_user(
                        user_id,
                        {
                            "type": "draw_error",
                            "game_id": game_id,
                            "message": "No draw offer to accept",
                        },
                    )
                    return
                updated = game_play_service.accept_draw(db, game, user_id)
                await clear_draw_offer(game_id)
                await self._publish_game_payload(db, game_id, updated, "game_over")

            elif msg_type == "decline_draw":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                self.subscribe_game(game_id, user_id)
                await clear_draw_offer(game_id)
                await publish_game(
                    game_id, {"type": "draw_declined", "game_id": game_id}
                )

            elif msg_type == "move_timeout":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                self.subscribe_game(game_id, user_id)
                game, strike_event = game_play_service.process_move_timeout(db, game)
                if not strike_event:
                    return
                msg_type_out = "game_over" if game.status == "finished" else "strike"
                payload = game_play_service.build_ws_payload(
                    db, game, msg_type_out, strike_event
                )
                await publish_game(game_id, payload)

            elif msg_type == "move":
                game_id = data.get("game_id")
                if not game_id:
                    return
                move_received_at = datetime.utcnow()
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                self.subscribe_game(game_id, user_id)
                try:
                    updated = game_play_service.make_move(
                        db,
                        game,
                        user_id,
                        data.get("from", ""),
                        data.get("to", ""),
                        data.get("promotion"),
                        move_at=move_received_at,
                    )
                except HTTPException as exc:
                    game = game_play_service.resolve_terminal_state(db, game)
                    db.refresh(game)
                    await publish_user(
                        user_id,
                        {
                            "type": "move_error",
                            "message": exc.detail,
                            "game": game_play_service.to_response(db, game).model_dump(
                                mode="json"
                            ),
                            **game_play_service.get_clock_state(game),
                        },
                    )
                    if game.status == "finished":
                        await clear_draw_offer(game_id)
                        await self._publish_game_payload(db, game_id, game, "game_over")
                    return
                await clear_draw_offer(game_id)
                msg_type_out = "game_over" if updated.status == "finished" else "game_update"
                await self._publish_game_payload(db, game_id, updated, msg_type_out)

            elif msg_type == "resign":
                game_id = data.get("game_id")
                if not game_id:
                    return
                game = game_play_service.get_game(db, game_id)
                game_play_service.ensure_participant(game, user_id)
                self.subscribe_game(game_id, user_id)
                updated = game_play_service.resign(db, game, user_id)
                await clear_draw_offer(game_id)
                await self._publish_game_payload(db, game_id, updated, "game_over")

            elif msg_type == "game_reaction":
                game_id = data.get("game_id")
                reaction_id = data.get("reaction_id", "")
                if not game_id or reaction_id not in ALLOWED_REACTIONS:
                    return
                from app.services.auth_service import auth_service

                user = auth_service.get_user_by_id(db, user_id)
                await self._broadcast_social(
                    db,
                    game_id,
                    user_id,
                    {
                        "type": "game_reaction",
                        "game_id": game_id,
                        "user_id": user_id,
                        "username": user.username,
                        "reaction_id": reaction_id,
                        "at": datetime.utcnow().isoformat() + "Z",
                    },
                )

            elif msg_type == "game_message":
                game_id = data.get("game_id")
                raw_text = data.get("text") or ""
                if not game_id:
                    return

                normalized, validation_error = validate_chat_message(raw_text)
                if validation_error:
                    await publish_user(
                        user_id,
                        {
                            "type": "game_message_error",
                            "game_id": game_id,
                            "message": validation_error,
                        },
                    )
                    return

                rate_error = await check_chat_rate(user_id, game_id, normalized)
                if rate_error:
                    await publish_user(
                        user_id,
                        {
                            "type": "game_message_error",
                            "game_id": game_id,
                            "message": rate_error,
                        },
                    )
                    return

                from app.services.auth_service import auth_service

                user = auth_service.get_user_by_id(db, user_id)
                await self._broadcast_social(
                    db,
                    game_id,
                    user_id,
                    {
                        "type": "game_message",
                        "game_id": game_id,
                        "user_id": user_id,
                        "username": user.username,
                        "text": normalized,
                        "at": datetime.utcnow().isoformat() + "Z",
                    },
                )

        except HTTPException as exc:
            logger.warning("WS request failed for user %s: %s", user_id, exc.detail)
            await publish_user(user_id, {"type": "error", "message": exc.detail})
        except Exception:
            logger.exception("WS handler error for user %s", user_id)
        finally:
            db.close()


ws_manager = ConnectionManager()
