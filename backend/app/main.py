"""
Main FastAPI application for the Chess Analysis API.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.chess_routes import router as chess_router
from app.services.chess_service import chess_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    print("♟️  Starting Chess Analysis API...")
    print("=" * 40)
    
    try:
        chess_service.start_engine()
        print("✅ Chess analyzer initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize chess analyzer: {e}")
        raise
    
    yield
    
    # Shutdown
    print("🔚 Shutting down Chess Analysis API...")
    chess_service.stop_engine()
    print("✅ Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="API for analyzing chess positions using Stockfish engine",
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chess_router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": {
            "/api/v1/analyze": "POST - Complete board analysis with all moves",
            "/api/v1/best-move": "POST - Get best move only",
            "/api/v1/health": "GET - Health check"
        }
    }


# Health check endpoint (legacy)
@app.get("/health")
async def health_check():
    """Legacy health check endpoint"""
    health_data = chess_service.health_check()
    return health_data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
