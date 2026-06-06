"""Pydantic schemas for user notifications."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationItem(BaseModel):
    id: str
    kind: str
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    read: bool = False
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationItem]
    unread_count: int
    total: int
    offset: int
    limit: int


class MarkNotificationsReadRequest(BaseModel):
    notification_ids: list[str] = Field(default_factory=list)
