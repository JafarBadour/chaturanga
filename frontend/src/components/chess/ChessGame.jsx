import React, { useState, useEffect, useCallback } from 'react';
import { ChessEngine } from './ChessEngine';

const ChessGame = ({ 
  initialFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  onMove = null,
  onGameStateChange = null
}) => {
  const [engine, setEngine] = useState(new ChessEngine(initialFEN));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [gameState, setGameState] = useState({
    fen: initialFEN,
    turn: 'w',
    moveHistory: []
  });

  // Update game state when engine changes
  useEffect(() => {
    const newGameState = {
      fen: engine.getFEN(),
      turn: engine.getTurn(),
      moveHistory: engine.getMoveHistory()
    };
    setGameState(newGameState);
    
    if (onGameStateChange) {
      onGameStateChange(newGameState);
    }
  }, [engine, onGameStateChange]);

  // Handle square click
  const handleSquareClick = useCallback((square, row, col) => {
    const piece = engine.getPieceAt(square);
    
    // If a piece is selected and we click on a possible move square
    if (selectedSquare && possibleMoves.includes(square)) {
      // Make the move
      const moveResult = engine.makeMove(selectedSquare, square);
      setLastMove({ from: selectedSquare, to: square });
      
      // Clear selection
      setSelectedSquare(null);
      setPossibleMoves([]);
      
      // Notify parent component
      if (onMove) {
        onMove(moveResult);
      }
      
      // Update engine state
      setEngine(new ChessEngine(engine.getFEN()));
      return;
    }
    
    // If clicking on own piece, select it
    if (piece) {
      const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b';
      if (pieceColor === engine.getTurn()) {
        setSelectedSquare(square);
        const moves = engine.getLegalMoves(square);
        setPossibleMoves(moves);
        return;
      }
    }
    
    // Clear selection if clicking on empty square or opponent piece
    setSelectedSquare(null);
    setPossibleMoves([]);
  }, [engine, selectedSquare, possibleMoves, onMove]);

  // Reset game
  const resetGame = useCallback((newFEN = initialFEN) => {
    const newEngine = new ChessEngine(newFEN);
    setEngine(newEngine);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setLastMove(null);
  }, [initialFEN]);

  // Get highlighted squares (selected square + possible moves)
  const getHighlightedSquares = useCallback(() => {
    const highlighted = [...possibleMoves];
    if (selectedSquare) {
      highlighted.push(selectedSquare);
    }
    return highlighted;
  }, [selectedSquare, possibleMoves]);

  // Get move type for highlighting
  const getMoveType = useCallback((square) => {
    if (selectedSquare === square) return 'selected';
    if (possibleMoves.includes(square)) {
      const piece = engine.getPieceAt(square);
      return piece ? 'capture' : 'move';
    }
    return null;
  }, [selectedSquare, possibleMoves, engine]);

  return {
    // Game state
    gameState,
    selectedSquare,
    possibleMoves,
    lastMove,
    
    // Game actions
    handleSquareClick,
    resetGame,
    
    // UI helpers
    getHighlightedSquares,
    getMoveType,
    
    // Engine access
    engine
  };
};

export default ChessGame;
