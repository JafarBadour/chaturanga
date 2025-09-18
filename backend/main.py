from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import chess
import chess.engine
import os
import sys
from chess_scoring import ChessAnalyzer

app = FastAPI(
    title="Chess Analysis API",
    description="API for analyzing chess positions using Stockfish engine",
    version="1.0.0"
)

# Global analyzer instance
analyzer = None

class StateStringRequest(BaseModel):
    state_string: str
    time_limit: Optional[float] = 1.0

class AnalysisResponse(BaseModel):
    fen: str
    turn: str
    total_moves: int
    moves: list
    best_move: Optional[str] = None
    advantage: Optional[float] = None
    is_mate: bool = False
    mate_in: Optional[int] = None
    principal_variation: list = []

class BestMoveResponse(BaseModel):
    best_move: str
    advantage: Optional[float] = None
    is_mate: bool = False
    mate_in: Optional[int] = None
    depth_reached: Optional[int] = None
    nodes_searched: Optional[int] = None
    principal_variation: list = []

def parse_state_string(state_string: str) -> tuple:
    """
    Parse state string in format "turn::fen::arrows"
    Returns (turn, fen, arrows)
    """
    parts = state_string.split("::")
    if len(parts) < 2:
        raise ValueError("State string must contain at least turn and FEN separated by ::")
    
    turn = parts[0].strip()
    fen = parts[1].strip()
    arrows = parts[2].strip() if len(parts) > 2 else ""
    
    # Validate turn
    if turn not in ["white", "black"]:
        raise ValueError("Turn must be 'white' or 'black'")
    
    return turn, fen, arrows

def get_analyzer():
    """Get or create the global analyzer instance"""
    global analyzer
    if analyzer is None:
        # Try to find Stockfish in common locations
        stockfish_paths = [
            "./stockfish",
            "/usr/local/bin/stockfish",
            "/usr/bin/stockfish",
            "stockfish"  # If it's in PATH
        ]
        
        stockfish_path = None
        for path in stockfish_paths:
            if os.path.exists(path) or path == "stockfish":
                stockfish_path = path
                break
        
        if stockfish_path is None:
            raise HTTPException(
                status_code=500, 
                detail="Stockfish engine not found. Please install Stockfish and ensure it's in your PATH or current directory."
            )
        
        analyzer = ChessAnalyzer(
            engine_path=stockfish_path,
            default_time=1.0,
            show_raw_score=False,
            show_best_move=False,
            show_variation=False,
            show_depth=False,
            show_nodes=False
        )
        analyzer.start_engine()
    
    return analyzer

@app.on_event("startup")
async def startup_event():
    """Initialize the chess analyzer on startup"""
    try:
        get_analyzer()
        print("✅ Chess analyzer initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize chess analyzer: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up the chess analyzer on shutdown"""
    global analyzer
    if analyzer:
        analyzer.quit_engine()
        print("🔚 Chess analyzer closed")

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Chess Analysis API",
        "version": "1.0.0",
        "endpoints": {
            "/analyze": "POST - Complete board analysis with all moves",
            "/best-move": "POST - Get best move only",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        analyzer = get_analyzer()
        return {"status": "healthy", "engine": "stockfish"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_position(request: StateStringRequest):
    """
    Analyze a chess position and return all possible moves with their advantages.
    
    Args:
        request: StateStringRequest containing state_string and optional time_limit
        
    Returns:
        AnalysisResponse with complete board analysis
    """
    try:
        # Parse the state string
        turn, fen, arrows = parse_state_string(request.state_string)
        
        # Create chess board from FEN
        board = chess.Board(fen)
        
        # Get analyzer
        analyzer = get_analyzer()
        
        # Get complete board analysis
        analysis_data = analyzer.get_board_analysis(board, request.time_limit)
        
        # Get best move data
        best_move_data = analyzer.get_best_move(board, request.time_limit)
        
        # Combine the results
        response = AnalysisResponse(
            fen=analysis_data["fen"],
            turn=analysis_data["turn"],
            total_moves=analysis_data["total_moves"],
            moves=analysis_data["moves"],
            best_move=best_move_data.get("best_move"),
            advantage=best_move_data.get("advantage"),
            is_mate=best_move_data.get("is_mate", False),
            mate_in=best_move_data.get("mate_in"),
            principal_variation=best_move_data.get("principal_variation", [])
        )
        
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/best-move", response_model=BestMoveResponse)
async def get_best_move(request: StateStringRequest):
    """
    Get the best move for a chess position.
    
    Args:
        request: StateStringRequest containing state_string and optional time_limit
        
    Returns:
        BestMoveResponse with best move information
    """
    try:
        # Parse the state string
        turn, fen, arrows = parse_state_string(request.state_string)
        
        # Create chess board from FEN
        board = chess.Board(fen)
        
        # Get analyzer
        analyzer = get_analyzer()
        
        # Get best move data
        best_move_data = analyzer.get_best_move(board, request.time_limit)
        
        if "error" in best_move_data:
            raise HTTPException(status_code=500, detail=best_move_data["error"])
        
        response = BestMoveResponse(
            best_move=best_move_data["best_move"],
            advantage=best_move_data.get("advantage"),
            is_mate=best_move_data.get("is_mate", False),
            mate_in=best_move_data.get("mate_in"),
            depth_reached=best_move_data.get("depth_reached"),
            nodes_searched=best_move_data.get("nodes_searched"),
            principal_variation=best_move_data.get("principal_variation", [])
        )
        
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Best move analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
