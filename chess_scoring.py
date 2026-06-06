import chess
import chess.engine
import sys
import os
import json
from typing import Optional, Dict, Any, List

class ChessAnalyzer:
    def __init__(self, engine_path: str = "./stockfish", 
                 default_depth: Optional[int] = None,
                 default_time: float = 1.0,
                 show_raw_score: bool = True,
                 show_best_move: bool = True,
                 show_variation: bool = True,
                 show_depth: bool = True,
                 show_nodes: bool = True):
        """
        Initialize the chess analyzer with Stockfish engine and analysis options.
        
        Args:
            engine_path: Path to the Stockfish executable
            default_depth: Default search depth (if None, uses time-based search)
            default_time: Default time limit in seconds
            show_raw_score: Whether to show raw centipawn values
            show_best_move: Whether to show the best move
            show_variation: Whether to show principal variation
            show_depth: Whether to show search depth reached
            show_nodes: Whether to show nodes searched
        """
        self.engine_path = engine_path
        self.engine = None
        self.default_depth = default_depth
        self.default_time = default_time
        self.show_raw_score = show_raw_score
        self.show_best_move = show_best_move
        self.show_variation = show_variation
        self.show_depth = show_depth
        self.show_nodes = show_nodes
        
    def __enter__(self):
        """Context manager entry."""
        self.start_engine()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - ensures engine is properly closed."""
        self.quit_engine()
        
    def start_engine(self) -> None:
        """Start the Stockfish engine with error handling."""
        try:
            if not os.path.exists(self.engine_path):
                raise FileNotFoundError(f"Stockfish engine not found at {self.engine_path}")
            
            self.engine = chess.engine.SimpleEngine.popen_uci(self.engine_path)
            print(f"✅ Stockfish engine started successfully")
        except Exception as e:
            print(f"❌ Error starting engine: {e}")
            sys.exit(1)
    
    def quit_engine(self) -> None:
        """Safely quit the engine."""
        if self.engine:
            try:
                self.engine.quit()
                print("🔚 Engine closed")
            except Exception as e:
                print(f"⚠️  Warning: Error closing engine: {e}")
    
    def analyze_position(self, board: chess.Board, time_limit: Optional[float] = None, 
                        depth_limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Analyze a chess position and return detailed information.
        
        Args:
            board: The chess position to analyze
            time_limit: Time limit in seconds (uses default if None)
            depth_limit: Optional depth limit (uses default if None)
            
        Returns:
            Dictionary containing analysis results
        """
        if not self.engine:
            raise RuntimeError("Engine not started. Use start_engine() first.")
        
        # Use defaults if not specified
        if time_limit is None:
            time_limit = self.default_time
        if depth_limit is None:
            depth_limit = self.default_depth
        
        # Set analysis limits
        if depth_limit:
            limit = chess.engine.Limit(depth=depth_limit)
        else:
            limit = chess.engine.Limit(time=time_limit)
        
        try:
            info = self.engine.analyse(board, limit)
            return info
        except Exception as e:
            print(f"❌ Error during analysis: {e}")
            return {}
    
    def get_score_text(self, score: chess.engine.Score) -> str:
        """Convert score to human-readable text."""
        if score.is_mate():
            mate_moves = score.mate()
            if mate_moves > 0:
                return f"White mates in {mate_moves} moves"
            else:
                return f"Black mates in {abs(mate_moves)} moves"
        else:
            # Handle PovScore object - try different ways to get the score
            centipawns = None
            
            # Try different methods to extract the score
            if hasattr(score, 'relative'):
                try:
                    centipawns = int(score.relative)
                except (TypeError, ValueError):
                    pass
            
            if centipawns is None and hasattr(score, 'white'):
                try:
                    centipawns = int(score.white)
                except (TypeError, ValueError):
                    pass
            
            if centipawns is None and hasattr(score, 'score'):
                try:
                    centipawns = int(score.score)
                except (TypeError, ValueError):
                    pass
            
            if centipawns is None:
                # Try to parse from string representation
                score_str = str(score)
                if "Cp(" in score_str:
                    # Extract number from "Cp(+27)" format
                    import re
                    match = re.search(r'Cp\(([+-]?\d+)\)', score_str)
                    if match:
                        centipawns = int(match.group(1))
                    else:
                        return f"Score: {score} (raw)"
                else:
                    return f"Score: {score} (raw)"
            
            if centipawns > 0:
                return f"White advantage: {centipawns/100:.2f} pawns"
            elif centipawns < 0:
                return f"Black advantage: {abs(centipawns)/100:.2f} pawns"
            else:
                return "Equal position"
    
    def analyze_fen(self, fen: str, time_limit: float = 1.0) -> None:
        """Analyze a position from FEN notation."""
        try:
            board = chess.Board(fen)
            self.analyze_board(board, time_limit)
        except ValueError as e:
            print(f"❌ Invalid FEN: {e}")
    
    def analyze_board(self, board: chess.Board, time_limit: Optional[float] = None) -> None:
        """Analyze a chess board position."""
        print(f"\n🔍 Analyzing position...")
        print(f"📋 FEN: {board.fen()}")
        
        # Use default time if not specified
        if time_limit is None:
            time_limit = self.default_time
        
        if self.default_depth:
            print(f"🔬 Depth limit: {self.default_depth}")
        else:
            print(f"⏱️  Time limit: {time_limit}s")
        
        info = self.analyze_position(board, time_limit)
        
        if not info:
            print("❌ Analysis failed")
            return
        
        # Display results
        score = info.get("score")
        if score:
            print(f"📊 Score: {self.get_score_text(score)}")
            # Show raw centipawn value for reference
            if self.show_raw_score and not score.is_mate():
                try:
                    score_str = str(score)
                    if "Cp(" in score_str:
                        import re
                        match = re.search(r'Cp\(([+-]?\d+)\)', score_str)
                        if match:
                            centipawns = int(match.group(1))
                            print(f"🔢 Raw centipawns: {centipawns}")
                except:
                    pass
        
        # Show best move if available
        if self.show_best_move:
            pv = info.get("pv")
            if pv and len(pv) > 0:
                print(f"🎯 Best move: {pv[0]}")
                if self.show_variation and len(pv) > 1:
                    print(f"📈 Principal variation: {' '.join(str(move) for move in pv[:5])}")
        
        # Show depth reached
        if self.show_depth:
            depth = info.get("depth")
            if depth:
                print(f"🔬 Depth: {depth}")
        
        # Show nodes searched
        if self.show_nodes:
            nodes = info.get("nodes")
            if nodes:
                print(f"🧠 Nodes searched: {nodes:,}")
    
    def analyze_all_moves(self, board: chess.Board, time_limit: Optional[float] = None) -> None:
        """
        Analyze all possible legal moves and show the advantage after each move.
        
        Args:
            board: The chess position to analyze
            time_limit: Time limit for each move analysis
        """
        print(f"\n🔍 Analyzing all possible moves...")
        print(f"📋 FEN: {board.fen()}")
        
        if time_limit is None:
            time_limit = self.default_time
        
        legal_moves = list(board.legal_moves)
        print(f"📊 Total legal moves: {len(legal_moves)}")
        
        if not legal_moves:
            print("❌ No legal moves available")
            return
        
        move_scores = []
        
        for i, move in enumerate(legal_moves, 1):
            # Make the move
            board.push(move)
            
            # Analyze the resulting position
            info = self.analyze_position(board, time_limit)
            
            if info and "score" in info:
                score = info["score"]
                score_text = self.get_score_text(score)
                
                # Extract centipawn value for sorting
                centipawns = 0
                if not score.is_mate():
                    try:
                        score_str = str(score)
                        if "Cp(" in score_str:
                            import re
                            match = re.search(r'Cp\(([+-]?\d+)\)', score_str)
                            if match:
                                centipawns = int(match.group(1))
                    except:
                        pass
                
                move_scores.append((move, score_text, centipawns, info))
                print(f"  {i:2d}. {move}: {score_text}")
            else:
                print(f"  {i:2d}. {move}: Analysis failed")
            
            # Undo the move
            board.pop()
        
        # Sort moves by score (best first)
        move_scores.sort(key=lambda x: x[2], reverse=True)
        
        print(f"\n🏆 Top 5 moves by advantage:")
        for i, (move, score_text, centipawns, info) in enumerate(move_scores[:5], 1):
            print(f"  {i}. {move}: {score_text}")
            if self.show_best_move and "pv" in info and info["pv"]:
                print(f"     Best response: {info['pv'][0]}")
    
    def get_moves_json(self, board: chess.Board, time_limit: Optional[float] = None) -> Dict[str, Any]:
        """
        Get all possible moves with their white advantage scores as JSON.
        
        Args:
            board: The chess position to analyze
            time_limit: Time limit for each move analysis
            
        Returns:
            Dictionary with move analysis data
        """
        if time_limit is None:
            time_limit = self.default_time
        
        legal_moves = list(board.legal_moves)
        moves_data = {
            "fen": board.fen(),
            "total_moves": len(legal_moves),
            "moves": []
        }
        
        if not legal_moves:
            return moves_data
        
        for move in legal_moves:
            # Make the move
            board.push(move)
            
            # Analyze the resulting position
            info = self.analyze_position(board, time_limit)
            
            move_data = {
                "move": str(move),
                "white_advantage": None,
                "is_mate": False,
                "mate_in": None,
                "best_response": None
            }
            
            if info and "score" in info:
                score = info["score"]
                
                if score.is_mate():
                    mate_moves = score.mate()
                    move_data["is_mate"] = True
                    move_data["mate_in"] = mate_moves
                    # For mate, we can't really say "white advantage" in centipawns
                    move_data["white_advantage"] = None
                else:
                    # Extract centipawn value (always from white's perspective)
                    try:
                        score_str = str(score)
                        if "Cp(" in score_str:
                            import re
                            match = re.search(r'Cp\(([+-]?\d+)\)', score_str)
                            if match:
                                centipawns = int(match.group(1))
                                # Convert to white advantage (positive = white better, negative = black better)
                                move_data["white_advantage"] = centipawns / 100.0  # Convert to pawns
                    except:
                        pass
                
                # Add best response if available
                if "pv" in info and info["pv"]:
                    move_data["best_response"] = str(info["pv"][0])
            
            # Undo the move
            board.pop()
            
            moves_data["moves"].append(move_data)
        
        # Sort moves by white advantage (best first)
        moves_data["moves"].sort(key=lambda x: x["white_advantage"] if x["white_advantage"] is not None else -999, reverse=True)
        
        return moves_data
        
    def get_board_analysis(self, board: chess.Board, time_limit: Optional[float] = None) -> Dict[str, Any]:
        """
        Get complete board analysis with all moves and their advantages.
        
        Args:
            board: The chess position to analyze
            time_limit: Time limit for each move analysis
            
        Returns:
            Dictionary with complete board analysis
        """
        if time_limit is None:
            time_limit = self.default_time
        
        legal_moves = list(board.legal_moves)
        analysis_data = {
            "fen": board.fen(),
            "turn": "white" if board.turn else "black",
            "total_moves": len(legal_moves),
            "moves": []
        }
        
        if not legal_moves:
            return analysis_data
        
        for move in legal_moves:
            # Make the move
            board.push(move)
            
            # Analyze the resulting position
            info = self.analyze_position(board, time_limit)
            
            move_data = {
                "move": str(move),
                "white_advantage": None,
                "is_mate": False,
                "mate_in": None,
                "best_response": None,
                "depth_reached": None,
                "nodes_searched": None
            }
            
            if info and "score" in info:
                score = info["score"]
                
                if score.is_mate():
                    mate_moves = score.mate()
                    move_data["is_mate"] = True
                    move_data["mate_in"] = mate_moves
                    # For mate, we can't really say "white advantage" in centipawns
                    move_data["white_advantage"] = None
                else:
                    # Extract centipawn value (always from white's perspective)
                    try:
                        score_str = str(score)
                        if "Cp(" in score_str:
                            import re
                            match = re.search(r'Cp\(([+-]?\d+)\)', score_str)
                            if match:
                                centipawns = int(match.group(1))
                                # Convert to white advantage (positive = white better, negative = black better)
                                move_data["white_advantage"] = centipawns / 100.0  # Convert to pawns
                    except:
                        pass
                
                # Add best response if available
                if "pv" in info and info["pv"]:
                    move_data["best_response"] = str(info["pv"][0])
                
                # Add depth and nodes info
                if "depth" in info:
                    move_data["depth_reached"] = info["depth"]
                if "nodes" in info:
                    move_data["nodes_searched"] = info["nodes"]
            
            # Undo the move
            board.pop()
            
            analysis_data["moves"].append(move_data)
        
        # Sort moves by white advantage (best first)
        analysis_data["moves"].sort(key=lambda x: x["white_advantage"] if x["white_advantage"] is not None else -999, reverse=True)
        
        return analysis_data
        
    def get_best_move(self, board: chess.Board, time_limit: Optional[float] = None) -> Dict[str, Any]:
        """
        Get the best move and advantage for the current position.
        
        Args:
            board: The chess position to analyze
            time_limit: Time limit for analysis
            
        Returns:
            Dictionary with best move information
        """
        if time_limit is None:
            time_limit = self.default_time
        
        # Analyze the current position
        info = self.analyze_position(board, time_limit)
        
        if not info:
            return {
                "error": "Analysis failed",
                "best_move": None,
                "advantage": None,
                "is_mate": False,
                "mate_in": None
            }
        
        score = info.get("score")
        pv = info.get("pv", [])
        
        result = {
            "best_move": str(pv[0]) if pv else None,
            "advantage": None,
            "is_mate": False,
            "mate_in": None,
            "depth_reached": info.get("depth"),
            "nodes_searched": info.get("nodes"),
            "principal_variation": [str(move) for move in pv[:5]] if pv else []
        }
        
        if score:
            if score.is_mate():
                mate_moves = score.mate()
                result["is_mate"] = True
                result["mate_in"] = mate_moves
                result["advantage"] = None
            else:
                # Extract centipawn value
                try:
                    score_str = str(score)
                    if "Cp(" in score_str:
                        import re
                        match = re.search(r'Cp\(([+-]?\d+)\)', score_str)
                        if match:
                            centipawns = int(match.group(1))
                            # Convert to advantage (positive = white better, negative = black better)
                            result["advantage"] = centipawns / 100.0  # Convert to pawns
                except:
                    pass
        
        return result
        
    def save_moves_json(self, board: chess.Board, filename: str, time_limit: Optional[float] = None) -> None:
        """
        Save all possible moves with their white advantage scores to a JSON file.
        
        Args:
            board: The chess position to analyze
            filename: Output JSON filename
            time_limit: Time limit for each move analysis
        """
        moves_data = self.get_moves_json(board, time_limit)
        
        with open(filename, 'w') as f:
            json.dump(moves_data, f, indent=2)
        
        print(f"💾 Saved move analysis to {filename}")
        print(f"📊 Analyzed {moves_data['total_moves']} moves")
    
    def analyze_move_sequence(self, board: chess.Board, moves: list, time_limit: Optional[float] = None) -> None:
        """
        Analyze a sequence of moves and show the advantage after each move.
        
        Args:
            board: The starting position
            moves: List of moves to analyze
            time_limit: Time limit for each analysis
        """
        print(f"\n🔍 Analyzing move sequence...")
        print(f"📋 Starting FEN: {board.fen()}")
        
        if time_limit is None:
            time_limit = self.default_time
        
        current_board = board.copy()
        
        for i, move in enumerate(moves, 1):
            if move not in current_board.legal_moves:
                print(f"❌ Move {i}: {move} is not legal")
                break
            
            # Make the move
            current_board.push(move)
            
            # Analyze the position
            info = self.analyze_position(current_board, time_limit)
            
            if info and "score" in info:
                score = info["score"]
                score_text = self.get_score_text(score)
                print(f"  {i}. After {move}: {score_text}")
            else:
                print(f"  {i}. After {move}: Analysis failed")
                break

