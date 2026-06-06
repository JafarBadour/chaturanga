"""
Main FastAPI application for the Chaturanga chess platform.
"""

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.chess_routes import router as chess_router
from app.api.auth_routes import router as auth_router
from app.api.game_routes import router as game_router
from app.api.competition_routes import router as competition_router
from app.api.ladder_routes import router as ladder_router
from app.api.notification_routes import router as notification_router
from app.api.ws_routes import router as ws_router
from app.db.redis_client import close_redis, init_redis
from app.services.competition_manager_loop import run_competition_manager
from app.services.realtime_events import run_realtime_listener

logger = logging.getLogger(__name__)
_match_listener_task: asyncio.Task | None = None
_comp_manager_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    print("♟️  Starting ChessStrikes...")
    print("=" * 40)

    global _match_listener_task, _comp_manager_task
    try:
        await init_redis()
        print("✅ Redis connected (realtime pub/sub)")
        _match_listener_task = asyncio.create_task(run_realtime_listener())
        _comp_manager_task = asyncio.create_task(run_competition_manager())
        print("✅ Competition manager started")
    except Exception as e:
        print(f"❌ Redis required for matchmaking: {e}")
        raise

    yield

    print("🔚 Shutting down...")
    if _match_listener_task:
        _match_listener_task.cancel()
        try:
            await _match_listener_task
        except asyncio.CancelledError:
            pass
    if _comp_manager_task:
        _comp_manager_task.cancel()
        try:
            await _comp_manager_task
        except asyncio.CancelledError:
            pass
    await close_redis()
    print("✅ Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    description="Online chess platform with ladder matchmaking and competitions",
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chess_router)
app.include_router(auth_router)
app.include_router(game_router)
app.include_router(ladder_router)
app.include_router(competition_router)
app.include_router(notification_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "features": {
            "auth": "/api/v1/auth",
            "games": "/api/v1/games",
            "ladder": "/api/v1/ladder",
            "competitions": "/api/v1/competitions",
            "websocket": "/ws?token=<jwt>",
            "analysis": "/api/v1/analyze",
        },
    }


@app.get("/health")
async def health_check():
    redis_ok = False
    try:
        from app.db.redis_client import get_redis

        await (await get_redis()).ping()
        redis_ok = True
    except Exception:
        pass
    return {
        "status": "healthy" if redis_ok else "degraded",
        "engine": {"status": "disabled"},
        "redis": redis_ok,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
