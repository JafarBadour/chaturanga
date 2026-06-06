"""Online game logic with server-side move validation."""

from datetime import datetime
from typing import Any, Optional

import chess
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import Game, User
from app.models.game import (
    DrawOfferInfo,
    GameHistoryItem,
    GameHistoryPage,
    GamePlayerInfo,
    GameReplayResponse,
    GameResponse,
    ReplayPly,
)
from app.services.rating_service import rating_service
from app.utils.clock_grace import (
    START_GRACE_MS,
    billable_elapsed_ms,
    is_first_turn,
    raw_elapsed_ms,
)

MAX_STRIKES = 2


class GamePlayService:
    START_FEN = chess.STARTING_FEN

    def get_game(self, db: Session, game_id: str) -> Game:
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Game not found")
        return game

    def ensure_participant(self, game: Game, user_id: str) -> str:
        if game.white_user_id == user_id:
            return "white"
        if game.black_user_id == user_id:
            return "black"
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a participant in this game")

    def is_royale(self, game: Game) -> bool:
        return game.game_mode == "royale"

    def _active_color(self, game: Game) -> str:
        return self.get_position_state(game)["active_color"]

    def to_response(
        self,
        db: Session,
        game: Game,
        draw_offer: Optional[dict[str, Any]] = None,
    ) -> GameResponse:
        white = db.query(User).filter(User.id == game.white_user_id).one()
        black = db.query(User).filter(User.id == game.black_user_id).one()
        position = self.get_position_state(game)
        offer_model = None
        if draw_offer and draw_offer.get("user_id"):
            offer_model = DrawOfferInfo(
                user_id=draw_offer["user_id"],
                color=draw_offer.get("color", "white"),
            )
        competition_format = None
        if game.competition_id:
            from app.db.models import Competition

            comp_format = (
                db.query(Competition.format)
                .filter(Competition.id == game.competition_id)
                .scalar()
            )
            if comp_format:
                competition_format = comp_format
        return GameResponse(
            id=game.id,
            fen=game.fen,
            time_control=game.time_control,
            game_mode=game.game_mode,
            move_limit_ms=game.move_limit_ms,
            white_strikes=game.white_strikes,
            black_strikes=game.black_strikes,
            initial_time_ms=game.initial_time_ms,
            increment_ms=game.increment_ms,
            white_time_ms=game.white_time_ms,
            black_time_ms=game.black_time_ms,
            status=game.status,
            result=game.result,
            termination=game.termination,
            moves=game.moves,
            rating_pool=game.rating_pool,
            white_player=GamePlayerInfo(
                id=white.id, username=white.username, rating=game.white_rating_before
            ),
            black_player=GamePlayerInfo(
                id=black.id, username=black.username, rating=game.black_rating_before
            ),
            white_rating_before=game.white_rating_before,
            black_rating_before=game.black_rating_before,
            white_rating_after=game.white_rating_after,
            black_rating_after=game.black_rating_after,
            created_at=game.created_at,
            finished_at=game.finished_at,
            last_move_at=game.last_move_at,
            competition_id=game.competition_id,
            competition_format=competition_format,
            draw_offer=offer_model,
            **position,
        )

    def _board(self, game: Game) -> chess.Board:
        return chess.Board(game.fen)

    def get_position_state(self, game: Game) -> dict[str, Any]:
        """Server-side position analysis via python-chess."""
        board = self._board(game)
        return {
            "in_check": board.is_check(),
            "is_checkmate": board.is_checkmate(),
            "is_stalemate": board.is_stalemate(),
            "active_color": "white" if board.turn == chess.WHITE else "black",
        }

    def _terminal_from_board(self, board: chess.Board) -> Optional[tuple[str, str]]:
        """Return (result, termination) when the position ends the game."""
        if board.is_checkmate():
            winner = "white" if board.turn == chess.BLACK else "black"
            return winner, "checkmate"
        if board.is_stalemate():
            return "draw", "stalemate"
        if board.is_insufficient_material():
            return "draw", "insufficient_material"
        if board.can_claim_draw():
            return "draw", "draw"
        return None

    def _elapsed_ms(self, game: Game, at: Optional[datetime] = None) -> int:
        if game.last_move_at is None:
            return 0
        moment = at or datetime.utcnow()
        return max(0, int((moment - game.last_move_at).total_seconds() * 1000))

    def _royale_move_timer_ms(self, game: Game) -> int:
        if not game.move_limit_ms:
            return 0
        if game.last_move_at is None:
            return game.move_limit_ms
        active = self._active_color(game)
        raw = raw_elapsed_ms(game)
        if is_first_turn(game, active) and raw < START_GRACE_MS:
            return game.move_limit_ms
        billable = billable_elapsed_ms(game, active)
        return max(0, game.move_limit_ms - billable)

    def sync_royale_clock_on_join(
        self, db: Session, game: Game, both_players_present: bool
    ) -> Game:
        """Start or refresh the royale move timer once both players are on the board."""
        if (
            not self.is_royale(game)
            or game.status != "active"
            or not both_players_present
            or game.moves.strip()
        ):
            return game

        active = self._active_color(game)
        needs_start = game.last_move_at is None
        needs_reset = (
            game.last_move_at is not None
            and billable_elapsed_ms(game, active) >= (game.move_limit_ms or 0)
        )
        if needs_start or needs_reset:
            game.last_move_at = datetime.utcnow()
            db.commit()
            db.refresh(game)
        return game

    def _result_on_flag(self, game: Game, flagged_color: str) -> tuple[str, str]:
        """Determine result when flagged_color ran out of time."""
        board = self._board(game)
        if board.is_insufficient_material():
            return "draw", "insufficient_material"
        winner = "black" if flagged_color == "white" else "white"
        return winner, "timeout"

    def _apply_clock(self, game: Game, color: str, at: Optional[datetime] = None) -> None:
        if self.is_royale(game) or game.last_move_at is None:
            return
        elapsed_ms = billable_elapsed_ms(game, color, at)
        if color == "white":
            game.white_time_ms = max(0, game.white_time_ms - elapsed_ms)
        else:
            game.black_time_ms = max(0, game.black_time_ms - elapsed_ms)

    def _check_flag(self, game: Game) -> Optional[str]:
        if self.is_royale(game):
            return None
        white, black = self.sync_clocks(game)
        board = self._board(game)
        active = "white" if board.turn == chess.WHITE else "black"
        if active == "white" and white <= 0:
            return "white"
        if active == "black" and black <= 0:
            return "black"
        return None

    def sync_standard_clock_state(self, db: Session, game: Game) -> Game:
        """Sync clocks, auto-draw terminal positions, and finish on flag."""
        if game.status != "active" or self.is_royale(game):
            return game

        terminal = self._terminal_from_board(self._board(game))
        if terminal:
            result, termination = terminal
            return self._finish_game(db, game, result, termination)

        white, black = self.sync_clocks(game)
        game.white_time_ms = white
        game.black_time_ms = black

        flagged = self._check_flag(game)
        if flagged:
            result, termination = self._result_on_flag(game, flagged)
            game.white_time_ms = white
            game.black_time_ms = black
            return self._finish_game(db, game, result, termination)

        db.commit()
        db.refresh(game)
        return game

    def process_standard_flag(self, db: Session, game: Game) -> Game:
        """Claim flag when the active player's clock has expired."""
        return self.sync_standard_clock_state(db, game)

    def offer_draw(self, db: Session, game: Game, user_id: str) -> str:
        if game.status != "active":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Game is not active")
        return self.ensure_participant(game, user_id)

    def accept_draw(self, db: Session, game: Game, user_id: str) -> Game:
        if game.status != "active":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Game is not active")
        self.ensure_participant(game, user_id)
        return self._finish_game(db, game, "draw", "agreement")

    def get_clock_state(self, game: Game) -> dict[str, Any]:
        active = self._active_color(game)
        if self.is_royale(game):
            return {
                "white_time_ms": 0,
                "black_time_ms": 0,
                "move_timer_ms": self._royale_move_timer_ms(game),
                "active_color": active,
            }
        white, black = self.sync_clocks(game)
        return {
            "white_time_ms": white,
            "black_time_ms": black,
            "move_timer_ms": None,
            "active_color": active,
        }

    def process_move_timeout(
        self, db: Session, game: Game
    ) -> tuple[Game, Optional[dict[str, Any]]]:
        """Apply a royale strike if the active player exceeded their move limit."""
        if game.status != "active" or not self.is_royale(game) or not game.move_limit_ms:
            return game, None

        active = self._active_color(game)
        if billable_elapsed_ms(game, active) < game.move_limit_ms:
            return game, None

        if active == "white":
            game.white_strikes += 1
            strikes = game.white_strikes
        else:
            game.black_strikes += 1
            strikes = game.black_strikes

        if strikes >= MAX_STRIKES:
            winner = "black" if active == "white" else "white"
            finished = self._finish_game(db, game, winner, "timeout")
            return finished, {"color": active, "strikes": strikes, "forfeit": True}

        game.last_move_at = datetime.utcnow()
        db.commit()
        db.refresh(game)
        return game, {"color": active, "strikes": strikes, "forfeit": False}

    def make_move(
        self,
        db: Session,
        game: Game,
        user_id: str,
        from_sq: str,
        to_sq: str,
        promotion: Optional[str] = None,
        move_at: Optional[datetime] = None,
    ) -> Game:
        if game.status != "active":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Game is not active")

        color = self.ensure_participant(game, user_id)
        board = self._board(game)
        active = "white" if board.turn == chess.WHITE else "black"
        if color != active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not your turn")

        clock_at = move_at or datetime.utcnow()

        if self.is_royale(game):
            if billable_elapsed_ms(game, active, clock_at) >= (game.move_limit_ms or 0):
                game, _ = self.process_move_timeout(db, game)
                if game.status == "finished":
                    return game
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Move time expired")

        uci = from_sq + to_sq + (promotion or "")
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid move format")

        if move not in board.legal_moves:
            if not promotion:
                promo_uci = from_sq + to_sq + "q"
                try:
                    promo_move = chess.Move.from_uci(promo_uci)
                except ValueError:
                    promo_move = None
                if promo_move and promo_move in board.legal_moves:
                    uci = promo_uci
                    move = promo_move
                else:
                    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Illegal move")
            else:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Illegal move")

        if not self.is_royale(game):
            self._apply_clock(game, color, clock_at)
            flagged = self._check_flag(game)
            if flagged:
                white, black = self.sync_clocks(game)
                game.white_time_ms = white
                game.black_time_ms = black
                result, termination = self._result_on_flag(game, flagged)
                return self._finish_game(db, game, result, termination)

        san = board.san(move)
        board.push(move)
        game.fen = board.fen()
        game.moves = (game.moves + " " + san).strip()
        game.last_move_at = clock_at

        if not self.is_royale(game):
            if color == "white":
                game.white_time_ms += game.increment_ms
            else:
                game.black_time_ms += game.increment_ms

        terminal = self._terminal_from_board(board)
        if terminal:
            result, termination = terminal
            return self._finish_game(db, game, result, termination)

        db.commit()
        db.refresh(game)
        return game

    def resign(self, db: Session, game: Game, user_id: str) -> Game:
        if game.status != "active":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Game is not active")
        color = self.ensure_participant(game, user_id)
        winner = "black" if color == "white" else "white"
        return self._finish_game(db, game, winner, "resignation")

    def resolve_terminal_state(self, db: Session, game: Game) -> Game:
        """Finish games whose FEN is already terminal (safety net for stuck active games)."""
        if game.status != "active":
            return game
        terminal = self._terminal_from_board(self._board(game))
        if terminal:
            result, termination = terminal
            return self._finish_game(db, game, result, termination)
        return game

    def _finish_game(self, db: Session, game: Game, result: str, termination: str) -> Game:
        game.status = "finished"
        game.result = result
        game.termination = termination
        game.finished_at = datetime.utcnow()
        db.commit()
        rating_service.update_ratings(db, game, result)
        from app.services.competition_manager_service import competition_manager_service

        competition_manager_service.record_game_result(db, game)
        db.refresh(game)
        return game

    def sync_clocks(self, game: Game) -> tuple[int, int]:
        if self.is_royale(game):
            return 0, 0
        if game.status != "active" or game.last_move_at is None:
            return game.white_time_ms, game.black_time_ms
        board = self._board(game)
        active = "white" if board.turn == chess.WHITE else "black"
        elapsed_ms = billable_elapsed_ms(game, active)
        white = game.white_time_ms
        black = game.black_time_ms
        if active == "white":
            white = max(0, white - elapsed_ms)
        else:
            black = max(0, black - elapsed_ms)
        return white, black

    def build_ws_payload(
        self, db: Session, game: Game, msg_type: str, strike_event: Optional[dict] = None
    ) -> dict[str, Any]:
        game = self.resolve_terminal_state(db, game)
        if game.status == "finished" and msg_type in ("game_state", "game_update", "strike"):
            msg_type = "game_over"
        payload: dict[str, Any] = {
            "type": msg_type,
            "game": self.to_response(db, game).model_dump(mode="json"),
            **self.get_clock_state(game),
        }
        if strike_event:
            payload["strike_event"] = strike_event
        return payload

    def build_replay_plies(self, game: Game) -> list[ReplayPly]:
        board = chess.Board()
        plies: list[ReplayPly] = [
            ReplayPly(ply=0, fen=board.fen(), san=None, from_square=None, to_square=None, mover=None)
        ]
        for san in [m for m in game.moves.split() if m and m != "…"]:
            try:
                move = board.parse_san(san)
            except ValueError:
                break
            mover = "white" if board.turn == chess.WHITE else "black"
            from_sq = chess.square_name(move.from_square)
            to_sq = chess.square_name(move.to_square)
            board.push(move)
            plies.append(
                ReplayPly(
                    ply=len(plies),
                    san=san,
                    fen=board.fen(),
                    from_square=from_sq,
                    to_square=to_sq,
                    mover=mover,
                )
            )
        return plies

    def to_replay_response(self, db: Session, game: Game) -> GameReplayResponse:
        white = db.query(User).filter(User.id == game.white_user_id).one()
        black = db.query(User).filter(User.id == game.black_user_id).one()
        return GameReplayResponse(
            id=game.id,
            fen=game.fen,
            moves=game.moves,
            status=game.status,
            result=game.result,
            termination=game.termination,
            time_control=game.time_control,
            game_mode=game.game_mode,
            rating_pool=game.rating_pool,
            white_player=GamePlayerInfo(
                id=white.id, username=white.username, rating=game.white_rating_before
            ),
            black_player=GamePlayerInfo(
                id=black.id, username=black.username, rating=game.black_rating_before
            ),
            white_rating_before=game.white_rating_before,
            black_rating_before=game.black_rating_before,
            white_rating_after=game.white_rating_after,
            black_rating_after=game.black_rating_after,
            created_at=game.created_at,
            finished_at=game.finished_at,
            plies=self.build_replay_plies(game),
        )

    def list_game_history(
        self,
        db: Session,
        user_id: str,
        *,
        group: str | None = None,
        pool: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> GameHistoryPage:
        limit = max(1, min(limit, 50))
        offset = max(0, offset)

        query = db.query(Game).filter(
            Game.status == "finished",
            Game.result.isnot(None),
            or_(Game.white_user_id == user_id, Game.black_user_id == user_id),
        )
        if group == "royale":
            query = query.filter(Game.game_mode == "royale")
        elif group == "standard":
            query = query.filter(Game.game_mode != "royale")
        if pool:
            query = query.filter(Game.rating_pool == pool)

        total = query.count()
        games = (
            query.order_by(Game.finished_at.desc().nullslast(), Game.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        user_cache: dict[str, User] = {}
        items: list[GameHistoryItem] = []

        for game in games:
            is_white = game.white_user_id == user_id
            opp_id = game.black_user_id if is_white else game.white_user_id
            if opp_id not in user_cache:
                user_cache[opp_id] = db.query(User).filter(User.id == opp_id).one()

            opponent = user_cache[opp_id]
            my_color = "white" if is_white else "black"

            if game.result == "draw":
                outcome = "draw"
            elif game.result == my_color:
                outcome = "win"
            else:
                outcome = "loss"

            move_tokens = [m for m in game.moves.split() if m and m != "…"]

            items.append(
                GameHistoryItem(
                    id=game.id,
                    game_mode=game.game_mode,
                    time_control=game.time_control,
                    rating_pool=game.rating_pool,
                    outcome=outcome,
                    opponent_username=opponent.username,
                    opponent_rating=(
                        game.black_rating_before if is_white else game.white_rating_before
                    ),
                    my_rating_before=(
                        game.white_rating_before if is_white else game.black_rating_before
                    ),
                    my_rating_after=(
                        game.white_rating_after if is_white else game.black_rating_after
                    ),
                    termination=game.termination,
                    finished_at=game.finished_at or game.created_at,
                    moves_count=len(move_tokens),
                )
            )

        return GameHistoryPage(items=items, total=total, offset=offset, limit=limit)


game_play_service = GamePlayService()
