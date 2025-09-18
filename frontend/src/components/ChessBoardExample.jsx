import React, { useState, useEffect } from 'react';
import ChessBoard from './ChessBoard';
import { ChessStateParser } from './ChessStateParser';
import './ChessBoard.css';

const ChessBoardExample = () => {
  const [currentFEN, setCurrentFEN] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [orientation, setOrientation] = useState("black");
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [highlightedSquares, setHighlightedSquares] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [boardSize, setBoardSize] = useState(400);
  const [usePieceImages, setUsePieceImages] = useState(true);
  const [enableMoves, setEnableMoves] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [currentGameState, setCurrentGameState] = useState(null);
  const [arrows, setArrows] = useState("");
  const [arrowThickness, setArrowThickness] = useState(24);
  const [showPossibleMovesSide, setShowPossibleMovesSide] = useState("both");
  const [turn, setTurn] = useState("white");
  const [stateString, setStateString] = useState("");
  const [useStateString, setUseStateString] = useState(false);
  const [currentStateString, setCurrentStateString] = useState("");

  // Predefined arrow examples
  const arrowExamples = {
    "None": "",
    "Single Arrow": "e2->e4",
    "Multiple Arrows": "e2->e4\\d7->d5\\g1->f3",
    "Colored Arrows": "e2->e4:blue\\d7->d5:red\\g1->f3:green",
    "Thick Arrows": "e2->e4:blue:4\\d7->d5:red:3",
    "Complex Example": "e2->e4:blue\\d7->d5:red\\g1->f3:green\\b8->c6:yellow"
  };

  // Predefined state string examples
  const stateStringExamples = {
    "Starting Position": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
    "After e4": "black::rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1::e2->e4:blue",
    "Middle Game": "white::r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4::e2->e4:blue\\d7->d5:red",
    "Endgame": "black::8/8/8/8/8/8/4K3/4k3 b - - 0 1::",
    "Check Position": "white::rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3::"
  };

  // Predefined positions
  const positions = {
    "Starting Position": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "Custom Position": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4",
    "Endgame": "8/8/8/8/8/8/4K3/4k3 w - - 0 1",
    "Checkmate": "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
    "Castling": "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
    "En Passant Setup": "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
    "Checkmate Test": "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
    "Check Test": "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    "Clear Check": "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 2"
  };

  // Handle square click
  const handleSquareClick = (square, row, col) => {
    console.log(`Clicked square: ${square} (row: ${row}, col: ${col})`);
    
    // Example: Highlight some squares
    const newHighlighted = highlightedSquares.includes(square) 
      ? highlightedSquares.filter(s => s !== square)
      : [...highlightedSquares, square];
    
    setHighlightedSquares(newHighlighted);
  };

  // Handle position change
  const handlePositionChange = (positionName) => {
    setCurrentFEN(positions[positionName]);
    setHighlightedSquares([]);
    setLastMove(null);
    setArrows(""); // Clear arrows when changing position
  };

  // Update current state string
  const updateCurrentStateString = () => {
    const currentFen = currentGameState ? currentGameState.fen : currentFEN;
    const currentTurn = currentGameState ? (currentGameState.turn === 'w' ? 'white' : 'black') : turn;
    const newStateString = ChessStateParser.create(currentTurn, currentFen, arrows);
    setCurrentStateString(newStateString);
  };

  // Handle move
  const handleMove = (moveResult) => {
    console.log('Move made:', moveResult);
    setLastMove({ from: moveResult.from, to: moveResult.to });
    if (moveResult.gameState) {
      setCurrentGameState(moveResult.gameState);
      // Update turn based on game state
      setTurn(moveResult.gameState.turn === 'w' ? 'white' : 'black');
    }
  };

  // Handle game state change (not used anymore)
  const handleGameStateChange = (newGameState) => {
    setGameState(newGameState);
  };

  // Update state string whenever relevant state changes
  useEffect(() => {
    updateCurrentStateString();
  }, [currentGameState, currentFEN, turn, arrows]);

  // Initialize state string on component mount
  useEffect(() => {
    updateCurrentStateString();
  }, []);

  // Copy state string to clipboard
  const copyStateString = () => {
    navigator.clipboard.writeText(currentStateString).then(() => {
      alert('State string copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Handle orientation flip
  const toggleOrientation = () => {
    setOrientation(orientation === "white" ? "black" : "white");
  };

  // Handle board size change
  const handleSizeChange = (newSize) => {
    setBoardSize(newSize);
  };

  return (
    <div className="chessboard-example">
      <h1>♟️ Chess Board Component</h1>
      <p>Interactive chessboard with Lichess-style design</p>
      
      <div className="controls">
        <div className="control-group">
          <label>Position:</label>
          <select 
            value={Object.keys(positions).find(key => positions[key] === currentFEN) || "Starting Position"}
            onChange={(e) => handlePositionChange(e.target.value)}
          >
            {Object.keys(positions).map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Orientation:</label>
          <button onClick={toggleOrientation}>
            {orientation === "white" ? "White" : "Black"}
          </button>
        </div>

        <div className="control-group">
          <label>Show Coordinates:</label>
          <input 
            type="checkbox" 
            checked={showCoordinates}
            onChange={(e) => setShowCoordinates(e.target.checked)}
          />
        </div>

        <div className="control-group">
          <label>Board Size:</label>
          <input 
            type="range" 
            min="200" 
            max="600" 
            value={boardSize}
            onChange={(e) => handleSizeChange(parseInt(e.target.value))}
          />
          <span>{boardSize}px</span>
        </div>

        <div className="control-group">
          <label>Arrow Thickness:</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={arrowThickness}
            onChange={(e) => setArrowThickness(parseInt(e.target.value))}
          />
          <span>{arrowThickness}px</span>
        </div>

        <div className="control-group">
          <label>Show Moves For:</label>
          <select 
            value={showPossibleMovesSide}
            onChange={(e) => setShowPossibleMovesSide(e.target.value)}
          >
            <option value="both">Both Sides</option>
            <option value="white">White Only</option>
            <option value="black">Black Only</option>
          </select>
        </div>

        <div className="control-group">
          <label>Current Turn:</label>
          <select 
            value={turn}
            onChange={(e) => setTurn(e.target.value)}
          >
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </div>

        <div className="control-group">
          <label>Use State String:</label>
          <input 
            type="checkbox" 
            checked={useStateString}
            onChange={(e) => setUseStateString(e.target.checked)}
          />
        </div>

        {useStateString && (
          <>
            <div className="control-group">
              <label>State String Examples:</label>
              <select 
                value={stateString}
                onChange={(e) => setStateString(e.target.value)}
              >
                {Object.entries(stateStringExamples).map(([name, value]) => (
                  <option key={name} value={value}>{name}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label>Custom State String:</label>
              <input 
                type="text" 
                placeholder="white::fen::arrows"
                value={stateString}
                onChange={(e) => setStateString(e.target.value)}
                style={{ width: '400px' }}
              />
            </div>
          </>
        )}

        <div className="control-group">
          <label>Use Piece Images:</label>
          <input 
            type="checkbox" 
            checked={usePieceImages}
            onChange={(e) => setUsePieceImages(e.target.checked)}
          />
        </div>

        <div className="control-group">
          <label>Enable Moves:</label>
          <input 
            type="checkbox" 
            checked={enableMoves}
            onChange={(e) => setEnableMoves(e.target.checked)}
          />
        </div>

        <div className="control-group">
          <label>Arrow Examples:</label>
          <select 
            value={arrows}
            onChange={(e) => setArrows(e.target.value)}
          >
            {Object.entries(arrowExamples).map(([name, value]) => (
              <option key={name} value={value}>{name}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Custom Arrows:</label>
          <input 
            type="text" 
            placeholder="e.g., e2->e4\e7->e5"
            value={arrows}
            onChange={(e) => setArrows(e.target.value)}
            style={{ width: '200px' }}
          />
        </div>

        <div className="control-group">
          <button onClick={() => setHighlightedSquares([])}>
            Clear Highlights
          </button>
        </div>
      </div>

      <div className="board-container">
        <ChessBoard
          fen={currentFEN}
          orientation={orientation}
          showCoordinates={showCoordinates}
          onSquareClick={handleSquareClick}
          highlightedSquares={highlightedSquares}
          lastMove={lastMove}
          size={boardSize}
          usePieceImages={usePieceImages}
          enableMoves={enableMoves}
          onMove={handleMove}
          arrows={arrows}
          arrowThickness={arrowThickness}
          showPossibleMovesSide={showPossibleMovesSide}
          turn={turn}
          stateString={useStateString ? stateString : null}
        />
      </div>

      <div className="info">
        <h3>Current State String:</h3>
        <div style={{ marginBottom: '20px' }}>
          <code style={{ 
            display: 'block', 
            wordBreak: 'break-all', 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            fontSize: '12px',
            marginBottom: '10px'
          }}>
            {currentStateString}
          </code>
          <button 
            onClick={copyStateString}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Copy State String
          </button>
        </div>
        
        <h3>Current FEN:</h3>
        <code>{gameState ? gameState.fen : currentFEN}</code>
        
        {enableMoves && (
          <>
            <h3>Game State:</h3>
            <p><strong>Moves Enabled:</strong> Click on pieces to see legal moves</p>
            <p><strong>Instructions:</strong> Select a piece to see possible moves, then click on a highlighted square to move</p>
            <p><strong>Show Moves For:</strong> Use the dropdown to control which side's moves are shown - "Both Sides", "White Only", or "Black Only"</p>
            <p><strong>Current Turn:</strong> Use the dropdown to set whose turn it is - this affects move validation and game flow</p>
            <p><strong>State String:</strong> Use the "Use State String" checkbox to control the board with a single string in format "turn::fen::arrows"</p>
            <p><strong>En Passant:</strong> Try the "En Passant Setup" position - move the white pawn from e5 to e6, then the black pawn on d5 can capture en passant!</p>
            <p><strong>Check Behavior:</strong> Try the "Check Test" position - when the king is in check, only moves that get the king out of check will be highlighted!</p>
            <p><strong>Arrows:</strong> Use the arrow examples or create custom arrows like "e2->e4:blue" for game analysis!</p>
            
            {currentGameState && (
              <>
                <h3>Game Status:</h3>
                <p><strong>Turn:</strong> {currentGameState.turn === 'w' ? 'White' : 'Black'}</p>
                {currentGameState.inCheck && (
                  <p style={{ color: 'red', fontWeight: 'bold' }}>⚠️ {currentGameState.turn === 'w' ? 'White' : 'Black'} King is in CHECK!</p>
                )}
                {currentGameState.checkmate && (
                  <p style={{ color: 'red', fontWeight: 'bold' }}>🏁 CHECKMATE! {currentGameState.turn === 'w' ? 'Black' : 'White'} wins!</p>
                )}
                {currentGameState.stalemate && (
                  <p style={{ color: 'orange', fontWeight: 'bold' }}>🤝 STALEMATE! Game is a draw!</p>
                )}
                <p><strong>Moves Made:</strong> {currentGameState.moveHistory.length}</p>
                {currentGameState.moveHistory.length > 0 && (
                  <p><strong>Last Move:</strong> {currentGameState.moveHistory[currentGameState.moveHistory.length - 1].from} → {currentGameState.moveHistory[currentGameState.moveHistory.length - 1].to}</p>
                )}
              </>
            )}
          </>
        )}
        
        <h3>Features:</h3>
        <ul>
          <li>✅ Lichess-style board colors</li>
          <li>✅ SVG chess piece images</li>
          <li>✅ Unicode piece fallback</li>
          <li>✅ Square coordinates</li>
          <li>✅ Click to select squares</li>
          <li>✅ Highlighted squares</li>
          <li>✅ Board orientation flip</li>
          <li>✅ Piece movement and legal moves</li>
          <li>✅ Move validation and game state</li>
          <li>✅ En passant captures</li>
          <li>✅ Double pawn moves</li>
          <li>✅ Check detection</li>
          <li>✅ Checkmate validation</li>
          <li>✅ Stalemate detection</li>
          <li>✅ Move validation (prevents illegal moves)</li>
          <li>✅ Side-specific move display (white/black/both)</li>
          <li>✅ State string format ("turn::fen::arrows")</li>
          <li>✅ Arrow rendering for game analysis</li>
          <li>✅ Customizable arrow colors and thickness</li>
          <li>✅ Multiple arrow support</li>
          <li>✅ Responsive design</li>
          <li>✅ Accessibility support</li>
        </ul>

        <h3>Usage:</h3>
        <pre>{`import ChessBoard from './ChessBoard';

<ChessBoard
  fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  orientation="white"
  showCoordinates={true}
  onSquareClick={(square, row, col) => console.log(square)}
  highlightedSquares={['e4', 'd5']}
  size={400}
  usePieceImages={true}
  enableMoves={true}
  onMove={(moveResult) => console.log('Move:', moveResult)}
  arrows="e2->e4:blue\\d7->d5:red"
/>`}</pre>

        <h3>Arrow Format:</h3>
        <pre>{`// Basic arrow
"e2->e4"

// Multiple arrows (separated by backslash)
"e2->e4\\d7->d5\\g1->f3"

// Colored arrows
"e2->e4:blue\\d7->d5:red"

// Thick arrows
"e2->e4:blue:4\\d7->d5:red:3"

// Available colors: red, blue, green, yellow, purple, orange, pink, cyan, gray, black, white`}</pre>
      </div>
    </div>
  );
};

export default ChessBoardExample;
