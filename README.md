# Chaturanga Chess Application

A full-stack chess application featuring an interactive React chess board with AI-powered position analysis using the Stockfish engine.

## 🎯 Overview

This application provides a complete chess experience with:
- **Interactive Chess Board**: React-based chess board with piece movement and game logic
- **AI Analysis**: Backend API powered by Stockfish for position analysis and move recommendations
- **Real-time State Management**: State string format for seamless board state synchronization
- **Arrow Visualization**: Visual analysis tools with customizable arrows and highlights

## 🏗️ Architecture

```
chaturanga/
├── backend/          # FastAPI chess analysis service
├── frontend/         # React chess board application
└── README.md         # This file
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend)
- **Stockfish Engine** (for chess analysis)

### Installation

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd chaturanga
```

#### 2. Backend Setup
```bash
cd backend
./setup.sh              # One-time setup
source venv/bin/activate
python run.py           # Start API server
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm start              # Start React development server
```

#### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🎮 Features

### Frontend (React Chess Board)
- ✅ **Interactive Chess Board**: Click to move pieces
- ✅ **Legal Move Validation**: Only valid moves are allowed
- ✅ **Game State Management**: Check, checkmate, and stalemate detection
- ✅ **Arrow Visualization**: Draw arrows for move analysis
- ✅ **State String Format**: `"turn::fen::arrows"` for easy state management
- ✅ **Responsive Design**: Works on desktop and mobile
- ✅ **Lichess-style Pieces**: Beautiful SVG chess pieces
- ✅ **Multiple Orientations**: Flip board for black's perspective
- ✅ **Move History**: Track game progression
- ✅ **En Passant**: Full en passant capture support

### Backend (Chess Analysis API)
- ✅ **Position Analysis**: Analyze any chess position
- ✅ **Best Move Recommendations**: Get AI-suggested moves
- ✅ **Move Evaluation**: All possible moves with advantages
- ✅ **Stockfish Integration**: Powered by the world's strongest chess engine
- ✅ **RESTful API**: Clean HTTP endpoints with JSON responses
- ✅ **API Versioning**: v1 API with legacy support
- ✅ **Error Handling**: Comprehensive error responses
- ✅ **CORS Support**: Frontend integration ready
- ✅ **Health Monitoring**: API health checks
- ✅ **Interactive Documentation**: Swagger UI and ReDoc

## 📚 API Documentation

### Endpoints

#### Complete Analysis
```bash
POST /api/v1/analyze
```
Analyze all possible moves with their advantages.

**Request:**
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
      "best_response": "e7e5"
    }
  ],
  "best_move": "e2e4",
  "advantage": 0.25,
  "is_mate": false,
  "mate_in": null,
  "principal_variation": ["e2e4", "e7e5", "g1f3"]
}
```

#### Best Move Only
```bash
POST /api/v1/best-move
```
Get the best move recommendation.

**Request:**
```json
{
  "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
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

### State String Format
The API uses a custom state string format: `"turn::fen::arrows"`

**Examples:**
- Starting position: `"white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"`
- After e4: `"black::rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1::e2->e4:blue"`
- Middle game: `"white::r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4::e2->e4:blue\\d7->d5:red"`

## 🛠️ Development

### Backend Development
```bash
cd backend
source venv/bin/activate
python run.py              # Development server with auto-reload
python test_api.py         # Run API tests
python example_usage.py    # Test API client
```

### Frontend Development
```bash
cd frontend
npm start                  # Development server
npm run build             # Production build
npm test                  # Run tests
```

### Project Structure

#### Backend (`/backend`)
```
backend/
├── app/
│   ├── main.py           # FastAPI application
│   ├── api/              # API routes
│   ├── core/             # Configuration
│   ├── models/           # Pydantic models
│   ├── services/         # Business logic
│   └── utils/            # Utility functions
├── chess_scoring.py      # Chess analysis engine
├── requirements.txt      # Python dependencies
├── run.py               # Development server
├── test_api.py          # API tests
└── README.md            # Backend documentation
```

#### Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── ChessBoard.jsx
│   │   ├── Arrow.jsx
│   │   ├── pieces/       # Piece components
│   │   └── chess/        # Chess engine
│   ├── App.jsx          # Main application
│   └── index.js         # Entry point
├── public/
│   ├── pieces/          # SVG chess pieces
│   └── signs/           # Arrow symbols
├── package.json         # Dependencies
└── README.md           # Frontend documentation
```

## 🔧 Configuration

### Backend Configuration
Create a `.env` file in the `backend/` directory:
```env
DEBUG=true
DEFAULT_ANALYSIS_TIME=1.0
MAX_ANALYSIS_TIME=10.0
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
LOG_LEVEL=INFO
```

### Frontend Configuration
The frontend uses environment variables for API configuration:
```env
REACT_APP_API_URL=http://localhost:8000
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
python test_api.py
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
# Start backend
cd backend && python run.py

# In another terminal, start frontend
cd frontend && npm start

# Test the full application
```

## 📦 Deployment

### Backend Deployment
```bash
# Production server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Docker (optional)
docker build -t chess-api .
docker run -p 8000:8000 chess-api
```

### Frontend Deployment
```bash
# Build for production
npm run build

# Serve static files
npx serve -s build -l 3000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `python test_api.py` and `npm test`
6. Commit your changes: `git commit -m "Add feature"`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

## 📄 License

This project is part of the chaturanga chess application.

## 🆘 Troubleshooting

### Common Issues

#### Stockfish Not Found
```bash
# macOS
brew install stockfish

# Linux
sudo apt-get install stockfish

# Windows
# Download from https://stockfishchess.org/download/
```

#### Port Already in Use
```bash
# Backend (port 8000)
lsof -ti:8000 | xargs kill -9

# Frontend (port 3000)
lsof -ti:3000 | xargs kill -9
```

#### Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Node Dependencies
```bash
cd frontend
npm install
```

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation at `/docs`
3. Check the individual README files in `backend/` and `frontend/`
4. Open an issue on GitHub

## 🎯 Roadmap

- [ ] User authentication and game history
- [ ] Multiplayer support
- [ ] Opening book integration
- [ ] Tournament mode
- [ ] Mobile app
- [ ] Advanced analysis features
- [ ] Chess puzzle mode
- [ ] Performance optimizations

---

**♟️ Happy Chess Playing! ♟️**
