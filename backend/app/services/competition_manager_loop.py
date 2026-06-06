"""Background loop: sync running competitions and pair seekers."""

import asyncio
import logging

from app.db.database import SessionLocal
from app.services.competition_manager_service import competition_manager_service

logger = logging.getLogger(__name__)

TICK_INTERVAL_SEC = 1.0
SYNC_EVERY_TICKS = 5


async def run_competition_manager() -> None:
    logger.info("Competition manager started")
    tick = 0

    try:
        while True:
            db = SessionLocal()
            try:
                if tick % SYNC_EVERY_TICKS == 0:
                    await competition_manager_service.sync_running_competitions(db)
                paired = await competition_manager_service.run_pairing_tick(db)
                if paired:
                    logger.debug("Competition manager paired %s game(s)", paired)
            except Exception:
                logger.exception("Competition manager tick failed")
            finally:
                db.close()

            tick += 1
            await asyncio.sleep(TICK_INTERVAL_SEC)
    except asyncio.CancelledError:
        logger.info("Competition manager stopped")
        raise
