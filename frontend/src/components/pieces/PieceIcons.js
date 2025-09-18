// PieceIcons.js - Chess piece definitions and utilities

// SVG piece image paths
export const PieceImages = {
  // White pieces
  'K': '/pieces/king-w.svg',
  'Q': '/pieces/queen-w.svg', 
  'R': '/pieces/rook-w.svg',
  'B': '/pieces/bishop-w.svg',
  'N': '/pieces/knight-w.svg',
  'P': '/pieces/pawn-w.svg',
  // Black pieces  
  'k': '/pieces/king-b.svg',
  'q': '/pieces/queen-b.svg',
  'r': '/pieces/rook-b.svg',
  'b': '/pieces/bishop-b.svg',
  'n': '/pieces/knight-b.svg',
  'p': '/pieces/pawn-b.svg'
};

// Unicode chess piece symbols (fallback)
export const UnicodePieces = {
  // White pieces
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  // Black pieces  
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Piece names for accessibility
export const PieceNames = {
  'K': 'White King', 'Q': 'White Queen', 'R': 'White Rook', 
  'B': 'White Bishop', 'N': 'White Knight', 'P': 'White Pawn',
  'k': 'Black King', 'q': 'Black Queen', 'r': 'Black Rook', 
  'b': 'Black Bishop', 'n': 'Black Knight', 'p': 'Black Pawn'
};

// Piece values (for evaluation)
export const PieceValues = {
  'K': 0, 'Q': 9, 'R': 5, 'B': 3, 'N': 3, 'P': 1,
  'k': 0, 'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1
};

// Get piece image path
export const getPieceImage = (piece) => {
  return PieceImages[piece] || null;
};

// Get piece symbol (Unicode fallback)
export const getPieceSymbol = (piece) => {
  return UnicodePieces[piece] || null;
};

// Get piece name for accessibility
export const getPieceName = (piece) => {
  return PieceNames[piece] || 'Unknown Piece';
};

// Get piece value
export const getPieceValue = (piece) => {
  return PieceValues[piece] || 0;
};

// Check if piece is white
export const isWhitePiece = (piece) => {
  return piece && piece === piece.toUpperCase();
};

// Check if piece is black
export const isBlackPiece = (piece) => {
  return piece && piece === piece.toLowerCase();
};

// Get piece color
export const getPieceColor = (piece) => {
  if (isWhitePiece(piece)) return 'white';
  if (isBlackPiece(piece)) return 'black';
  return null;
};

// Get piece type (without color)
export const getPieceType = (piece) => {
  return piece ? piece.toLowerCase() : null;
};
