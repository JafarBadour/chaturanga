"""Direct challenge links — create a game invite and share with another player."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Game, GameChallenge, User
from app.models.game import (
    ChallengeAcceptResponse,
    ChallengeCreateRequest,
    ChallengeCreatedResponse,
    ChallengePreview,
)
from app.services.realtime_events import publish_casual_match, publish_user
from app.utils.rating_pools import get_rating_pool, get_user_rating
from app.utils.time_control import parse_time_control_config

CHALLENGE_TTL_HOURS = 24


class ChallengeService:
    def _expire_if_needed(self, challenge: GameChallenge) -> None:
        if challenge.status == "open" and challenge.expires_at <= datetime.utcnow():
            challenge.status = "expired"

    def _format_time_control_label(self, time_control: str, game_mode: str) -> str:
        if game_mode == "royale" and time_control.startswith("royale/"):
            return f"Royale · {time_control.replace('royale/', '')}s / move"
        return time_control

    async def create_challenge(
        self,
        db: Session,
        user: User,
        payload: ChallengeCreateRequest,
    ) -> ChallengeCreatedResponse:
        config = parse_time_control_config(payload.time_control)
        if config.mode == "royale" and payload.game_mode != "royale":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Royale time control requires royale mode")
        if config.mode == "standard" and payload.game_mode != "standard":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Standard time control requires standard mode")

        open_challenges = (
            db.query(GameChallenge)
            .filter(
                GameChallenge.creator_id == user.id,
                GameChallenge.status == "open",
            )
            .all()
        )
        for row in open_challenges:
            row.status = "cancelled"

        now = datetime.utcnow()
        token = secrets.token_urlsafe(16)
        challenge = GameChallenge(
            token=token,
            creator_id=user.id,
            time_control=payload.time_control,
            game_mode=config.mode,
            status="open",
            created_at=now,
            expires_at=now + timedelta(hours=CHALLENGE_TTL_HOURS),
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)

        link = f"/challenge/{token}"
        recipient_username = (payload.recipient_username or "").strip()
        if recipient_username:
            recipient = (
                db.query(User)
                .filter(User.username.ilike(recipient_username))
                .first()
            )
            if recipient is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
            if recipient.id == user.id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot challenge yourself")
            from app.services.notification_service import notification_service

            label = self._format_time_control_label(payload.time_control, config.mode)
            await notification_service.push(
                db,
                recipient.id,
                kind="game_challenge",
                title=f"{user.username} challenged you",
                body=f"{label} — tap to accept",
                link=link,
            )

        return ChallengeCreatedResponse(
            token=token,
            link=link,
            time_control=payload.time_control,
            game_mode=config.mode,
            expires_at=challenge.expires_at,
        )

    def get_challenge_preview(
        self, db: Session, token: str, viewer: User
    ) -> ChallengePreview:
        challenge = (
            db.query(GameChallenge)
            .filter(GameChallenge.token == token)
            .first()
        )
        if challenge is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Challenge not found")

        self._expire_if_needed(challenge)
        if challenge.status == "open" and challenge.expires_at <= datetime.utcnow():
            challenge.status = "expired"
            db.commit()

        creator = db.query(User).filter(User.id == challenge.creator_id).one()
        is_creator = viewer.id == challenge.creator_id
        can_accept = (
            challenge.status == "open"
            and not is_creator
            and challenge.expires_at > datetime.utcnow()
        )

        return ChallengePreview(
            token=challenge.token,
            creator_username=creator.username,
            time_control=challenge.time_control,
            game_mode=challenge.game_mode,
            status=challenge.status,
            expires_at=challenge.expires_at,
            is_creator=is_creator,
            can_accept=can_accept,
            game_id=challenge.game_id,
        )

    async def accept_challenge(
        self, db: Session, token: str, user: User
    ) -> ChallengeAcceptResponse:
        challenge = (
            db.query(GameChallenge)
            .filter(GameChallenge.token == token)
            .first()
        )
        if challenge is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Challenge not found")

        self._expire_if_needed(challenge)
        if challenge.status != "open":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Challenge is no longer available")
        if challenge.expires_at <= datetime.utcnow():
            challenge.status = "expired"
            db.commit()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Challenge expired")
        if challenge.creator_id == user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot accept your own challenge")

        creator = db.query(User).filter(User.id == challenge.creator_id).one()
        game = self._create_game(db, creator, user, challenge.time_control, challenge.game_mode)

        challenge.status = "accepted"
        challenge.opponent_id = user.id
        challenge.game_id = game.id
        db.commit()

        await publish_casual_match([creator.id, user.id], game.id)
        await publish_user(
            creator.id,
            {
                "type": "challenge_accepted",
                "game_id": game.id,
                "token": token,
                "opponent_username": user.username,
            },
        )
        await publish_user(
            user.id,
            {
                "type": "challenge_accepted",
                "game_id": game.id,
                "token": token,
                "opponent_username": creator.username,
            },
        )

        return ChallengeAcceptResponse(game_id=game.id)

    def _create_game(
        self,
        db: Session,
        creator: User,
        opponent: User,
        time_control: str,
        game_mode: str,
    ) -> Game:
        config = parse_time_control_config(time_control)
        pool = get_rating_pool(time_control, game_mode)
        creator_rating = get_user_rating(db, creator, pool)
        opponent_rating = get_user_rating(db, opponent, pool)

        if creator_rating >= opponent_rating:
            white, black = creator, opponent
            white_rating, black_rating = creator_rating, opponent_rating
        else:
            white, black = opponent, creator
            white_rating, black_rating = opponent_rating, creator_rating

        game_kwargs = dict(
            white_user_id=white.id,
            black_user_id=black.id,
            time_control=time_control,
            game_mode=game_mode,
            rating_pool=pool,
            white_rating_before=white_rating,
            black_rating_before=black_rating,
            status="active",
        )

        if game_mode == "royale":
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


challenge_service = ChallengeService()
