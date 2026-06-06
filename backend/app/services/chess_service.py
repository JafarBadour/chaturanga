"""
Chess analysis service — engine disabled; endpoints return unavailable.
"""

from typing import Dict, Any, Optional

from app.models.chess import AnalysisResponse, BestMoveResponse

_ANALYSIS_DISABLED = "Chess analysis is not enabled on this server"


class ChessService:
    """Stub service; Stockfish analysis is not used."""

    def start_engine(self) -> None:
        pass

    def stop_engine(self) -> None:
        pass

    def is_engine_ready(self) -> bool:
        return False

    def analyze_position(self, state_string: str, time_limit: Optional[float] = None) -> AnalysisResponse:
        raise RuntimeError(_ANALYSIS_DISABLED)

    def get_best_move(self, state_string: str, time_limit: Optional[float] = None) -> BestMoveResponse:
        raise RuntimeError(_ANALYSIS_DISABLED)

    def health_check(self) -> Dict[str, Any]:
        return {"status": "disabled"}


chess_service = ChessService()
