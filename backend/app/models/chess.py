"""
Pydantic models for chess-related data structures.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class MoveAnalysis(BaseModel):
    """Model for individual move analysis"""
    move: str = Field(..., description="Move in algebraic notation")
    white_advantage: Optional[float] = Field(None, description="White's advantage in pawns")
    is_mate: bool = Field(False, description="Whether this move leads to mate")
    mate_in: Optional[int] = Field(None, description="Number of moves to mate")
    best_response: Optional[str] = Field(None, description="Best response to this move")
    depth_reached: Optional[int] = Field(None, description="Search depth reached")
    nodes_searched: Optional[int] = Field(None, description="Number of nodes searched")


class StateStringRequest(BaseModel):
    """Request model for state string analysis"""
    state_string: str = Field(..., description="Chess position in format 'turn::fen::arrows'")
    time_limit: Optional[float] = Field(1.0, ge=0.1, le=10.0, description="Analysis time in seconds")
    
    @validator('state_string')
    def validate_state_string(cls, v):
        """Validate state string format"""
        if not v or not isinstance(v, str):
            raise ValueError("State string must be a non-empty string")
        
        parts = v.split("::")
        if len(parts) < 2:
            raise ValueError("State string must contain at least turn and FEN separated by ::")
        
        turn = parts[0].strip()
        if turn not in ["white", "black"]:
            raise ValueError("Turn must be 'white' or 'black'")
        
        return v


class AnalysisResponse(BaseModel):
    """Response model for complete board analysis"""
    fen: str = Field(..., description="FEN notation of the position")
    turn: str = Field(..., description="Whose turn it is")
    total_moves: int = Field(..., description="Total number of legal moves")
    moves: List[MoveAnalysis] = Field(..., description="List of all possible moves with analysis")
    best_move: Optional[str] = Field(None, description="Best move in algebraic notation")
    advantage: Optional[float] = Field(None, description="White's advantage in pawns")
    is_mate: bool = Field(False, description="Whether the position is checkmate")
    mate_in: Optional[int] = Field(None, description="Number of moves to mate")
    principal_variation: List[str] = Field(default_factory=list, description="Best continuation of moves")


class BestMoveResponse(BaseModel):
    """Response model for best move analysis"""
    best_move: str = Field(..., description="Best move in algebraic notation")
    advantage: Optional[float] = Field(None, description="White's advantage in pawns")
    is_mate: bool = Field(False, description="Whether the position is checkmate")
    mate_in: Optional[int] = Field(None, description="Number of moves to mate")
    depth_reached: Optional[int] = Field(None, description="Search depth reached")
    nodes_searched: Optional[int] = Field(None, description="Number of nodes searched")
    principal_variation: List[str] = Field(default_factory=list, description="Best continuation of moves")


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str = Field(..., description="Health status")
    engine: Optional[str] = Field(None, description="Chess engine status")
    error: Optional[str] = Field(None, description="Error message if unhealthy")


class APIInfoResponse(BaseModel):
    """Response model for API information"""
    message: str = Field(..., description="API message")
    version: str = Field(..., description="API version")
    endpoints: Dict[str, str] = Field(..., description="Available endpoints")


class ErrorResponse(BaseModel):
    """Response model for errors"""
    detail: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    timestamp: Optional[str] = Field(None, description="Error timestamp")
