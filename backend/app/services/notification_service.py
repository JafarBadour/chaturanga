"""Persisted notifications with realtime WS delivery."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Competition, CompetitionParticipant, Notification
from app.models.notification import NotificationItem, NotificationPage
from app.services.realtime_events import publish_comp_refresh, publish_user

logger = logging.getLogger(__name__)


def _to_item(row: Notification) -> NotificationItem:
    return NotificationItem(
        id=row.id,
        kind=row.kind,
        title=row.title,
        body=row.body,
        link=row.link,
        read=row.read_at is not None,
        created_at=row.created_at,
    )


class NotificationService:
    async def push(
        self,
        db: Session,
        user_id: str,
        *,
        kind: str,
        title: str,
        body: str | None = None,
        link: str | None = None,
    ) -> NotificationItem:
        row = Notification(
            user_id=user_id,
            kind=kind,
            title=title,
            body=body,
            link=link,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        item = _to_item(row)
        await publish_user(user_id, {"type": "notification", "notification": item.model_dump(mode="json")})
        return item

    def schedule(self, coro) -> None:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(coro)
        except RuntimeError:
            logger.warning("No event loop — skipped async notification")

    async def notify_standings_updated_task(
        self,
        comp_id: str,
        competition_name: str,
        participant_ids: list[str],
    ) -> None:
        from app.db.database import SessionLocal

        db = SessionLocal()
        try:
            await self.notify_standings_updated(
                db,
                comp_id,
                competition_name=competition_name,
                participant_ids=participant_ids,
            )
        finally:
            db.close()

    def schedule_standings_updated(
        self,
        comp_id: str,
        competition_name: str,
        participant_ids: list[str],
    ) -> None:
        self.schedule(
            self.notify_standings_updated_task(comp_id, competition_name, participant_ids)
        )

    def list_for_user(
        self,
        db: Session,
        user_id: str,
        *,
        offset: int = 0,
        limit: int = 30,
    ) -> NotificationPage:
        limit = max(1, min(limit, 50))
        offset = max(0, offset)

        base = db.query(Notification).filter(Notification.user_id == user_id)
        total = base.count()
        unread_count = base.filter(Notification.read_at.is_(None)).count()
        rows = (
            base.order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return NotificationPage(
            items=[_to_item(row) for row in rows],
            unread_count=unread_count,
            total=total,
            offset=offset,
            limit=limit,
        )

    def mark_read(self, db: Session, user_id: str, notification_ids: list[str]) -> int:
        if not notification_ids:
            return 0
        now = datetime.utcnow()
        rows = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.id.in_(notification_ids),
                Notification.read_at.is_(None),
            )
            .all()
        )
        for row in rows:
            row.read_at = now
        db.commit()
        return len(rows)

    def mark_all_read(self, db: Session, user_id: str) -> int:
        now = datetime.utcnow()
        rows = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
            .all()
        )
        for row in rows:
            row.read_at = now
        db.commit()
        return len(rows)

    async def notify_competition_started(self, db: Session, comp: Competition) -> None:
        participants = (
            db.query(CompetitionParticipant.user_id)
            .filter(CompetitionParticipant.competition_id == comp.id)
            .all()
        )
        user_ids = [row[0] for row in participants]
        link = f"/competitions/{comp.id}"
        for user_id in user_ids:
            await self.push(
                db,
                user_id,
                kind="comp_started",
                title=f"{comp.name} has started",
                body="Your competition is now live — head over to play.",
                link=link,
            )
        await publish_comp_refresh(comp.id, "started", user_ids)

    async def notify_competition_joined(
        self, db: Session, user_id: str, competition_name: str, competition_id: str
    ) -> None:
        await self.push(
            db,
            user_id,
            kind="comp_joined",
            title=f"Joined {competition_name}",
            body="You're registered. We'll notify you when matches are ready.",
            link=f"/competitions/{competition_id}",
        )

    async def notify_match_offer(
        self,
        db: Session,
        user_id: str,
        *,
        competition_id: str,
        competition_name: str,
        opponent_username: str,
        comp_format: str = "swiss",
    ) -> None:
        if comp_format == "candidates":
            body = (
                f"You're paired vs {opponent_username}. Join within 3 minutes — "
                "if neither player joins, the pairing counts as a draw."
            )
        else:
            body = (
                f"You're paired vs {opponent_username}. Join within 3 minutes — "
                "missed pairings are rematched with colors swapped."
            )
        await self.push(
            db,
            user_id,
            kind="comp_match_offer",
            title=f"Match ready in {competition_name}",
            body=body,
            link=f"/competitions/{competition_id}",
        )

    async def notify_standings_updated(
        self,
        db: Session,
        comp_id: str,
        *,
        competition_name: str,
        participant_ids: list[str],
    ) -> None:
        link = f"/competitions/{comp_id}"
        for user_id in participant_ids:
            await self.push(
                db,
                user_id,
                kind="comp_standings",
                title=f"Standings updated — {competition_name}",
                body="Leaderboard refreshed after a finished game.",
                link=link,
            )
        await publish_comp_refresh(comp_id, "standings_updated", participant_ids)

    async def notify_comp_match_found(
        self,
        db: Session,
        user_id: str,
        *,
        competition_id: str,
        competition_name: str,
        game_id: str,
    ) -> None:
        await self.push(
            db,
            user_id,
            kind="comp_matched",
            title=f"Match found — {competition_name}",
            body="Your game is ready.",
            link=f"/game/{game_id}",
        )


notification_service = NotificationService()
