"""Game and matchmaking REST routes."""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.models.game import (
    ActiveGameSummary,
    ChallengeAcceptResponse,
    ChallengeCreateRequest,
    ChallengeCreatedResponse,
    ChallengePreview,
    GameHistoryPage,
    GameReplayResponse,
    GameResponse,
    SeekRequest,
    SeekResponse,
)
from app.services.challenge_service import challenge_service
from app.services.game_play_service import game_play_service
from app.services.matchmaking_service import matchmaking_service
from app.utils.draw_offers import get_draw_offer
from app.utils.rating_pools import is_valid_pool

router = APIRouter(prefix="/api/v1/games", tags=["games"])


@router.post("/seek", response_model=SeekResponse)
async def seek_game(
    data: SeekRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    game_id = await matchmaking_service.join_queue(db, current_user, data.time_control)
    if game_id:
        return SeekResponse(status="matched", game_id=game_id, message="Opponent found!")
    return SeekResponse(status="waiting", message="Searching for opponent...")


@router.delete("/seek")
async def cancel_seek(current_user: User = Depends(get_current_user)):
    await matchmaking_service.leave_queue(current_user.id)
    return {"status": "cancelled"}


@router.post("/challenges", response_model=ChallengeCreatedResponse)
async def create_challenge(
    payload: ChallengeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await challenge_service.create_challenge(db, current_user, payload)


@router.get("/challenges/{token}", response_model=ChallengePreview)
def get_challenge(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return challenge_service.get_challenge_preview(db, token, current_user)


@router.post("/challenges/{token}/accept", response_model=ChallengeAcceptResponse)
async def accept_challenge(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await challenge_service.accept_challenge(db, token, current_user)


@router.get("/active", response_model=list[ActiveGameSummary])
def list_active_games(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return game_play_service.get_active_games(db, current_user.id)


@router.get("/history", response_model=GameHistoryPage)
def list_game_history(
    group: Optional[Literal["standard", "royale"]] = Query(None),
    pool: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if pool and not is_valid_pool(pool):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid rating pool")
    return game_play_service.list_game_history(
        db,
        current_user.id,
        group=group,
        pool=pool,
        offset=offset,
        limit=limit,
    )


@router.get("/{game_id}/replay", response_model=GameReplayResponse)
def get_game_replay(
    game_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    game = game_play_service.get_game(db, game_id)
    if game.status != "finished":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Game is not finished")
    return game_play_service.to_replay_response(db, game)


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    game = game_play_service.get_game(db, game_id)
    game_play_service.ensure_participant(game, current_user.id)
    if game.game_mode != "royale":
        game = game_play_service.sync_standard_clock_state(db, game)
    else:
        game = game_play_service.resolve_terminal_state(db, game)
    offer = await get_draw_offer(game_id)
    return game_play_service.to_response(db, game, draw_offer=offer)
