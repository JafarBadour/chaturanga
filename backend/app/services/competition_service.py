"""Competition listing, creation, join, and status sync."""

import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.db.models import Competition, CompetitionParticipant, Game, User
from app.db.ordering import nulls_last_col
from app.models.competition import (
    CompetitionCreate,
    CompetitionDetail,
    CompetitionListItem,
    CompetitionPage,
    CompetitionParticipantEntry,
)
from app.utils.rating_pools import get_rating_pool, get_user_rating
from app.utils.time_control import parse_time_control_config

VALID_STATUSES = frozenset({"upcoming", "running", "done"})
VALID_FORMATS = frozenset({"swiss", "candidates", "fifm"})
VALID_MODES = frozenset({"standard", "royale"})
LOCKED_WHEN_RUNNING = frozenset({"swiss", "candidates"})


def _to_item(comp: Competition, *, is_joined: bool = False) -> CompetitionListItem:
    return CompetitionListItem(
        id=comp.id,
        name=comp.name,
        creator_username=comp.created_by.username if comp.created_by else "—",
        game_mode=comp.game_mode,
        format=comp.format,
        status=comp.status,
        notes=comp.notes,
        min_rating=comp.min_rating,
        max_rating=comp.max_rating,
        is_public=comp.is_public,
        max_participants=comp.max_participants,
        duration_minutes=comp.duration_minutes,
        time_control=comp.time_control,
        rating_pool=comp.rating_pool,
        starts_at=comp.starts_at,
        ends_at=comp.ends_at,
        created_at=comp.created_at,
        is_joined=is_joined,
    )


