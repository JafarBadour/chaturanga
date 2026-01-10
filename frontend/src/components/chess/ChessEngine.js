// ChessEngine.js - Chess game logic and move validation

export class ChessEngine {
  constructor(fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
    this.board = this.parseFEN(fen);
    this.turn = 'w'; // 'w' for white, 'b' for black
    this.castlingRights = 'KQkq';
    this.enPassant = null;
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.moveHistory = [];
    this.updateFromFEN(fen);
  }

  // Parse FEN string into board array
  parseFEN(fen) {
    const parts = fen.split(' ');
    const piecePlacement = parts[0];
    const ranks = piecePlacement.split('/');
    
    const board = [];
    ranks.forEach(rank => {
      const rankArray = [];
      for (let char of rank) {
        if (isNaN(char)) {
          rankArray.push(char);
        } else {
          for (let i = 0; i < parseInt(char); i++) {
            rankArray.push(null);
          }
        }
      }
      board.push(rankArray);
    });
    
    return board;
  }

  // Update engine state from FEN
  updateFromFEN(fen) {
    const parts = fen.split(' ');
    this.board = this.parseFEN(fen);
    this.turn = parts[1] || 'w';
    this.castlingRights = parts[2] || 'KQkq';
    this.enPassant = parts[3] === '-' ? null : parts[3];
    this.halfmoveClock = parseInt(parts[4]) || 0;
    this.fullmoveNumber = parseInt(parts[5]) || 1;
  }

