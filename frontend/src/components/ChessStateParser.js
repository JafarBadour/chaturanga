/**
 * ChessStateParser - Utility for parsing chess board state strings
 * 
 * Format: "turn::fen::arrows"
 * Example: "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::e2->e4:blue"
 */

export class ChessStateParser {
  /**
   * Parse a chess state string into its components
   * @param {string} stateString - The state string in format "turn::fen::arrows"
   * @returns {Object} - { turn, fen, arrows }
   */
  static parse(stateString) {
    if (!stateString || typeof stateString !== 'string') {
      return {
        turn: 'white',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        arrows: ''
      };
    }

    const parts = stateString.split('::');
    
    return {
      turn: parts[0] || 'white',
      fen: parts[1] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      arrows: parts[2] || ''
    };
  }

  /**
   * Create a chess state string from components
   * @param {string} turn - "white" or "black"
   * @param {string} fen - FEN string
   * @param {string} arrows - Arrow string
   * @returns {string} - The state string
   */
  static create(turn, fen, arrows = '') {
    return `${turn}::${fen}::${arrows}`;
  }

  /**
   * Update a chess state string with new components
   * @param {string} stateString - Current state string
   * @param {Object} updates - { turn?, fen?, arrows? }
   * @returns {string} - Updated state string
   */
  static update(stateString, updates) {
    const current = this.parse(stateString);
    
    return this.create(
      updates.turn !== undefined ? updates.turn : current.turn,
      updates.fen !== undefined ? updates.fen : current.fen,
      updates.arrows !== undefined ? updates.arrows : current.arrows
    );
  }

  /**
   * Validate a chess state string
   * @param {string} stateString - The state string to validate
   * @returns {boolean} - True if valid
   */
  static validate(stateString) {
    if (!stateString || typeof stateString !== 'string') {
      return false;
    }

    const parts = stateString.split('::');
    
    // Must have exactly 3 parts
    if (parts.length !== 3) {
      return false;
    }

    // Turn must be "white" or "black"
    if (!['white', 'black'].includes(parts[0])) {
      return false;
    }

    // FEN must have 6 parts (board, turn, castling, en passant, halfmove, fullmove)
    const fenParts = parts[1].split(' ');
    if (fenParts.length !== 6) {
      return false;
    }

    return true;
  }

  /**
   * Get examples of chess state strings
   * @returns {Array} - Array of example state strings
   */
  static getExamples() {
    return [
      'white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::',
      'black::rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1::e2->e4:blue',
      'white::r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4::e2->e4:blue\\d7->d5:red',
      'black::8/8/8/8/8/8/4K3/4k3 b - - 0 1::',
      'white::rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3::'
    ];
  }
}

export default ChessStateParser;