def main():
    """Main function to demonstrate the chess analyzer."""
    print("♟️  Chess Position Analyzer")
    print("=" * 40)
    
    # Example 1: Get complete board analysis
    with ChessAnalyzer(default_time=0.2, show_raw_score=False, 
                      show_variation=False, show_depth=False, show_nodes=False) as analyzer:
        print("\n1️⃣ Complete board analysis of starting position:")
        board = chess.Board()
        analysis_data = analyzer.get_board_analysis(board)
        
        # Print summary
        print(f"📊 Total moves: {analysis_data['total_moves']}")
        print(f"📋 FEN: {analysis_data['fen']}")
        print(f"🎯 Turn: {analysis_data['turn']}")
        print("\n🏆 Top 5 moves by white advantage:")
        for i, move_data in enumerate(analysis_data['moves'][:5], 1):
            advantage = move_data['white_advantage']
            if advantage is not None:
                print(f"  {i}. {move_data['move']}: {advantage:+.2f} pawns")
            else:
                print(f"  {i}. {move_data['move']}: Mate in {move_data['mate_in']}")
        
        # Save to file
        analyzer.save_moves_json(board, "starting_position_moves.json")
    
    # Example 2: Get best move for custom position
    with ChessAnalyzer(default_time=0.1, show_raw_score=False, 
                      show_variation=False, show_depth=False, show_nodes=False) as analyzer:
        print("\n2️⃣ Best move analysis of custom position:")
        custom_fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4"
        board = chess.Board(custom_fen)
        
        # Get best move
        best_move_data = analyzer.get_best_move(board)
        
        print(f"📋 FEN: {board.fen()}")
        print(f"🎯 Turn: {'white' if board.turn else 'black'}")
        
        if "error" in best_move_data:
            print(f"❌ {best_move_data['error']}")
        else:
            print(f"🏆 Best move: {best_move_data['best_move']}")
            if best_move_data['advantage'] is not None:
                print(f"📊 Advantage: {best_move_data['advantage']:+.2f} pawns")
            elif best_move_data['is_mate']:
                print(f"♟️ Mate in: {best_move_data['mate_in']} moves")
            
            if best_move_data['principal_variation']:
                print(f"📈 Principal variation: {' '.join(best_move_data['principal_variation'])}")
            
            if best_move_data['depth_reached']:
                print(f"🔬 Depth reached: {best_move_data['depth_reached']}")
            if best_move_data['nodes_searched']:
                print(f"🧠 Nodes searched: {best_move_data['nodes_searched']:,}")
    
    # Example 3: Get complete analysis for custom position
    with ChessAnalyzer(default_time=0.1, show_raw_score=False, 
                      show_variation=False, show_depth=False, show_nodes=False) as analyzer:
        print("\n3️⃣ Complete analysis of custom position:")
        custom_fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4"
        board = chess.Board(custom_fen)
        analysis_data = analyzer.get_board_analysis(board)
        
        # Print summary
        print(f"📊 Total moves: {analysis_data['total_moves']}")
        print(f"📋 FEN: {analysis_data['fen']}")
        print(f"🎯 Turn: {analysis_data['turn']}")
        print("\n🏆 Top 5 moves by white advantage:")
        for i, move_data in enumerate(analysis_data['moves'][:5], 1):
            advantage = move_data['white_advantage']
            if advantage is not None:
                print(f"  {i}. {move_data['move']}: {advantage:+.2f} pawns")
            else:
                print(f"  {i}. {move_data['move']}: Mate in {move_data['mate_in']}")
        
        # Save to file
        analyzer.save_moves_json(board, "custom_position_moves.json")
    
    print("\n✅ Analysis complete!")

if __name__ == "__main__":
    main()