  // Convert board to FEN string
  toFEN() {
    let fen = '';
    
    // Piece placement
    for (let rank of this.board) {
      let emptyCount = 0;
      for (let square of rank) {
        if (square === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += square;
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      fen += '/';
    }
    fen = fen.slice(0, -1); // Remove trailing slash
    
    // Add other FEN parts
    fen += ` ${this.turn} ${this.castlingRights} ${this.enPassant || '-'} ${this.halfmoveClock} ${this.fullmoveNumber}`;
    
    return fen;
  }

  // Get piece at square
  getPieceAt(square) {
    const { row, col } = this.squareToCoords(square);
    return this.board[row][col];
  }

  // Convert square notation to coordinates
  squareToCoords(square) {
    const file = square.charCodeAt(0) - 97; // a=0, b=1, etc.
    const rank = 8 - parseInt(square[1]); // 8=0, 7=1, etc.
    return { row: rank, col: file };
  }

  // Convert coordinates to square notation
  coordsToSquare(row, col) {
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    return file + rank;
  }

  // Check if square is on board
  isOnBoard(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  // Get all legal moves for a piece at a square
  getLegalMoves(square) {
    const piece = this.getPieceAt(square);
    if (!piece) return [];
    
    const { row, col } = this.squareToCoords(square);
    const moves = [];
    
    // Check if it's the piece's turn
    const pieceColor = piece === piece.toUpperCase() ? 'w' : 'b';
    if (pieceColor !== this.turn) return moves;
    
    const pieceType = piece.toLowerCase();
    
    switch (pieceType) {
      case 'p':
        moves.push(...this.getPawnMoves(row, col, piece));
        break;
      case 'r':
        moves.push(...this.getRookMoves(row, col, piece));
        break;
      case 'n':
        moves.push(...this.getKnightMoves(row, col, piece));
        break;
      case 'b':
        moves.push(...this.getBishopMoves(row, col, piece));
        break;
      case 'q':
        moves.push(...this.getQueenMoves(row, col, piece));
        break;
      case 'k':
        moves.push(...this.getKingMoves(row, col, piece));
        break;
    }
    
    // Filter moves based on check status
    if (this.isInCheck()) {
      // When in check, only show moves that get the king out of check
      return moves.filter(move => this.wouldGetOutOfCheck(square, move));
    } else {
      // When not in check, filter out moves that would put own king in check
      return moves.filter(move => !this.wouldBeInCheck(square, move));
    }
  }

  // Pawn moves
  getPawnMoves(row, col, piece) {
    const moves = [];
    const isWhite = piece === piece.toUpperCase();
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;
    
    // Forward move
    if (this.isOnBoard(row + direction, col) && this.board[row + direction][col] === null) {
      moves.push(this.coordsToSquare(row + direction, col));
      
      // Double move from starting position
      if (row === startRow && this.board[row + 2 * direction][col] === null) {
        moves.push(this.coordsToSquare(row + 2 * direction, col));
      }
    }
    
    // Diagonal captures
    for (const colOffset of [-1, 1]) {
      const newRow = row + direction;
      const newCol = col + colOffset;
      
      if (this.isOnBoard(newRow, newCol)) {
        const targetPiece = this.board[newRow][newCol];
        if (targetPiece && (targetPiece === targetPiece.toUpperCase()) !== isWhite) {
          moves.push(this.coordsToSquare(newRow, newCol));
        }
        
        // En passant
        if (this.enPassant === this.coordsToSquare(newRow, newCol)) {
          moves.push(this.coordsToSquare(newRow, newCol));
        }
      }
    }
    
    return moves;
  }

  // new helper for pawn attack squares
  getPawnAttackSquares(row, col, piece) {
    const attacks = []
    const isWhite = piece === piece.toUpperCase()
    const direction = isWhite ? -1 : 1

    for (const dc of [-1, 1]) {
      const r = row + direction
      const c = col + dc

      if (this.isOnBoard(r, c)) {
        attacks.push(this.coordsToSquare(r, c))
      }
    }
    return attacks
  }

  // Rook moves
  getRookMoves(row, col, piece) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dRow, dCol] of directions) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + dRow * i;
        const newCol = col + dCol * i;
        
        if (!this.isOnBoard(newRow, newCol)) break;
        
        const targetPiece = this.board[newRow][newCol];
        if (targetPiece === null) {
          moves.push(this.coordsToSquare(newRow, newCol));
        } else {
          if ((targetPiece === targetPiece.toUpperCase()) !== (piece === piece.toUpperCase())) {
            moves.push(this.coordsToSquare(newRow, newCol));
          }
          break;
        }
      }
    }
    
    return moves;
  }

  // Knight moves
  getKnightMoves(row, col, piece) {
    const moves = [];
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dRow, dCol] of knightMoves) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (this.isOnBoard(newRow, newCol)) {
        const targetPiece = this.board[newRow][newCol];
        if (targetPiece === null || (targetPiece === targetPiece.toUpperCase()) !== (piece === piece.toUpperCase())) {
          moves.push(this.coordsToSquare(newRow, newCol));
        }
      }
    }
    
    return moves;
  }

  // Bishop moves
  getBishopMoves(row, col, piece) {
    const moves = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    
    for (const [dRow, dCol] of directions) {
      for (let i = 1; i < 8; i++) {
        const newRow = row + dRow * i;
        const newCol = col + dCol * i;
        
        if (!this.isOnBoard(newRow, newCol)) break;
        
        const targetPiece = this.board[newRow][newCol];
        if (targetPiece === null) {
          moves.push(this.coordsToSquare(newRow, newCol));
        } else {
          if ((targetPiece === targetPiece.toUpperCase()) !== (piece === piece.toUpperCase())) {
            moves.push(this.coordsToSquare(newRow, newCol));
          }
          break;
        }
      }
    }
    
    return moves;
  }

  // Queen moves (combination of rook and bishop)
  getQueenMoves(row, col, piece) {
    return [...this.getRookMoves(row, col, piece), ...this.getBishopMoves(row, col, piece)];
  }

  // King moves
  getKingMoves(row, col, piece) {
    const moves = [];
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];
    
    for (const [dRow, dCol] of directions) {
      const newRow = row + dRow;
      const newCol = col + dCol;
      
      if (this.isOnBoard(newRow, newCol)) {
        const targetPiece = this.board[newRow][newCol];
        if (targetPiece === null || (targetPiece === targetPiece.toUpperCase()) !== (piece === piece.toUpperCase())) {
          moves.push(this.coordsToSquare(newRow, newCol));
        }
      }
    }
    
    // Castling (simplified - would need more complex logic for full implementation)
    // This is a basic implementation
    
    return moves;
  }

  // Get raw moves for a piece without check validation (used for attack detection)
  getRawMoves(square) {
    const piece = this.getPieceAt(square);
    if (!piece) return [];
    
    const { row, col } = this.squareToCoords(square);
    const moves = [];
    
    const pieceType = piece.toLowerCase();
    
    switch (pieceType) {
      case 'p':
        moves.push(...this.getPawnAttackSquares(row, col, piece));
        break;
      case 'r':
        moves.push(...this.getRookMoves(row, col, piece));
        break;
      case 'n':
        moves.push(...this.getKnightMoves(row, col, piece));
        break;
      case 'b':
        moves.push(...this.getBishopMoves(row, col, piece));
        break;
      case 'q':
        moves.push(...this.getQueenMoves(row, col, piece));
        break;
      case 'k':
        moves.push(...this.getKingMoves(row, col, piece));
        break;
    }
    
    return moves;
  }

  // Check if a square is under attack by the opponent
  isSquareUnderAttack(square, attackingColor) {
    // Check all opponent pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.getPieceColor(piece) === attackingColor) {
          const rawMoves = this.getRawMoves(this.coordsToSquare(r, c));
          if (rawMoves.includes(square)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if the current player's king is in check
  isInCheck() {
    const kingSquare = this.findKing(this.turn);
    if (!kingSquare) return false;
    
    const opponentColor = this.turn === 'w' ? 'b' : 'w';
    return this.isSquareUnderAttack(kingSquare, opponentColor);
  }

  // Find the king of the specified color
  findKing(color) {
    const king = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === king) {
          return this.coordsToSquare(r, c);
        }
      }
    }
    return null;
  }

  // Get the color of a piece
  getPieceColor(piece) {
    return piece === piece.toUpperCase() ? 'w' : 'b';
  }

  // Get all pieces attacking a square (for debugging)
  getAttackingPieces(square, attackingColor) {
    const attackers = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.getPieceColor(piece) === attackingColor) {
          const rawMoves = this.getRawMoves(this.coordsToSquare(r, c));
          if (rawMoves.includes(square)) {
            attackers.push({
              piece,
              square: this.coordsToSquare(r, c),
              moves: rawMoves
            });
          }
        }
      }
    }
    return attackers;
  }

  // Check if a move would put own king in check
  wouldBeInCheck(from, to) {
    // Make a temporary move
    const { row: fromRow, col: fromCol } = this.squareToCoords(from);
    const { row: toRow, col: toCol } = this.squareToCoords(to);
    
    const originalPiece = this.board[fromRow][fromCol];
    const capturedPiece = this.board[toRow][toCol];
    
    // Make the move
    this.board[toRow][toCol] = originalPiece;
    this.board[fromRow][fromCol] = null;
    
    // Check if king is in check
    const inCheck = this.isInCheck();
    
    // Undo the move
    this.board[fromRow][fromCol] = originalPiece;
    this.board[toRow][toCol] = capturedPiece;
    
    return inCheck;
  }

  // Check if a move would get the king out of check
  wouldGetOutOfCheck(from, to) {
    // Make a temporary move
    const { row: fromRow, col: fromCol } = this.squareToCoords(from);
    const { row: toRow, col: toCol } = this.squareToCoords(to);
    
    const originalPiece = this.board[fromRow][fromCol];
    const capturedPiece = this.board[toRow][toCol];
    
    // Make the move
    this.board[toRow][toCol] = originalPiece;
    this.board[fromRow][fromCol] = null;
    
    // Check if king is still in check after the move
    const stillInCheck = this.isInCheck();
    
    // Undo the move
    this.board[fromRow][fromCol] = originalPiece;
    this.board[toRow][toCol] = capturedPiece;
    
    // Return true if the move gets the king out of check
    return !stillInCheck;
  }

  // Make a move
  makeMove(from, to) {
    const { row: fromRow, col: fromCol } = this.squareToCoords(from);
    const { row: toRow, col: toCol } = this.squareToCoords(to);
    
    const piece = this.board[fromRow][fromCol];
    let capturedPiece = this.board[toRow][toCol];
    let enPassantCapture = null;
    
    // Check for en passant capture
    if (piece.toLowerCase() === 'p' && to === this.enPassant) {
      // Remove the captured pawn (it's behind the destination square)
      const capturedRow = this.turn === 'w' ? toRow + 1 : toRow - 1;
      enPassantCapture = this.board[capturedRow][toCol];
      this.board[capturedRow][toCol] = null;
    }
    
    // Make the move
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;
    
    // Update en passant target for double pawn moves
    let newEnPassant = null;
    if (piece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
      // Pawn made a double move, set en passant target


      // const enPassantRow = this.turn === 'w' ? toRow + 1 : toRow - 1;

      const enPassantRow = (fromRow + toRow) / 2
       newEnPassant = this.coordsToSquare(enPassantRow, toCol);
    }
    
    // Update game state
    this.turn = this.turn === 'w' ? 'b' : 'w';
    if (this.turn === 'w') {
      this.fullmoveNumber++;
    }
    
    // Update en passant target
    this.enPassant = newEnPassant;
    
    // Update halfmove clock
    if (piece.toLowerCase() === 'p' || capturedPiece || enPassantCapture) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }
    
    // Store move in history
    this.moveHistory.push({
      from,
      to,
      piece,
      capturedPiece: capturedPiece || enPassantCapture,
      enPassantCapture,
      fen: this.toFEN()
    });
    
    return {
      from,
      to,
      piece,
      capturedPiece: capturedPiece || enPassantCapture,
      enPassantCapture,
      fen: this.toFEN()
    };
  }

  // Get current FEN
  getFEN() {
    return this.toFEN();
  }

  // Get current turn
  getTurn() {
    return this.turn;
  }

  // Get move history
  getMoveHistory() {
    return this.moveHistory;
  }

  // Get current en passant target
  getEnPassantTarget() {
    return this.enPassant;
  }

  // Check if the current player has any legal moves
  hasLegalMoves() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.getPieceColor(piece) === this.turn) {
          const square = this.coordsToSquare(r, c);
          const legalMoves = this.getLegalMoves(square);
          if (legalMoves.length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if the current position is checkmate
  isCheckmate() {
    return this.isInCheck() && !this.hasLegalMoves();
  }

  // Check if the current position is stalemate
  isStalemate() {
    return !this.isInCheck() && !this.hasLegalMoves();
  }

  // Get game state
  getGameState() {
    const inCheck = this.isInCheck();
    const checkmate = this.isCheckmate();
    const stalemate = this.isStalemate();
    
    return {
      fen: this.toFEN(),
      turn: this.turn,
      castlingRights: this.castlingRights,
      enPassant: this.enPassant,
      halfmoveClock: this.halfmoveClock,
      fullmoveNumber: this.fullmoveNumber,
      moveHistory: this.moveHistory,
      inCheck,
      checkmate,
      stalemate,
      gameOver: checkmate || stalemate
    };
  }
}
