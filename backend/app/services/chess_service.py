"""
Chess analysis service for handling chess-related business logic.
"""

import chess
import chess.engine
from typing import Optional, Dict, Any, List
import sys
import os

from app.core.config import settings
from app.models.chess import MoveAnalysis, AnalysisResponse, BestMoveResponse
from app.utils.chess_utils import parse_state_string, find_stockfish_path
from chess_scoring import ChessAnalyzer


class ChessService:
    """Service for chess analysis operations"""
    
    def __init__(self):
        self._analyzer: Optional[ChessAnalyzer] = None
        self._engine_path: Optional[str] = None
    
    def _get_analyzer(self) -> ChessAnalyzer:
        """Get or create the chess analyzer instance"""
        if self._analyzer is None:
            self._initialize_analyzer()
        return self._analyzer
    
    def _initialize_analyzer(self) -> None:
        """Initialize the chess analyzer with Stockfish engine"""
        if self._engine_path is None:
            self._engine_path = find_stockfish_path(settings.stockfish_paths)
            
            if self._engine_path is None:
                raise RuntimeError(
                    "Stockfish engine not found. Please install Stockfish and ensure it's in your PATH or current directory."
                )
        
        self._analyzer = ChessAnalyzer(
            engine_path=self._engine_path,
            default_time=settings.default_analysis_time,
            show_raw_score=False,
            show_best_move=False,
            show_variation=False,
            show_depth=False,
            show_nodes=False
        )
        self._analyzer.start_engine()
    
    def start_engine(self) -> None:
        """Start the chess engine"""
        try:
            self._get_analyzer()
        except Exception as e:
            raise RuntimeError(f"Failed to start chess engine: {e}")
    
    def stop_engine(self) -> None:
        """Stop the chess engine"""
        if self._analyzer:
            try:
                self._analyzer.quit_engine()
            except Exception as e:
                print(f"Warning: Error closing engine: {e}")
            finally:
                self._analyzer = None
    
    def is_engine_ready(self) -> bool:
        """Check if the chess engine is ready"""
        try:
            return self._analyzer is not None and self._analyzer.engine is not None
        except:
            return False
    
    def analyze_position(self, state_string: str, time_limit: Optional[float] = None) -> AnalysisResponse:
        """
        Analyze a chess position and return complete analysis.
        
        Args:
            state_string: Chess position in format "turn::fen::arrows"
            time_limit: Analysis time in seconds
            
        Returns:
            AnalysisResponse with complete board analysis
            
        Raises:
            ValueError: If state string is invalid
            RuntimeError: If analysis fails
        """
        # Parse state string
        turn, fen, arrows = parse_state_string(state_string)
        
        # Validate time limit
        if time_limit is None:
            time_limit = settings.default_analysis_time
        elif time_limit > settings.max_analysis_time:
            time_limit = settings.max_analysis_time
        
        # Create chess board
        try:
            board = chess.Board(fen)
        except ValueError as e:
            raise ValueError(f"Invalid FEN: {e}")
        
        # Get analyzer
        analyzer = self._get_analyzer()
        
        # Get complete board analysis
        try:
            analysis_data = analyzer.get_board_analysis(board, time_limit)
        except Exception as e:
            raise RuntimeError(f"Analysis failed: {e}")
        
        # Get best move data
        try:
            best_move_data = analyzer.get_best_move(board, time_limit)
        except Exception as e:
            raise RuntimeError(f"Best move analysis failed: {e}")
        
        # Convert moves to MoveAnalysis objects
        moves = [
            MoveAnalysis(
                move=move_data["move"],
                white_advantage=move_data["white_advantage"],
                is_mate=move_data["is_mate"],
                mate_in=move_data["mate_in"],
                best_response=move_data["best_response"],
                depth_reached=move_data["depth_reached"],
                nodes_searched=move_data["nodes_searched"]
            )
            for move_data in analysis_data["moves"]
        ]
        
        # Create response
        response = AnalysisResponse(
            fen=analysis_data["fen"],
            turn=analysis_data["turn"],
            total_moves=analysis_data["total_moves"],
            moves=moves,
            best_move=best_move_data.get("best_move"),
            advantage=best_move_data.get("advantage"),
            is_mate=best_move_data.get("is_mate", False),
            mate_in=best_move_data.get("mate_in"),
            principal_variation=best_move_data.get("principal_variation", [])
        )
        
        return response
    
    def get_best_move(self, state_string: str, time_limit: Optional[float] = None) -> BestMoveResponse:
        """
        Get the best move for a chess position.
        
        Args:
            state_string: Chess position in format "turn::fen::arrows"
            time_limit: Analysis time in seconds
            
        Returns:
            BestMoveResponse with best move information
            
        Raises:
            ValueError: If state string is invalid
            RuntimeError: If analysis fails
        """
        # Parse state string
        turn, fen, arrows = parse_state_string(state_string)
        
        # Validate time limit
        if time_limit is None:
            time_limit = settings.default_analysis_time
        elif time_limit > settings.max_analysis_time:
            time_limit = settings.max_analysis_time
        
        # Create chess board
        try:
            board = chess.Board(fen)
        except ValueError as e:
            raise ValueError(f"Invalid FEN: {e}")
        
        # Get analyzer
        analyzer = self._get_analyzer()
        
        # Get best move data
        try:
            best_move_data = analyzer.get_best_move(board, time_limit)
        except Exception as e:
            raise RuntimeError(f"Best move analysis failed: {e}")
        
        if "error" in best_move_data:
            raise RuntimeError(best_move_data["error"])
        
        # Create response
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
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on the chess service.
        
        Returns:
            Dictionary with health status
        """
        try:
            if self.is_engine_ready():
                return {
                    "status": "healthy",
                    "engine": "stockfish",
                    "engine_path": self._engine_path
                }
            else:
                return {
                    "status": "unhealthy",
                    "error": "Chess engine not ready"
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Global chess service instance
chess_service = ChessService()
