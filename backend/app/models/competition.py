"""Pydantic schemas for competitions."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

CompetitionStatus = Literal["upcoming", "running", "done"]
CompetitionFormat = Literal["swiss", "candidates", "fifm"]
GameMode = Literal["standard", "royale"]


class CompetitionListItem(BaseModel):
    id: str
    name: str
    creator_username: str
    game_mode: GameMode
    format: CompetitionFormat
    status: CompetitionStatus
    notes: Optional[str] = None
    min_rating: Optional[int] = None
    max_rating: Optional[int] = None
    is_public: bool = True
    max_participants: Optional[int] = None
    duration_minutes: Optional[int] = None
    time_control: str
    rating_pool: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime
    is_joined: bool = False


class CompetitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    game_mode: GameMode = "standard"
    format: CompetitionFormat = "swiss"
    time_control: str = Field(min_length=1, max_length=20)
    starts_at: datetime
    is_public: bool = True
    max_participants: Optional[int] = Field(default=None, ge=2, le=10000)
    min_rating: Optional[int] = Field(default=None, ge=0, le=4000)
    max_rating: Optional[int] = Field(default=None, ge=0, le=4000)
    duration_minutes: Optional[int] = Field(default=None, ge=5, le=10080)
    notes: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_competition(self) -> "CompetitionCreate":
        if self.min_rating is not None and self.max_rating is not None:
            if self.min_rating > self.max_rating:
                raise ValueError("min_rating cannot exceed max_rating")
        if self.format == "fifm" and self.duration_minutes is None:
            raise ValueError("duration_minutes is required for FIFM competitions")
        if self.format != "fifm" and self.duration_minutes is not None:
            raise ValueError("duration_minutes applies only to FIFM competitions")
        return self


class CompetitionPage(BaseModel):
    items: list[CompetitionListItem]
    total: int
    offset: int
    limit: int


class CompetitionPendingMatch(BaseModel):
    offer_id: str
    opponent_user_id: str
    opponent_username: str
    expires_at: datetime
    you_joined: bool = False
    opponent_joined: bool = False
    format: Optional[str] = None


class CompetitionParticipantEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    rating: int
    score: int
    wins: int
    losses: int
    draws: int
    games_played: int
    joined_at: datetime


class SwissPlayerChip(BaseModel):
    user_id: str
    username: str
    wins: int
    losses: int
    status: Literal["active", "advanced", "eliminated"] = "active"


class SwissMatchEntry(BaseModel):
    match_id: Optional[str] = None
    offer_id: Optional[str] = None
    white_user_id: str
    black_user_id: str
    white_username: str
    black_username: str
    status: Literal["scheduled", "joining", "active", "finished"] = "scheduled"
    result: Optional[str] = None
    record: str


class SwissRecordGroup(BaseModel):
    record: str
    wins: int
    losses: int
    tone: Literal["positive", "negative", "even"] = "even"
    matches: list[SwissMatchEntry] = Field(default_factory=list)
    players_idle: list[SwissPlayerChip] = Field(default_factory=list)


class SwissRound(BaseModel):
    round: int
    groups: list[SwissRecordGroup] = Field(default_factory=list)


class SwissStructure(BaseModel):
    advance_wins: int = 3
    eliminate_losses: int = 3
    advance_slots: Optional[int] = None
    rounds: list[SwissRound] = Field(default_factory=list)
    advanced: list[SwissPlayerChip] = Field(default_factory=list)
    eliminated: list[SwissPlayerChip] = Field(default_factory=list)


class CompetitionDetail(CompetitionListItem):
    participant_count: int
    can_join: bool
    join_block_reason: Optional[str] = None
    viewer_rating: Optional[int] = None
    viewer_rank: Optional[int] = None
    viewer_in_game: bool = False
    pending_match: Optional[CompetitionPendingMatch] = None
    viewer_invite_token: Optional[str] = None
    viewer_is_creator: bool = False
    can_edit: bool = False
    can_leave: bool = False
    leaderboard: list[CompetitionParticipantEntry] = Field(default_factory=list)
    swiss_structure: Optional[SwissStructure] = None


class JoinCompetitionRequest(BaseModel):
    invite_token: Optional[str] = None


class JoinCompetitionResponse(BaseModel):
    competition: CompetitionDetail
    joined: bool
