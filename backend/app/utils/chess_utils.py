"""
Utility functions for chess-related operations.
"""

import os
from typing import Tuple, Optional
import chess


def parse_state_string(state_string: str) -> Tuple[str, str, str]:
    """
    Parse state string in format "turn::fen::arrows"
    
    Args:
        state_string: State string to parse
        
    Returns:
        Tuple of (turn, fen, arrows)
        
    Raises:
        ValueError: If state string format is invalid
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
    
    # Validate FEN by trying to create a board
    try:
        chess.Board(fen)
    except ValueError as e:
        raise ValueError(f"Invalid FEN: {e}")
    
    return turn, fen, arrows


def find_stockfish_path(stockfish_paths: list) -> Optional[str]:
    """
    Find Stockfish executable in the given paths.
    
    Args:
        stockfish_paths: List of paths to check
        
    Returns:
        Path to Stockfish executable or None if not found
    """
    for path in stockfish_paths:
        if os.path.exists(path) or path == "stockfish":
            return path
    return None


def validate_fen(fen: str) -> bool:
    """
    Validate FEN string format.
    
    Args:
        fen: FEN string to validate
        
    Returns:
        True if valid, False otherwise
    """
    try:
        chess.Board(fen)
        return True
    except ValueError:
        return False


def format_move_advantage(advantage: Optional[float]) -> str:
    """
    Format move advantage for display.
    
    Args:
        advantage: Advantage in pawns
        
    Returns:
        Formatted string
    """
    if advantage is None:
        return "N/A"
    
    if advantage > 0:
        return f"+{advantage:.2f}"
    elif advantage < 0:
        return f"{advantage:.2f}"
    else:
        return "0.00"


def format_mate_info(is_mate: bool, mate_in: Optional[int]) -> str:
    """
    Format mate information for display.
    
    Args:
        is_mate: Whether position is mate
        mate_in: Number of moves to mate
        
    Returns:
        Formatted string
    """
    if not is_mate:
        return "No mate"
    
    if mate_in is None:
        return "Mate"
    
    if mate_in > 0:
        return f"Mate in {mate_in}"
    else:
        return f"Mated in {abs(mate_in)}"
