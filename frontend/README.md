# ♟️ Chess Board React Component

A beautiful, interactive chessboard component built with React, styled to match Lichess's design aesthetic.

## ✨ Features

- **🎨 Lichess-style Design**: Beautiful board colors and piece rendering
- **♟️ SVG Chess Pieces**: High-quality piece images with Unicode fallback
- **📐 Square Coordinates**: Optional file/rank labels (a-h, 1-8)
- **🖱️ Interactive**: Click to select squares, hover effects
- **🔄 Orientation**: Flip board for black's perspective
- **🎯 Highlighting**: Highlight legal moves, last move, etc.
- **📱 Responsive**: Works on desktop and mobile
- **♿ Accessible**: Keyboard navigation and high contrast support
- **⚡ Lightweight**: No external dependencies beyond React

## 🚀 Quick Start

### Option 1: Full React App
1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Run the setup script**:
   ```bash
   ./setup.sh
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

### Option 2: Quick Demo
1. **Open the demo file** directly in your browser:
   ```bash
   open frontend/demo.html
   ```

### Option 3: Use as Component
1. **Include the files** in your React project:
   - `src/components/ChessBoard.jsx` - Main component
   - `src/components/ChessBoard.css` - Styling
   - `src/components/ChessBoardExample.jsx` - Usage example

2. **Import and use**:
```jsx
import ChessBoard from './ChessBoard';
import './ChessBoard.css';

function App() {
  return (
    <ChessBoard
      fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      orientation="white"
      showCoordinates={true}
      onSquareClick={(square) => console.log(square)}
      size={400}
      usePieceImages={true}
    />
  );
}
```

## 📖 Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fen` | string | Starting position | FEN string of the position |
| `orientation` | "white" \| "black" | "white" | Board orientation |
| `showCoordinates` | boolean | true | Show file/rank labels |
| `onSquareClick` | function | null | Callback when square is clicked |
| `highlightedSquares` | string[] | [] | Array of squares to highlight |
| `lastMove` | object | null | `{from: "e2", to: "e4"}` for last move |
| `size` | number | 400 | Board size in pixels |
| `usePieceImages` | boolean | true | Use SVG images or Unicode symbols |

## 🎮 Interactive Features

### Square Click Handler
```jsx
const handleSquareClick = (square, row, col) => {
  console.log(`Clicked: ${square} (row: ${row}, col: ${col})`);
  // square: "e4", row: 4, col: 4
};
```

### Highlighting Squares
```jsx
const [highlightedSquares, setHighlightedSquares] = useState(['e4', 'd5']);

<ChessBoard
  highlightedSquares={highlightedSquares}
  // ... other props
/>
```

### Last Move Indicator
```jsx
const lastMove = { from: "e2", to: "e4" };

<ChessBoard
  lastMove={lastMove}
  // ... other props
/>
```

## 🎨 Styling

The component uses CSS classes for easy customization:

- `.square-light` / `.square-dark` - Square colors
- `.square.selected` - Selected square
- `.square.highlighted` - Highlighted squares
- `.square.last-move` - Last move squares
- `.piece` - Chess pieces
- `.coordinate` - File/rank labels

## 📱 Responsive Design

The board automatically scales on mobile devices and includes:
- Touch-friendly square sizes
- Reduced coordinate font sizes
- Optimized hover effects

## ♿ Accessibility

- **Keyboard Navigation**: Tab through squares
- **High Contrast**: Supports `prefers-contrast: high`
- **Reduced Motion**: Respects `prefers-reduced-motion`
- **Screen Reader**: Semantic HTML structure

## 🔧 Customization

### Custom Colors
```css
.square-light {
  background-color: #your-light-color;
}

.square-dark {
  background-color: #your-dark-color;
}
```

### Custom Pieces
Replace the `UnicodePieces` object with your own piece symbols or images.

### Custom Size
```jsx
<ChessBoard size={600} /> {/* 600px board */}
```

## 📋 FEN Examples

```javascript
const positions = {
  "Starting": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "Custom": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4",
  "Endgame": "8/8/8/8/8/8/4K3/4k3 w - - 0 1",
  "Checkmate": "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"
};
```

## 🎯 Use Cases

- **Chess Games**: Interactive game interfaces
- **Puzzle Solving**: Chess puzzle applications
- **Analysis**: Position analysis tools
- **Education**: Chess learning platforms
- **Tournaments**: Live game displays

## 🚀 Live Demo

Open `index.html` in your browser to see the component in action with:
- Multiple predefined positions
- Interactive controls
- Real-time customization
- Usage examples

## 📄 License

MIT License - feel free to use in your projects!

---

**Happy coding!** ♟️✨
