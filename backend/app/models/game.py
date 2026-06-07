"""Pydantic schemas for online games."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ActiveGameSummary(BaseModel):
    game_id: str
    opponent_username: str
    opponent_rating: int
    time_control: str
    game_mode: str
    my_color: str


class SeekRequest(BaseModel):
    time_control: str = Field(
        default="5+0",
        pattern=r"^(royale/\d+(?:\.\d+)?|\d+(?:\.\d+)?\+\d+(?:\.\d+)?)$",
    )


class SeekResponse(BaseModel):
    status: Literal["waiting", "matched"]
    game_id: Optional[str] = None
    message: str = ""


class ChallengeCreateRequest(BaseModel):
    time_control: str = Field(
        default="5+0",
        pattern=r"^(royale/\d+(?:\.\d+)?|\d+(?:\.\d+)?\+\d+(?:\.\d+)?)$",
    )
    game_mode: Literal["standard", "royale"] = "standard"
    recipient_username: Optional[str] = Field(default=None, max_length=50)


class ChallengeCreatedResponse(BaseModel):
    token: str
    link: str
    time_control: str
    game_mode: str
    expires_at: datetime


class ChallengePreview(BaseModel):
    token: str
    creator_username: str
    time_control: str
    game_mode: str
    status: str
    expires_at: datetime
    is_creator: bool
    can_accept: bool
    game_id: Optional[str] = None


class ChallengeAcceptResponse(BaseModel):
    game_id: str


class GamePlayerInfo(BaseModel):
    id: str
    username: str
    rating: int


class StrikeEvent(BaseModel):
    color: str
    strikes: int


class DrawOfferInfo(BaseModel):
    user_id: str
    color: Literal["white", "black"]


class ReplayPly(BaseModel):
    ply: int
    san: Optional[str] = None
    fen: str
    from_square: Optional[str] = None
    to_square: Optional[str] = None
    mover: Optional[Literal["white", "black"]] = None


class GameReplayResponse(BaseModel):
    id: str
    fen: str
    moves: str
    status: str
    result: Optional[str] = None
    termination: Optional[str] = None
    time_control: str
    game_mode: str
    rating_pool: str
    white_player: GamePlayerInfo
    black_player: GamePlayerInfo
    white_rating_before: int
    black_rating_before: int
    white_rating_after: Optional[int] = None
    black_rating_after: Optional[int] = None
    created_at: datetime
    finished_at: Optional[datetime] = None
    plies: list[ReplayPly]


class GameHistoryItem(BaseModel):
    id: str
    game_mode: str
    time_control: str
    rating_pool: str
    outcome: Literal["win", "loss", "draw"]
    opponent_username: str
    opponent_rating: int
    my_rating_before: int
    my_rating_after: Optional[int] = None
    termination: Optional[str] = None
    finished_at: datetime
    moves_count: int


class GameHistoryPage(BaseModel):
    items: list[GameHistoryItem]
    total: int
    offset: int
    limit: int


class GameResponse(BaseModel):
    id: str
    fen: str
    time_control: str
    game_mode: str = "standard"
    move_limit_ms: Optional[int] = None
    white_strikes: int = 0
    black_strikes: int = 0
    initial_time_ms: int
    increment_ms: int
    white_time_ms: int
    black_time_ms: int
    status: str
    result: Optional[str] = None
    termination: Optional[str] = None
    rating_pool: str = "blitz"
    moves: str
    white_player: GamePlayerInfo
    black_player: GamePlayerInfo
    white_rating_before: int
    black_rating_before: int
    white_rating_after: Optional[int] = None
    black_rating_after: Optional[int] = None
    created_at: datetime
    finished_at: Optional[datetime] = None
    last_move_at: Optional[datetime] = None
    competition_id: Optional[str] = None
    competition_format: Optional[str] = None
    in_check: bool = False
    is_checkmate: bool = False
    is_stalemate: bool = False
    active_color: Literal["white", "black"] = "white"
    draw_offer: Optional[DrawOfferInfo] = None
    last_move_from: Optional[str] = None
    last_move_to: Optional[str] = None

    class Config:
        from_attributes = True


class MoveRequest(BaseModel):
    from_square: str = Field(alias="from")
    to_square: str = Field(alias="to")
    promotion: Optional[str] = None

    class Config:
        populate_by_name = True


class ResignRequest(BaseModel):
    pass
