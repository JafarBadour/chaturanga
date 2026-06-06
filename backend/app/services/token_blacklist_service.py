"""JWT token blacklist (logout / revoke)."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_payload_ignore_expiry
from app.db.models import TokenBlacklist


class TokenBlacklistService:
    def is_blacklisted(self, db: Session, jti: str) -> bool:
        if not settings.jwt_blacklist_enabled:
            return False
        row = db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first()
        if not row:
            return False
        if row.expires_at < datetime.utcnow():
            db.delete(row)
            db.commit()
            return False
        return True

    def blacklist_token(self, db: Session, token: str) -> None:
        if not settings.jwt_blacklist_enabled:
            return
        payload = decode_payload_ignore_expiry(token)
        if not payload:
            return
        jti = payload.get("jti")
        exp = payload.get("exp")
        if not jti or not exp:
            return
        if db.query(TokenBlacklist).filter(TokenBlacklist.jti == jti).first():
            return
        db.add(TokenBlacklist(jti=jti, expires_at=datetime.utcfromtimestamp(exp)))
        db.commit()


token_blacklist_service = TokenBlacklistService()
