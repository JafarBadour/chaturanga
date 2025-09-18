#!/usr/bin/env python3
"""
Example usage of the Chess Analysis API.
This shows how to integrate the API with your frontend application.
"""

import requests
import json

class ChessAPIClient:
    """Client for the Chess Analysis API"""
    
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
    
    def analyze_position(self, state_string, time_limit=1.0):
        """
        Get complete analysis of a chess position.
        
        Args:
            state_string: Chess position in format "turn::fen::arrows"
            time_limit: Analysis time in seconds
            
        Returns:
            Dictionary with complete analysis
        """
        try:
            response = requests.post(f"{self.base_url}/api/v1/analyze", json={
                "state_string": state_string,
                "time_limit": time_limit
            })
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error analyzing position: {e}")
            return None
    
    def get_best_move(self, state_string, time_limit=1.0):
        """
        Get the best move for a chess position.
        
        Args:
            state_string: Chess position in format "turn::fen::arrows"
            time_limit: Analysis time in seconds
            
        Returns:
            Dictionary with best move information
        """
        try:
            response = requests.post(f"{self.base_url}/api/v1/best-move", json={
                "state_string": state_string,
                "time_limit": time_limit
            })
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error getting best move: {e}")
            return None
    
    def health_check(self):
        """Check if the API is running"""
        try:
            response = requests.get(f"{self.base_url}/api/v1/health")
            return response.status_code == 200
        except:
            return False

def main():
    """Example usage of the Chess API Client"""
    print("♟️  Chess API Client Example")
    print("=" * 40)
    
    # Create API client
    client = ChessAPIClient()
    
    # Check if API is running
    if not client.health_check():
        print("❌ API is not running. Please start the server first:")
        print("   cd backend && python run.py")
        return
    
    print("✅ API is running")
    
    # Example 1: Starting position analysis
    print("\n1️⃣ Analyzing starting position...")
    starting_position = "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
    
    analysis = client.analyze_position(starting_position, time_limit=0.5)
    if analysis:
        print(f"   Total moves: {analysis['total_moves']}")
        print(f"   Best move: {analysis['best_move']}")
        print(f"   Advantage: {analysis['advantage']}")
        print(f"   Top 3 moves:")
        for i, move in enumerate(analysis['moves'][:3], 1):
            advantage = move['white_advantage']
            if advantage is not None:
                print(f"     {i}. {move['move']}: {advantage:+.2f} pawns")
            else:
                print(f"     {i}. {move['move']}: Mate in {move['mate_in']}")
    
    # Example 2: Best move only
    print("\n2️⃣ Getting best move for starting position...")
    best_move = client.get_best_move(starting_position, time_limit=0.5)
    if best_move:
        print(f"   Best move: {best_move['best_move']}")
        print(f"   Advantage: {best_move['advantage']}")
        print(f"   Principal variation: {' '.join(best_move['principal_variation'][:3])}")
    
    # Example 3: Middle game position
    print("\n3️⃣ Analyzing middle game position...")
    middle_game = "white::r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4::"
    
    analysis = client.analyze_position(middle_game, time_limit=0.5)
    if analysis:
        print(f"   Total moves: {analysis['total_moves']}")
        print(f"   Best move: {analysis['best_move']}")
        print(f"   Advantage: {analysis['advantage']}")
    
    print("\n✅ Example complete!")
    print("\n💡 Integration tips:")
    print("   - Use shorter time_limit for faster responses")
    print("   - Handle errors gracefully in your frontend")
    print("   - Cache results for the same position")
    print("   - Use the state_string format from your chess board")

if __name__ == "__main__":
    main()
