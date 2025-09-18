# Chess Analysis API

A FastAPI backend service that provides chess position analysis using the Stockfish engine.

## Features

- **Complete Board Analysis**: Analyze all possible moves with their advantages
- **Best Move Analysis**: Get the best move for any position
- **State String Support**: Accept chess positions in the format `"turn::fen::arrows"`
- **Stockfish Integration**: Powered by the Stockfish chess engine
- **RESTful API**: Clean HTTP endpoints with JSON responses

## Prerequisites

1. **Python 3.8+**
2. **Stockfish Engine**: Download and install Stockfish from [stockfishchess.org](https://stockfishchess.org/download/)

### Installing Stockfish

#### macOS (using Homebrew)
```bash
brew install stockfish
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install stockfish
```

#### Windows
1. Download from [stockfishchess.org](https://stockfishchess.org/download/)
2. Extract and place `stockfish.exe` in your project directory or add to PATH

## Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Running the API

### Development Mode
```bash
python main.py
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### 1. Root Endpoint
```
GET /
```
Returns API information and available endpoints.

### 2. Health Check
```
GET /health
```
Check if the API and Stockfish engine are running properly.

### 3. Complete Board Analysis
```
POST /analyze
```

**Request Body:**
```json
{
  "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
  "time_limit": 1.0
}
```

**Response:**
```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "turn": "white",
  "total_moves": 20,
  "moves": [
    {
      "move": "e2e4",
      "white_advantage": 0.25,
      "is_mate": false,
      "mate_in": null,
      "best_response": "e7e5",
      "depth_reached": 15,
      "nodes_searched": 12345
    }
  ],
  "best_move": "e2e4",
  "advantage": 0.25,
  "is_mate": false,
  "mate_in": null,
  "principal_variation": ["e2e4", "e7e5", "g1f3"]
}
```

### 4. Best Move Only
```
POST /best-move
```

**Request Body:**
```json
{
  "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
  "time_limit": 1.0
}
```

**Response:**
```json
{
  "best_move": "e2e4",
  "advantage": 0.25,
  "is_mate": false,
  "mate_in": null,
  "depth_reached": 15,
  "nodes_searched": 12345,
  "principal_variation": ["e2e4", "e7e5", "g1f3"]
}
```

## State String Format

The API accepts chess positions in the following format:
```
"turn::fen::arrows"
```

### Examples:
- **Starting position (white to move):**
  ```
  "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
  ```

- **After e4 (black to move):**
  ```
  "black::rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1::e2->e4:blue"
  ```

- **Middle game position:**
  ```
  "white::r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4::e2->e4:blue\\d7->d5:red"
  ```

## Parameters

### Request Parameters:
- **`state_string`** (required): Chess position in the format described above
- **`time_limit`** (optional): Analysis time in seconds (default: 1.0)

### Response Fields:
- **`fen`**: FEN notation of the position
- **`turn`**: Whose turn it is ("white" or "black")
- **`total_moves`**: Number of legal moves available
- **`moves`**: Array of all possible moves with their advantages
- **`best_move`**: The best move in algebraic notation
- **`advantage`**: White's advantage in pawns (positive = white better, negative = black better)
- **`is_mate`**: Whether the position is checkmate
- **`mate_in`**: Number of moves to mate (if applicable)
- **`principal_variation`**: Best continuation of moves

## Error Handling

The API returns appropriate HTTP status codes:
- **200**: Success
- **400**: Bad Request (invalid state string format)
- **500**: Internal Server Error (Stockfish not found, analysis failed)

## Example Usage

### Using curl:
```bash
# Complete analysis
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
    "time_limit": 2.0
  }'

# Best move only
curl -X POST "http://localhost:8000/best-move" \
  -H "Content-Type: application/json" \
  -d '{
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
  }'
```

### Using Python requests:
```python
import requests

# Complete analysis
response = requests.post("http://localhost:8000/analyze", json={
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
    "time_limit": 1.0
})
analysis = response.json()

# Best move only
response = requests.post("http://localhost:8000/best-move", json={
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
})
best_move = response.json()
```

## API Documentation

Once the server is running, you can access:
- **Interactive API docs**: `http://localhost:8000/docs`
- **ReDoc documentation**: `http://localhost:8000/redoc`

## Troubleshooting

### Stockfish Not Found
If you get a "Stockfish engine not found" error:
1. Ensure Stockfish is installed
2. Check if it's in your PATH: `which stockfish` (Linux/Mac) or `where stockfish` (Windows)
3. Place `stockfish` executable in the backend directory
4. Update the `stockfish_paths` list in `main.py` if needed

### Performance Tips
- Use shorter `time_limit` values for faster responses
- The API automatically manages the Stockfish engine lifecycle
- Analysis quality improves with longer time limits

## Development

### Project Structure:
```
backend/
├── main.py              # FastAPI application
├── chess_scoring.py     # Chess analysis logic
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

### Adding New Endpoints:
1. Define Pydantic models for request/response
2. Create the endpoint function
3. Add error handling
4. Update this README

## License

This project is part of the xpander.ai chess application.
