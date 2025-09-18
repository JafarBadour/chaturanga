// ArrowParser.js - Parse arrow strings for chess board arrows

export class ArrowParser {
  /**
   * Parse arrow string into array of arrow objects
   * @param {string} arrowString - String like "a4->e5\e4->e6" or "a4->e5,e4->e6"
   * @returns {Array} Array of arrow objects with from, to, color, etc.
   */
  static parse(arrowString) {
    if (!arrowString || typeof arrowString !== 'string') {
      return [];
    }

    // Split by backslash or comma
    const arrowParts = arrowString.split(/[\\,]/).filter(part => part.trim());
    const arrows = [];

    arrowParts.forEach((part, index) => {
      const arrow = this.parseSingleArrow(part.trim(), index);
      if (arrow) {
        arrows.push(arrow);
      }
    });

    return arrows;
  }

  /**
   * Parse a single arrow string like "a4->e5"
   * @param {string} arrowPart - Single arrow string
   * @param {number} index - Index for default color assignment
   * @returns {Object|null} Arrow object or null if invalid
   */
  static parseSingleArrow(arrowPart, index = 0) {
    // Match pattern: square->square with optional color and thickness
    // Examples: "a4->e5", "a4->e5:red", "a4->e5:blue:3"
    const match = arrowPart.match(/^([a-h][1-8])->([a-h][1-8])(?::([a-zA-Z]+))?(?::(\d+(?:\.\d+)?))?$/);
    
    if (!match) {
      console.warn(`Invalid arrow format: ${arrowPart}`);
      return null;
    }

    const [, from, to, color, thickness] = match;

    // Validate squares
    if (!this.isValidSquare(from) || !this.isValidSquare(to)) {
      console.warn(`Invalid square in arrow: ${arrowPart}`);
      return null;
    }

    // Default colors if not specified
    const defaultColors = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b', '#9775fa'];
    const finalColor = color ? this.parseColor(color) : defaultColors[index % defaultColors.length];
    const finalThickness = thickness ? parseFloat(thickness) : 2;

    return {
      from,
      to,
      color: finalColor,
      thickness: finalThickness,
      opacity: 0.6
    };
  }

  /**
   * Validate if a string is a valid chess square
   * @param {string} square - Square notation like "a4"
   * @returns {boolean} True if valid
   */
  static isValidSquare(square) {
    return /^[a-h][1-8]$/.test(square);
  }

  /**
   * Parse color string to hex color
   * @param {string} colorString - Color name or hex
   * @returns {string} Hex color
   */
  static parseColor(colorString) {
    const colorMap = {
      'red': '#ff6b6b',
      'blue': '#4dabf7',
      'green': '#51cf66',
      'yellow': '#ffd43b',
      'purple': '#9775fa',
      'orange': '#ff922b',
      'pink': '#f783ac',
      'cyan': '#3bc9db',
      'gray': '#868e96',
      'black': '#343a40',
      'white': '#ffffff'
    };

    // If it's already a hex color
    if (colorString.startsWith('#')) {
      return colorString;
    }

    // If it's a named color
    const lowerColor = colorString.toLowerCase();
    return colorMap[lowerColor] || colorMap['red']; // Default to red
  }

  /**
   * Generate arrow string from array of arrows
   * @param {Array} arrows - Array of arrow objects
   * @returns {string} Arrow string
   */
  static stringify(arrows) {
    if (!Array.isArray(arrows) || arrows.length === 0) {
      return '';
    }

    return arrows.map(arrow => {
      let result = `${arrow.from}->${arrow.to}`;
      
      // Add color if not default
      if (arrow.color && arrow.color !== '#ff6b6b') {
        const colorName = this.getColorName(arrow.color);
        if (colorName) {
          result += `:${colorName}`;
        }
      }
      
      // Add thickness if not default
      if (arrow.thickness && arrow.thickness !== 2) {
        result += `:${arrow.thickness}`;
      }
      
      return result;
    }).join('\\');
  }

  /**
   * Get color name from hex color
   * @param {string} hexColor - Hex color
   * @returns {string|null} Color name or null
   */
  static getColorName(hexColor) {
    const colorMap = {
      '#ff6b6b': 'red',
      '#4dabf7': 'blue',
      '#51cf66': 'green',
      '#ffd43b': 'yellow',
      '#9775fa': 'purple',
      '#ff922b': 'orange',
      '#f783ac': 'pink',
      '#3bc9db': 'cyan',
      '#868e96': 'gray',
      '#343a40': 'black',
      '#ffffff': 'white'
    };

    return colorMap[hexColor.toLowerCase()] || null;
  }
}

export default ArrowParser;
