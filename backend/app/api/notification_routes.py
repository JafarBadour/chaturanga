"""Notification REST routes."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.models.notification import MarkNotificationsReadRequest, NotificationPage
from app.services.notification_service import notification_service

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage)
def list_notifications(
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_service.list_for_user(db, current_user.id, offset=offset, limit=limit)


@router.post("/read")
def mark_notifications_read(
    payload: MarkNotificationsReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = notification_service.mark_read(db, current_user.id, payload.notification_ids)
    page = notification_service.list_for_user(db, current_user.id, limit=30)
    return {"updated": updated, "unread_count": page.unread_count}


@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = notification_service.mark_all_read(db, current_user.id)
    return {"updated": updated, "unread_count": 0}
