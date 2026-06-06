"""WebSocket endpoint for matchmaking and live games."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["websocket"])


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
    try:
        while True:
            data = await websocket.receive_json()
            await ws_manager.handle_message(user_id, data)
    except WebSocketDisconnect:
        await ws_manager.disconnect_user(user_id)
