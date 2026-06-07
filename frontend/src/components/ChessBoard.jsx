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
  serverControlled = false,
  inCheck = false,
  checkedColor = null,
  arrows = "",
  arrowThickness = 24,
  showPossibleMovesSide = "both",
  turn = "white",
  stateString = null,
  // Premove props
  enablePremoves = false,
  premoves = [],
  onPremove = null,
}) => {
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
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [premoveSelected, setPremoveSelected] = useState(null);
  const [premoveMoves, setPremoveMoves] = useState([]);

  const parseFEN = (fenString) => {
    const parts = fenString.split(' ');
    const ranks = parts[0].split('/');
    return ranks.map(rank => {
      const row = [];
      for (let ch of rank) {
        if (isNaN(ch)) {
          row.push(ch);
        } else {
          for (let i = 0; i < parseInt(ch); i++) row.push(null);
        }
      }
      return row;
    });
  };

  const getSquareColor = (row, col) => (row + col) % 2 === 0 ? 'light' : 'dark';

  const getSquareNotation = (row, col) => String.fromCharCode(97 + col) + (8 - row);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isPawnPromotion = (from, to) => {
    const piece = engine.getPieceAt(from);
    if (!piece) return false;
    return (piece === 'P' && to[1] === '8') || (piece === 'p' && to[1] === '1');
  };

  const getPremoveMoves = (square) => {
    try {
      const fenParts = engine.getFEN().split(' ');
      fenParts[1] = orientation === "white" ? "w" : "b";
      const tempEngine = new ChessEngine(fenParts.join(' '));
      return tempEngine.getLegalMoves(square) || [];
    } catch {
      return [];
    }
  };

  const cancelPromotion = () => {
    const revertEngine = new ChessEngine(effectiveFen);
    setEngine(revertEngine);
    setBoard(parseFEN(effectiveFen));
    setGameLastMove(null);
    setGameState(revertEngine.getGameState());
    setPendingPromotion(null);
  };

  // ── Square click ──────────────────────────────────────────────────────────

  const handleSquareClick = (row, col) => {
    const square = getSquareNotation(row, col);

    // Dismiss promotion picker on board click
    if (pendingPromotion) {
      cancelPromotion();
      return;
    }

    // Premove mode — opponent's turn
    if (enablePremoves && !enableMoves) {
      const piece = engine.getPieceAt(square);
      // Use orientation (player's color) to identify own pieces, not showPossibleMovesSide
      // which is "both" when the board is non-interactive
      const isOwnPiece = piece && (
        (orientation === "white" && piece === piece.toUpperCase()) ||
        (orientation === "black" && piece !== piece.toUpperCase())
      );

      if (premoveSelected) {
        if (square === premoveSelected) {
          setPremoveSelected(null);
          setPremoveMoves([]);
        } else if (isOwnPiece) {
          setPremoveSelected(square);
          setPremoveMoves(getPremoveMoves(square));
        } else {
          if (onPremove) onPremove({ from: premoveSelected, to: square });
          setPremoveSelected(null);
          setPremoveMoves([]);
        }
      } else if (isOwnPiece) {
        setPremoveSelected(square);
        setPremoveMoves(getPremoveMoves(square));
      }
      return;
    }

    if (enableMoves) {
      const piece = engine.getPieceAt(square);

      // Completing a move
      if (selectedSquare && possibleMoves.includes(square)) {
        if (serverControlled) {
          const from = selectedSquare;
          setSelectedSquare(null);
          setPossibleMoves([]);

          if (isPawnPromotion(from, square)) {
            // Show optimistic queen, then wait for picker
            const moveResult = engine.makeMove(from, square);
            if (moveResult?.fen) {
              const prev = new ChessEngine(moveResult.fen);
              setEngine(prev);
              setBoard(parseFEN(moveResult.fen));
              setGameLastMove({ from, to: square });
              setGameState(prev.getGameState());
            }
            setPendingPromotion({ from, to: square });
            return;
          }

          const moveResult = engine.makeMove(from, square);
          if (moveResult?.fen) {
            const prev = new ChessEngine(moveResult.fen);
            setEngine(prev);
            setBoard(parseFEN(moveResult.fen));
            setGameLastMove({ from, to: square });
            setGameState(prev.getGameState());
          }
          if (onMove) onMove({ from, to: square });
          return;
        }

        // Offline / analysis mode
        engine.makeMove(selectedSquare, square);
        setGameLastMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setPossibleMoves([]);
        setEngine(new ChessEngine(engine.getFEN()));
        const ngs = engine.getGameState();
        setGameState(ngs);
        if (onMove) onMove({ gameState: ngs });
        return;
      }

      // Select a piece
      if (piece) {
        const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b';
        const shouldShow =
          showPossibleMovesSide === "both" ||
          (showPossibleMovesSide === "white" && pieceColor === 'w') ||
          (showPossibleMovesSide === "black" && pieceColor === 'b');

        if (shouldShow) {
          setSelectedSquare(square);
          try {
            setPossibleMoves(engine.getLegalMoves(square) || []);
          } catch {
            setPossibleMoves([]);
          }
          return;
        }
      }

      setSelectedSquare(null);
      setPossibleMoves([]);
    } else {
      setSelectedSquare(selectedSquare === square ? null : square);
    }

    if (onSquareClick) onSquareClick(square, row, col);
  };

  // ── Square classes ────────────────────────────────────────────────────────

  const getSquareClasses = (row, col) => {
    const square = getSquareNotation(row, col);
    const color = getSquareColor(row, col);
    let classes = `square square-${color}`;

    if (serverControlled) {
      const activeLastMove = lastMove;
      if (activeLastMove && (activeLastMove.from === square || activeLastMove.to === square)) {
        classes += ' last-move';
      }
      if (inCheck && checkedColor) {
        const piece = engine.getPieceAt(square);
        const checkedTurn = checkedColor === 'white' ? 'w' : 'b';
        if (piece && piece.toLowerCase() === 'k' && engine.getPieceColor(piece) === checkedTurn) {
          classes += ' in-check';
        }
      }
    }

    if (enableMoves) {
      if (selectedSquare === square) classes += ' selected';
      if (possibleMoves.includes(square)) {
        classes += engine.getPieceAt(square) ? ' capture' : ' possible-move';
      }
      if (!serverControlled && gameLastMove) {
        if (gameLastMove.from === square || gameLastMove.to === square) classes += ' last-move';
      }
      if (!serverControlled && gameState?.inCheck) {
        const piece = engine.getPieceAt(square);
        if (piece && piece.toLowerCase() === 'k' && engine.getPieceColor(piece) === engine.getTurn()) {
          classes += ' in-check';
        }
      }
    } else if (!serverControlled) {
      if (selectedSquare === square) classes += ' selected';
      if (highlightedSquares.includes(square)) classes += ' highlighted';
      if (lastMove && (lastMove.from === square || lastMove.to === square)) classes += ' last-move';
    }

    // Premove highlights
    if (premoves?.length > 0) {
      for (const pm of premoves) {
        if (pm.from === square) classes += ' premove-from';
        if (pm.to === square) classes += ' premove-to';
      }
    }
    if (premoveSelected === square) classes += ' premove-selected';
    if (premoveMoves.includes(square)) classes += ' premove-possible';

    return classes;
  };

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (enableMoves || serverControlled) {
      const newEngine = new ChessEngine(effectiveFen);
      setEngine(newEngine);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setGameLastMove(null);
      setGameState(newEngine.getGameState());
      setPremoveSelected(null);
      setPremoveMoves([]);
      setPendingPromotion(null);
    }
  }, [effectiveFen, enableMoves, serverControlled]);

  useEffect(() => {
    if (!enableMoves || !engine || serverControlled) return;
    const engineTurn = engine.getTurn();
    const externalTurn = effectiveTurn === 'white' ? 'w' : 'b';
    if (engineTurn !== externalTurn) {
      const newFen = engine.getFEN().replace(/ [wb] /, ` ${externalTurn} `);
      setEngine(new ChessEngine(newFen));
      setGameState(new ChessEngine(newFen).getGameState());
    }
  }, [effectiveTurn, enableMoves, engine, serverControlled]);

  useEffect(() => {
    setParsedArrows(ArrowParser.parse(effectiveArrows));
  }, [effectiveArrows]);

  useEffect(() => {
    if (enableMoves || serverControlled) {
      setBoard(parseFEN(engine.getFEN()));
    } else {
      setBoard(parseFEN(effectiveFen));
    }
  }, [effectiveFen, enableMoves, serverControlled, engine]);

  // ── Render ────────────────────────────────────────────────────────────────

  const displayBoard = orientation === "black"
    ? board.map(row => [...row].reverse()).reverse()
    : board;

  const squareSize = size / 8;

  // Promotion picker geometry
  let promoLeft = 0, promoTop = 0, promoPieces = [], promoGoesDown = true;
  if (pendingPromotion) {
    const toFile = pendingPromotion.to.charCodeAt(0) - 97;
    const isWhitePromo = pendingPromotion.to[1] === '8';
    const displayCol = orientation === "white" ? toFile : (7 - toFile);
    const promoDisplayRow = orientation === "white"
      ? (isWhitePromo ? 0 : 7)
      : (isWhitePromo ? 7 : 0);
    promoGoesDown = promoDisplayRow === 0;
    promoLeft = displayCol * squareSize;
    promoTop = promoGoesDown ? 0 : 4 * squareSize;
    const basePieces = isWhitePromo ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
    promoPieces = promoGoesDown ? basePieces : [...basePieces].reverse();
  }

  return (
    <div className="chessboard-container">
      <div
        className="chessboard"
        style={{ width: size, height: size, fontSize: `${squareSize * 0.6}px` }}
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
                  style={{ width: squareSize, height: squareSize, fontSize: `${squareSize * 0.6}px` }}
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
                  {showCoordinates && (
                    <>
                      {row === 7 && (
                        <span className="coordinate file-coordinate">
                          {String.fromCharCode(97 + actualCol)}
                        </span>
                      )}
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

        {/* Promotion picker */}
        {pendingPromotion && (
          <div className="promotion-overlay" onClick={cancelPromotion}>
            <div
              className="promotion-picker"
              style={{ left: promoLeft, top: promoTop, width: squareSize }}
              onClick={e => e.stopPropagation()}
            >
              {promoPieces.map(p => (
                <div
                  key={p}
                  className="promotion-option"
                  style={{ width: squareSize, height: squareSize }}
                  onClick={() => {
                    const { from, to } = pendingPromotion;
                    setPendingPromotion(null);
                    if (onMove) onMove({ from, to, promotion: p.toLowerCase() });
                  }}
                >
                  <Piece piece={p} size="78%" useImages={usePieceImages} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arrow overlay */}
        {parsedArrows.length > 0 && (
          <svg
            className="arrow-overlay"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
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
