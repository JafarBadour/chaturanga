import React, { useState, useEffect } from 'react';
import { Piece } from './pieces';
import { ChessEngine } from './chess';
import Arrow from './Arrow';
import { ArrowParser } from './ArrowParser';
import { ChessStateParser } from './ChessStateParser';
import './ChessBoard.css';

const ChessBoard = ({ 
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation = "white",
  showCoordinates = true,
  onSquareClick = null,
  highlightedSquares = [],
  lastMove = null,
  size = 400,
  usePieceImages = true,
  enableMoves = false,
  onMove = null,
  arrows = "", // "e5->e6\e5->b4"
  arrowThickness = 24, // Default arrow thickness
  showPossibleMovesSide = "both", // "white", "black", or "both"
  turn = "white", // "white" or "black" - whose turn it is
  stateString = null // "turn::fen::arrows" format - overrides other props
}) => {
  // Parse stateString if provided, otherwise use individual props
  const parsedState = stateString ? ChessStateParser.parse(stateString) : null;
  const effectiveTurn = parsedState ? parsedState.turn : turn;
  const effectiveFen = parsedState ? parsedState.fen : fen;
  const effectiveArrows = parsedState ? parsedState.arrows : arrows;

  const [board, setBoard] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [gameLastMove, setGameLastMove] = useState(null);
  const [engine, setEngine] = useState(new ChessEngine(effectiveFen));
  const [gameState, setGameState] = useState(null);
  const [parsedArrows, setParsedArrows] = useState([]);

  // Parse FEN string into board array
  const parseFEN = (fenString) => {
    const parts = fenString.split(' ');
    const piecePlacement = parts[0];
    const ranks = piecePlacement.split('/');
    
    const boardArray = [];
    
    ranks.forEach(rank => {
      const rankArray = [];
      for (let char of rank) {
        if (isNaN(char)) {
          // It's a piece
          rankArray.push(char);
        } else {
          // It's a number (empty squares)
          for (let i = 0; i < parseInt(char); i++) {
            rankArray.push(null);
          }
        }
      }
      boardArray.push(rankArray);
    });
    
    return boardArray;
  };

  // Get square color (light/dark)
  const getSquareColor = (row, col) => {
    return (row + col) % 2 === 0 ? 'light' : 'dark';
  };

  // Convert row/col to square notation (e.g., "e4")
  const getSquareNotation = (row, col) => {
    const file = String.fromCharCode(97 + col); // a-h
    const rank = 8 - row; // 1-8
    return file + rank;
  };

  // Handle square click
  const handleSquareClick = (row, col) => {
    const square = getSquareNotation(row, col);
    console.log('=== SQUARE CLICKED ===');
    console.log('Square:', square, 'EnableMoves:', enableMoves);
    
    if (enableMoves) {
      // Use chess game logic
      const piece = engine.getPieceAt(square);
      console.log('Piece at square:', piece);
      console.log('Engine exists:', !!engine);
      
      // If a piece is selected and we click on a possible move square
      if (selectedSquare && possibleMoves.includes(square)) {
        // Make the move
        const moveResult = engine.makeMove(selectedSquare, square);
        setGameLastMove({ from: selectedSquare, to: square });
        
        // Clear selection
        setSelectedSquare(null);
        setPossibleMoves([]);
        
        // Update engine state
        setEngine(new ChessEngine(engine.getFEN()));
        
        // Update game state
        const newGameState = engine.getGameState();
        setGameState(newGameState);
        
        // Notify parent component
        if (onMove) {
          onMove({ ...moveResult, gameState: newGameState });
        }
        return;
      }
      
      // If clicking on piece, check if we should show moves for this side
      if (piece) {
        const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b';
        const currentTurn = effectiveTurn === 'white' ? 'w' : 'b';
        console.log('Clicked piece:', piece, 'pieceColor:', pieceColor, 'currentTurn:', currentTurn, 'showPossibleMovesSide:', showPossibleMovesSide);
        console.log('Engine turn:', engine.getTurn(), 'External turn:', currentTurn);
        
        // Check if we should show moves for this piece's color
        const shouldShowMoves = showPossibleMovesSide === "both" || 
                               (showPossibleMovesSide === "white" && pieceColor === 'w') ||
                               (showPossibleMovesSide === "black" && pieceColor === 'b');
        
        console.log('Should show moves:', shouldShowMoves);
        
        if (shouldShowMoves) {
          console.log('Selecting piece and showing moves:', square);
          setSelectedSquare(square);
          try {
            const moves = engine.getLegalMoves(square);
            console.log('Legal moves found:', moves);
            console.log('Moves length:', moves ? moves.length : 'null');
            setPossibleMoves(moves || []);
          } catch (error) {
            console.error('Error getting legal moves:', error);
            setPossibleMoves([]);
          }
          return;
        }
      }
      
      // Clear selection if clicking on empty square or opponent piece
      console.log('Clearing selection - clicked on:', square, 'piece:', piece);
      setSelectedSquare(null);
      setPossibleMoves([]);
    } else {
      // Use simple selection logic
      setSelectedSquare(selectedSquare === square ? null : square);
    }
    
    if (onSquareClick) {
      onSquareClick(square, row, col);
    }
  };

  // Get square classes for styling
  const getSquareClasses = (row, col) => {
    const square = getSquareNotation(row, col);
    const color = getSquareColor(row, col);
    let classes = `square square-${color}`;
    
    // Use chess game highlighting if moves are enabled
    if (enableMoves) {
      // Check if square is selected
      if (selectedSquare === square) {
        classes += ' selected';
      }
      
      // Check if square is a possible move
      if (possibleMoves.includes(square)) {
        const piece = engine.getPieceAt(square);
        if (piece) {
          classes += ' capture';
        } else {
          classes += ' possible-move';
        }
      }
      
      // Check if square is part of last move
      if (gameLastMove && (gameLastMove.from === square || gameLastMove.to === square)) {
        classes += ' last-move';
      }
      
      // Check if king is in check
      if (gameState && gameState.inCheck) {
        const piece = engine.getPieceAt(square);
        if (piece && piece.toLowerCase() === 'k' && engine.getPieceColor(piece) === engine.getTurn()) {
          classes += ' in-check';
        }
      }
    } else {
      // Use simple highlighting
      if (selectedSquare === square) {
        classes += ' selected';
      }
      
      if (highlightedSquares.includes(square)) {
        classes += ' highlighted';
      }
      
      if (lastMove && (lastMove.from === square || lastMove.to === square)) {
        classes += ' last-move';
      }
    }
    
    return classes;
  };

  // Update engine when FEN changes
  useEffect(() => {
    if (enableMoves) {
      const newEngine = new ChessEngine(effectiveFen);
      setEngine(newEngine);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setGameLastMove(null);
      setGameState(newEngine.getGameState());
    }
  }, [effectiveFen, enableMoves]);

  // Sync engine turn with external turn parameter
  useEffect(() => {
    if (enableMoves && engine) {
      const engineTurn = engine.getTurn();
      const externalTurn = effectiveTurn === 'white' ? 'w' : 'b';
      console.log('Syncing turns - Engine:', engineTurn, 'External:', externalTurn);
      
      if (engineTurn !== externalTurn) {
        console.log('Turn mismatch detected, updating engine');
        // Create new engine with updated turn
        const newFen = engine.getFEN().replace(/ [wb] /, ` ${externalTurn} `);
        const newEngine = new ChessEngine(newFen);
        setEngine(newEngine);
        setGameState(newEngine.getGameState());
      }
    }
  }, [effectiveTurn, enableMoves, engine]);

  // Parse arrows when arrows prop changes
  useEffect(() => {
    const parsed = ArrowParser.parse(effectiveArrows);
    setParsedArrows(parsed);
  }, [effectiveArrows]);

  // Initialize board from FEN
  useEffect(() => {
    if (enableMoves) {
      // Use chess engine board
      setBoard(parseFEN(engine.getFEN()));
    } else {
      // Use provided FEN
      const boardArray = parseFEN(effectiveFen);
      setBoard(boardArray);
    }
  }, [effectiveFen, enableMoves, engine]);

  // Flip board if orientation is black
  const displayBoard = orientation === "black" ? 
    board.map(row => [...row].reverse()).reverse() : 
    board;

  const squareSize = size / 8;

  return (
    <div className="chessboard-container">
      <div 
        className="chessboard"
        style={{ 
          width: size, 
          height: size,
          fontSize: `${squareSize * 0.6}px`
        }}
      >
        {displayBoard.map((rank, row) => (
          <div key={row} className="rank">
            {rank.map((piece, col) => {
              const actualRow = orientation === "black" ? 7 - row : row;
              const actualCol = orientation === "black" ? 7 - col : col;
              const square = getSquareNotation(actualRow, actualCol);
              
              return (
                <div
                  key={col}
                  className={getSquareClasses(actualRow, actualCol)}
                  style={{ 
                    width: squareSize, 
                    height: squareSize,
                    fontSize: `${squareSize * 0.6}px`
                  }}
                  onClick={() => handleSquareClick(actualRow, actualCol)}
                >
                  {piece && (
                    <Piece
                      piece={piece}
                      square={square}
                      size="100%"
                      useImages={usePieceImages}
                      isSelected={selectedSquare === square}
                    />
                  )}
                  
                  {/* Square coordinates */}
                  {showCoordinates && (
                    <>
                      {/* File labels (a-h) */}
                      {row === 7 && (
                        <span className="coordinate file-coordinate">
                          {String.fromCharCode(97 + actualCol)}
                        </span>
                      )}
                      {/* Rank labels (1-8) */}
                      {col === 0 && (
                        <span className="coordinate rank-coordinate">
                          {8 - actualRow}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        
        {/* Arrow overlay */}
        {parsedArrows.length > 0 && (
          <svg
            className="arrow-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 10
            }}
          >
            {parsedArrows.map((arrow, index) => (
              <Arrow
                key={index}
                from={arrow.from}
                to={arrow.to}
                color={arrow.color}
                thickness={arrow.thickness || arrowThickness}
                opacity={arrow.opacity}
                boardSize={size}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
};

export default ChessBoard;
