"""Competition routes."""

from typing import Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.models.competition import (
    CompetitionCreate,
    CompetitionDetail,
    CompetitionListItem,
    CompetitionPage,
    JoinCompetitionRequest,
    JoinCompetitionResponse,
)
from app.services.competition_manager_service import competition_manager_service
from app.services.competition_service import VALID_STATUSES, competition_service
from app.services.swiss_structure_service import swiss_structure_service

router = APIRouter(prefix="/api/v1/competitions", tags=["competitions"])

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


@router.get("", response_model=CompetitionPage)
def list_competitions(
    status: Literal["upcoming", "running", "done"] = Query("upcoming"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    if status not in VALID_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status filter")
    return competition_service.list_competitions(
        db, status=status, offset=offset, limit=limit, user_id=_current_user.id
    )


@router.post("", response_model=CompetitionListItem, status_code=status.HTTP_201_CREATED)
def create_competition(
    payload: CompetitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return competition_service.create_competition(db, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/{competition_id}", response_model=CompetitionDetail)
async def get_competition(
    competition_id: str,
    invite: str | None = Query(default=None, min_length=8, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    detail = competition_service.get_competition(
        db, competition_id, current_user, invite_token=invite
    )
    comp = competition_service._get_competition(db, competition_id)
    if detail.format == "swiss" and detail.status in ("running", "done", "upcoming"):
        detail.swiss_structure = await swiss_structure_service.build(db, comp)
    if detail.status == "running" and detail.is_joined and detail.format in ("swiss", "candidates"):
        detail.pending_match = await competition_manager_service.get_pending_offer(
            competition_id, current_user.id
        )
    return detail


@router.post("/{competition_id}/join", response_model=JoinCompetitionResponse)
async def join_competition(
    competition_id: str,
    payload: JoinCompetitionRequest = Body(default_factory=JoinCompetitionRequest),
    invite: str | None = Query(default=None, min_length=8, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.notification_service import notification_service

    invite_token = payload.invite_token or invite
    detail = competition_service.join_competition(
        db, competition_id, current_user, invite_token=invite_token
    )
    await notification_service.notify_competition_joined(db, current_user.id, detail.name, competition_id)
    return JoinCompetitionResponse(competition=detail, joined=True)


@router.post("/{competition_id}/leave", response_model=CompetitionDetail)
def leave_competition(
    competition_id: str,
    invite: str | None = Query(default=None, min_length=8, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return competition_service.leave_competition(
        db, competition_id, current_user, invite_token=invite
    )


@router.patch("/{competition_id}", response_model=CompetitionDetail)
def update_competition(
    competition_id: str,
    payload: CompetitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return competition_service.update_competition(db, competition_id, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
