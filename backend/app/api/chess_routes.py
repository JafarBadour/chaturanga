"""
API routes for chess analysis endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from app.models.chess import (
    StateStringRequest,
    AnalysisResponse,
    BestMoveResponse,
    HealthResponse,
    APIInfoResponse
)
from app.services.chess_service import chess_service
from app.core.config import settings

# Create router
router = APIRouter(prefix="/api/v1", tags=["chess"])


@router.get("/", response_model=APIInfoResponse)
async def get_api_info():
    """Get API information and available endpoints"""
    return APIInfoResponse(
        message=settings.app_name,
        version=settings.app_version,
        endpoints={
            "/api/v1/analyze": "POST - Complete board analysis with all moves",
            "/api/v1/best-move": "POST - Get best move only",
            "/api/v1/health": "GET - Health check"
        }
    )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    health_data = chess_service.health_check()
    return HealthResponse(**health_data)


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_position(request: StateStringRequest):
    """
    Analyze a chess position and return all possible moves with their advantages.
    
    This endpoint provides complete analysis including:
    - All legal moves with their evaluations
    - Best move recommendation
    - Position advantage
    - Mate information if applicable
    - Principal variation
    """
    try:
        return chess_service.analyze_position(
            state_string=request.state_string,
            time_limit=request.time_limit
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/best-move", response_model=BestMoveResponse)
async def get_best_move(request: StateStringRequest):
    """
    Get the best move for a chess position.
    
    This endpoint provides:
    - Best move recommendation
    - Position advantage
    - Mate information if applicable
    - Search depth and nodes
    - Principal variation
    """
    try:
        return chess_service.get_best_move(
            state_string=request.state_string,
            time_limit=request.time_limit
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# Legacy endpoints for backward compatibility
@router.get("/legacy/", response_model=APIInfoResponse)
async def legacy_root():
    """Legacy root endpoint"""
    return APIInfoResponse(
        message=settings.app_name,
        version=settings.app_version,
        endpoints={
            "/analyze": "POST - Complete board analysis with all moves",
            "/best-move": "POST - Get best move only",
            "/health": "GET - Health check"
        }
    )


@router.get("/legacy/health", response_model=HealthResponse)
async def legacy_health_check():
    """Legacy health check endpoint"""
    health_data = chess_service.health_check()
    return HealthResponse(**health_data)


@router.post("/legacy/analyze", response_model=AnalysisResponse)
async def legacy_analyze_position(request: StateStringRequest):
    """Legacy analyze endpoint"""
    try:
        return chess_service.analyze_position(
            state_string=request.state_string,
            time_limit=request.time_limit
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.post("/legacy/best-move", response_model=BestMoveResponse)
async def legacy_get_best_move(request: StateStringRequest):
    """Legacy best move endpoint"""
    try:
        return chess_service.get_best_move(
            state_string=request.state_string,
            time_limit=request.time_limit
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