class CompetitionService:
    def sync_statuses(self, db: Session) -> list[Competition]:
        now = datetime.utcnow()
        newly_running: list[Competition] = []
        upcoming = (
            db.query(Competition)
            .filter(Competition.status == "upcoming", Competition.starts_at.isnot(None))
            .filter(Competition.starts_at <= now)
            .all()
        )
        for comp in upcoming:
            comp.status = "running"
            newly_running.append(comp)

        running = (
            db.query(Competition)
            .filter(Competition.status == "running", Competition.ends_at.isnot(None))
            .filter(Competition.ends_at <= now)
            .all()
        )
        for comp in running:
            comp.status = "done"

        if upcoming or running:
            db.commit()

        return newly_running

    def _get_competition(
        self, db: Session, competition_id: str, *, sync: bool = True
    ) -> Competition:
        if sync:
            self.sync_statuses(db)
        comp = (
            db.query(Competition)
            .options(
                joinedload(Competition.created_by),
                joinedload(Competition.participants).joinedload(CompetitionParticipant.user),
            )
            .filter(Competition.id == competition_id)
            .first()
        )
        if comp is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")
        return comp

    def _participant_count(self, comp: Competition) -> int:
        return len(comp.participants)

    def _is_joined(self, comp: Competition, user_id: str) -> bool:
        return any(p.user_id == user_id for p in comp.participants)

    def _has_invite_access(self, comp: Competition, invite_token: str | None) -> bool:
        if comp.is_public or not comp.invite_token or not invite_token:
            return False
        return secrets.compare_digest(invite_token, comp.invite_token)

    def _can_view(
        self,
        comp: Competition,
        user: User,
        *,
        invite_token: str | None = None,
    ) -> bool:
        if comp.is_public:
            return True
        if comp.created_by_id == user.id:
            return True
        if self._is_joined(comp, user.id):
            return True
        return self._has_invite_access(comp, invite_token)

    def _join_eligibility(
        self, comp: Competition, user: User, db: Session, *, invite_token: str | None = None
    ) -> tuple[bool, str | None, int]:
        viewer_rating = get_user_rating(db, user, comp.rating_pool)

        if self._is_joined(comp, user.id):
            return False, "Already joined", viewer_rating

        if comp.status == "done":
            return False, "Competition has ended", viewer_rating

        if comp.format in LOCKED_WHEN_RUNNING and comp.status == "running":
            return False, "Registration closed — Swiss and Candidates lock when running", viewer_rating

        if not comp.is_public:
            if comp.created_by_id == user.id:
                pass
            elif self._has_invite_access(comp, invite_token):
                pass
            else:
                return False, "Private competition — invite link required", viewer_rating

        if comp.min_rating is not None and viewer_rating < comp.min_rating:
            return False, f"Rating too low (min {comp.min_rating})", viewer_rating

        if comp.max_rating is not None and viewer_rating > comp.max_rating:
            return False, f"Rating too high (max {comp.max_rating})", viewer_rating

        count = self._participant_count(comp)
        if comp.max_participants is not None and count >= comp.max_participants:
            return False, "Competition is full", viewer_rating

        return True, None, viewer_rating

    def _leaderboard_entries(
        self, comp: Competition, db: Session
    ) -> list[CompetitionParticipantEntry]:
        rows = []
        for p in comp.participants:
            rating = get_user_rating(db, p.user, comp.rating_pool) if p.user else 1500
            rows.append(
                {
                    "participant": p,
                    "username": p.user.username if p.user else "—",
                    "rating": rating,
                    "score": p.score,
                    "wins": p.wins,
                    "losses": p.losses,
                    "draws": p.draws,
                    "games_played": p.games_played,
                }
            )

        rows.sort(
            key=lambda row: (
                -row["score"],
                -row["wins"],
                -row["rating"],
                row["username"].lower(),
            )
        )

        entries = []
        for index, row in enumerate(rows):
            p = row["participant"]
            entries.append(
                CompetitionParticipantEntry(
                    rank=index + 1,
                    user_id=p.user_id,
                    username=row["username"],
                    rating=row["rating"],
                    score=row["score"],
                    wins=row["wins"],
                    losses=row["losses"],
                    draws=row["draws"],
                    games_played=row["games_played"],
                    joined_at=p.joined_at,
                )
            )
        return entries

    def _viewer_in_game(self, db: Session, comp_id: str, user_id: str) -> bool:
        return (
            db.query(Game.id)
            .filter(
                Game.competition_id == comp_id,
                Game.status == "active",
                ((Game.white_user_id == user_id) | (Game.black_user_id == user_id)),
            )
            .first()
            is not None
        )

    def _can_edit(self, comp: Competition) -> bool:
        if comp.status != "upcoming":
            return False
        now = datetime.utcnow()
        if comp.starts_at is not None and comp.starts_at <= now:
            return False
        return True

    def _validate_competition_payload(self, payload: CompetitionCreate) -> None:
        config = parse_time_control_config(payload.time_control)
        mode = payload.game_mode
        if config.mode == "royale" and mode != "royale":
            raise ValueError("Royale time controls require game_mode royale")
        if config.mode == "standard" and mode != "standard":
            raise ValueError("Standard time controls require game_mode standard")

    def _starts_at_naive(self, starts_at: datetime) -> datetime:
        return starts_at.replace(tzinfo=None) if starts_at.tzinfo else starts_at

    def _to_detail(
        self,
        comp: Competition,
        user: User,
        db: Session,
        *,
        invite_token: str | None = None,
    ) -> CompetitionDetail:
        is_joined = self._is_joined(comp, user.id)
        can_join, block_reason, viewer_rating = self._join_eligibility(
            comp, user, db, invite_token=invite_token
        )
        if is_joined:
            can_join = False
            block_reason = None

        leaderboard = self._leaderboard_entries(comp, db)
        viewer_rank = None
        if is_joined:
            for entry in leaderboard:
                if entry.user_id == user.id:
                    viewer_rank = entry.rank
                    break

        base = _to_item(comp, is_joined=is_joined)
        viewer_in_game = False
        if is_joined and comp.status == "running":
            viewer_in_game = self._viewer_in_game(db, comp.id, user.id)

        viewer_invite_token = None
        if not comp.is_public and comp.created_by_id == user.id and comp.invite_token:
            viewer_invite_token = comp.invite_token

        viewer_is_creator = comp.created_by_id == user.id
        can_edit = viewer_is_creator and self._can_edit(comp)
        can_leave = is_joined and comp.status == "upcoming"

        return CompetitionDetail(
            **base.model_dump(),
            participant_count=self._participant_count(comp),
            can_join=can_join,
            join_block_reason=block_reason,
            viewer_rating=viewer_rating,
            viewer_rank=viewer_rank,
            viewer_in_game=viewer_in_game,
            viewer_invite_token=viewer_invite_token,
            viewer_is_creator=viewer_is_creator,
            can_edit=can_edit,
            can_leave=can_leave,
            leaderboard=leaderboard,
        )

    def leave_competition(
        self,
        db: Session,
        competition_id: str,
        user: User,
        *,
        invite_token: str | None = None,
    ) -> CompetitionDetail:
        comp = self._get_competition(db, competition_id)
        if not self._can_view(comp, user, invite_token=invite_token):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")

        if comp.status != "upcoming":
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "You can only leave before the competition starts",
            )

        if not self._is_joined(comp, user.id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You are not in this competition")

        participant = (
            db.query(CompetitionParticipant)
            .filter(
                CompetitionParticipant.competition_id == comp.id,
                CompetitionParticipant.user_id == user.id,
            )
            .first()
        )
        if participant is not None:
            db.delete(participant)
            db.commit()

        comp = self._get_competition(db, competition_id, sync=False)
        return self._to_detail(comp, user, db, invite_token=invite_token)

    def get_competition(
        self,
        db: Session,
        competition_id: str,
        user: User,
        *,
        invite_token: str | None = None,
    ) -> CompetitionDetail:
        comp = self._get_competition(db, competition_id)
        if not self._can_view(comp, user, invite_token=invite_token):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")
        return self._to_detail(comp, user, db, invite_token=invite_token)

    def join_competition(
        self,
        db: Session,
        competition_id: str,
        user: User,
        *,
        invite_token: str | None = None,
    ) -> CompetitionDetail:
        comp = self._get_competition(db, competition_id)
        if not self._can_view(comp, user, invite_token=invite_token):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Competition not found")

        can_join, block_reason, _viewer_rating = self._join_eligibility(
            comp, user, db, invite_token=invite_token
        )
        if not can_join:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, block_reason or "Cannot join")

        participant = CompetitionParticipant(competition_id=comp.id, user_id=user.id)
        db.add(participant)
        db.commit()

        comp = self._get_competition(db, competition_id, sync=False)
        return self._to_detail(comp, user, db, invite_token=invite_token)

    def list_competitions(
        self,
        db: Session,
        *,
        status: str,
        offset: int = 0,
        limit: int = 20,
        user_id: str | None = None,
    ) -> CompetitionPage:
        self.sync_statuses(db)

        limit = max(1, min(limit, 50))
        offset = max(0, offset)

        query = (
            db.query(Competition)
            .options(joinedload(Competition.created_by))
            .filter(Competition.status == status)
        )
        if user_id:
            participant_comp_ids = (
                db.query(CompetitionParticipant.competition_id)
                .filter(CompetitionParticipant.user_id == user_id)
                .subquery()
            )
            query = query.filter(
                or_(
                    Competition.is_public.is_(True),
                    Competition.created_by_id == user_id,
                    Competition.id.in_(participant_comp_ids),
                )
            )
        else:
            query = query.filter(Competition.is_public.is_(True))

        total = query.count()
        if status == "done":
            order = (
                *nulls_last_col(Competition.ends_at, asc=False),
                Competition.created_at.desc(),
            )
        else:
            order = (
                *nulls_last_col(Competition.starts_at, asc=True),
                Competition.created_at.desc(),
            )
        rows = query.order_by(*order).offset(offset).limit(limit).all()

        joined_ids: set[str] = set()
        if user_id and rows:
            comp_ids = [comp.id for comp in rows]
            joined_ids = {
                row[0]
                for row in db.query(CompetitionParticipant.competition_id)
                .filter(
                    CompetitionParticipant.user_id == user_id,
                    CompetitionParticipant.competition_id.in_(comp_ids),
                )
                .all()
            }

        return CompetitionPage(
            items=[_to_item(row, is_joined=row.id in joined_ids) for row in rows],
            total=total,
            offset=offset,
            limit=limit,
        )

    def create_competition(
        self,
        db: Session,
        user: User,
        payload: CompetitionCreate,
    ) -> CompetitionListItem:
        self._validate_competition_payload(payload)

        rating_pool = get_rating_pool(payload.time_control, payload.game_mode)
        now = datetime.utcnow()
        starts_at = self._starts_at_naive(payload.starts_at)
        if starts_at <= now:
            raise ValueError("Start time must be in the future")

        ends_at = None
        if payload.format == "fifm" and payload.duration_minutes:
            ends_at = starts_at + timedelta(minutes=payload.duration_minutes)

        invite_token = None if payload.is_public else secrets.token_urlsafe(24)

        comp = Competition(
            name=payload.name.strip(),
            created_by_id=user.id,
            game_mode=payload.game_mode,
            format=payload.format,
            status="upcoming",
            notes=payload.notes.strip() if payload.notes else None,
            min_rating=payload.min_rating,
            max_rating=payload.max_rating,
            is_public=payload.is_public,
            invite_token=invite_token,
            max_participants=payload.max_participants,
            duration_minutes=payload.duration_minutes,
            time_control=payload.time_control,
            rating_pool=rating_pool,
            starts_at=starts_at,
            ends_at=ends_at,
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)
        comp = (
            db.query(Competition)
            .options(joinedload(Competition.created_by))
            .filter(Competition.id == comp.id)
            .one()
        )
        return _to_item(comp)

    def update_competition(
        self,
        db: Session,
        competition_id: str,
        user: User,
        payload: CompetitionCreate,
    ) -> CompetitionDetail:
        comp = self._get_competition(db, competition_id, sync=True)

        if comp.created_by_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator can edit this competition")

        if not self._can_edit(comp):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cannot edit — competition has already started or ended",
            )

        self._validate_competition_payload(payload)

        now = datetime.utcnow()
        starts_at = self._starts_at_naive(payload.starts_at)
        if starts_at <= now:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Start time must be in the future")

        participant_count = self._participant_count(comp)
        if payload.max_participants is not None and participant_count > payload.max_participants:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Max participants cannot be below current count ({participant_count})",
            )

        rating_pool = get_rating_pool(payload.time_control, payload.game_mode)
        ends_at = None
        if payload.format == "fifm" and payload.duration_minutes:
            ends_at = starts_at + timedelta(minutes=payload.duration_minutes)

        if payload.is_public:
            comp.invite_token = None
        elif not comp.invite_token:
            comp.invite_token = secrets.token_urlsafe(24)

        comp.name = payload.name.strip()
        comp.game_mode = payload.game_mode
        comp.format = payload.format
        comp.notes = payload.notes.strip() if payload.notes else None
        comp.min_rating = payload.min_rating
        comp.max_rating = payload.max_rating
        comp.is_public = payload.is_public
        comp.max_participants = payload.max_participants
        comp.duration_minutes = payload.duration_minutes if payload.format == "fifm" else None
        comp.time_control = payload.time_control
        comp.rating_pool = rating_pool
        comp.starts_at = starts_at
        comp.ends_at = ends_at
        comp.status = "upcoming"

        db.commit()
        comp = self._get_competition(db, competition_id, sync=False)
        return self._to_detail(comp, user, db)


competition_service = CompetitionService()
