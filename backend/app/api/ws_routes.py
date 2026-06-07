"""WebSocket endpoint for matchmaking and live games."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["websocket"])


async def _push_active_games(user_id: str) -> None:
    """Push the user's current active games on connect/reconnect."""
    from app.services.game_play_service import game_play_service
    db = SessionLocal()
    try:
        games = game_play_service.get_active_games(db, user_id)
        await ws_manager.send_to_user(user_id, {
            "type": "active_games",
            "games": [g.model_dump() for g in games],
        })
    except Exception:
        pass
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    db = SessionLocal()
    try:
        user_id = decode_access_token(token, db)
    finally:
        db.close()

    if not user_id:
        await websocket.close(code=4001)
        return

    await ws_manager.connect_user(user_id, websocket)
    await _push_active_games(user_id)
    try:
        while True:
            data = await websocket.receive_json()
            await ws_manager.handle_message(user_id, data)
    except WebSocketDisconnect:
        await ws_manager.disconnect_user(user_id)
