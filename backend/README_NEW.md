# Chess Analysis API - Reorganized Backend

A well-structured FastAPI backend service for chess position analysis using the Stockfish engine.

## 🏗️ Architecture

The backend is organized using a clean architecture pattern with proper separation of concerns:

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── api/
│   │   ├── __init__.py
│   │   └── chess_routes.py     # API route definitions
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py           # Configuration management
│   ├── models/
│   │   ├── __init__.py
│   │   └── chess.py            # Pydantic models
│   ├── services/
│   │   ├── __init__.py
│   │   └── chess_service.py    # Business logic
│   └── utils/
│       ├── __init__.py
│       └── chess_utils.py      # Utility functions
├── chess_scoring.py            # Chess analysis engine
├── requirements.txt            # Dependencies
├── run.py                      # Development server runner
├── test_api.py                 # API testing script
├── example_usage.py            # Usage examples
└── setup.sh                    # Setup script
```

## 🚀 Features

### **Clean Architecture**
- **Separation of Concerns**: Models, services, routes, and utilities are properly separated
- **Dependency Injection**: Services are injected into routes
- **Configuration Management**: Centralized settings with environment variable support
- **Error Handling**: Consistent error responses across all endpoints

### **API Versioning**
- **v1 API**: `/api/v1/*` endpoints with proper versioning
- **Legacy Support**: Backward compatibility with `/legacy/*` endpoints
- **Future-Proof**: Easy to add new API versions

### **Enhanced Features**
- **CORS Support**: Configurable CORS origins for frontend integration
- **Health Checks**: Comprehensive health monitoring
- **Request Validation**: Pydantic models with validation
- **Response Models**: Structured response formats
- **Error Codes**: Consistent error handling with proper HTTP status codes

## 📋 API Endpoints

### **v1 API (Recommended)**
```
GET  /api/v1/           # API information
GET  /api/v1/health     # Health check
POST /api/v1/analyze    # Complete board analysis
POST /api/v1/best-move  # Best move only
```

### **Legacy API (Backward Compatibility)**
```
GET  /legacy/           # API information
GET  /legacy/health     # Health check
POST /legacy/analyze    # Complete board analysis
POST /legacy/best-move  # Best move only
```

### **Root Endpoints**
```
GET  /                  # Root information
GET  /health           # Legacy health check
```

## 🛠️ Setup & Installation

### **Prerequisites**
1. **Python 3.8+**
2. **Stockfish Engine**: Install from [stockfishchess.org](https://stockfishchess.org/download/)

### **Quick Setup**
```bash
cd backend
./setup.sh              # One-time setup
source venv/bin/activate
python run.py           # Start development server
```

### **Manual Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

## 🔧 Configuration

Configuration is managed through `app/core/config.py` with support for environment variables:

### **Environment Variables**
```bash
# API Settings
APP_NAME="Chess Analysis API"
APP_VERSION="1.0.0"
DEBUG=false

# Server Settings
HOST="0.0.0.0"
PORT=8000

# Chess Engine
DEFAULT_ANALYSIS_TIME=1.0
MAX_ANALYSIS_TIME=10.0

# CORS
CORS_ORIGINS="http://localhost:3000,http://localhost:3001"

# Logging
LOG_LEVEL="INFO"
```

### **Configuration File**
Create a `.env` file in the backend directory:
```env
DEBUG=true
DEFAULT_ANALYSIS_TIME=0.5
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## 📊 API Usage Examples

### **Complete Analysis**
```bash
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
    "time_limit": 1.0
  }'
```

### **Best Move Only**
```bash
curl -X POST "http://localhost:8000/api/v1/best-move" \
  -H "Content-Type: application/json" \
  -d '{
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
  }'
```

### **Python Client**
```python
import requests

# Complete analysis
response = requests.post("http://localhost:8000/api/v1/analyze", json={
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::",
    "time_limit": 1.0
})
analysis = response.json()

# Best move only
response = requests.post("http://localhost:8000/api/v1/best-move", json={
    "state_string": "white::rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1::"
})
best_move = response.json()
```

## 🧪 Testing

### **Run Tests**
```bash
python test_api.py
```

### **Test Coverage**
- ✅ Health check
- ✅ API information
- ✅ Best move analysis
- ✅ Complete analysis
- ✅ Error handling
- ✅ Input validation

## 📚 Documentation

### **Interactive API Docs**
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### **API Models**
All request/response models are defined in `app/models/chess.py`:
- `StateStringRequest`: Input validation
- `AnalysisResponse`: Complete analysis response
- `BestMoveResponse`: Best move response
- `HealthResponse`: Health check response
- `ErrorResponse`: Error response format

## 🔄 Migration from Old Structure

### **What Changed**
1. **New API paths**: `/api/v1/*` instead of direct paths
2. **Better error handling**: Structured error responses
3. **Request validation**: Pydantic models with validation
4. **Configuration**: Environment-based settings
5. **CORS support**: Configurable origins

### **Backward Compatibility**
- Legacy endpoints still work: `/legacy/*`
- Same request/response format
- Same functionality

### **Frontend Integration**
Update your frontend to use the new API paths:
```javascript
// Old
fetch('/analyze', {...})

// New
fetch('/api/v1/analyze', {...})
```

## 🚀 Production Deployment

### **Using Uvicorn**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### **Using Gunicorn**
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### **Docker (Optional)**
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🔧 Development

### **Adding New Endpoints**
1. Add route to `app/api/chess_routes.py`
2. Add business logic to `app/services/chess_service.py`
3. Add models to `app/models/chess.py`
4. Update tests in `test_api.py`

### **Adding New Services**
1. Create service in `app/services/`
2. Add to dependency injection
3. Update configuration if needed

### **Code Style**
- Follow PEP 8
- Use type hints
- Add docstrings
- Write tests

## 📈 Performance

### **Optimizations**
- **Engine Reuse**: Single Stockfish instance
- **Connection Pooling**: Efficient HTTP handling
- **Caching**: Consider Redis for position caching
- **Async Support**: FastAPI's async capabilities

### **Monitoring**
- Health check endpoint
- Structured logging
- Error tracking
- Performance metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

This project is part of the chaturanga chess application.
