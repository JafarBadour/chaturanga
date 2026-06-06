"""Authentication and password utilities."""

import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _signing_key() -> str:
    """Secret used for all newly issued internal session tokens."""
    return settings.internal_jwt


def _verification_keys() -> list[str]:
    """Secrets accepted when validating tokens (internal + legacy external during rotation)."""
    keys: list[str] = []

    def add(key: Optional[str]) -> None:
        if key and key not in keys:
            keys.append(key)

    add(settings.internal_jwt)
    add(settings.internal_jwt_previous)
    add(settings.jwt_secret_key)
    add(settings.jwt_secret_key_previous)
    return keys


def _decode_payload(token: str) -> Optional[dict]:
    for key in _verification_keys():
        try:
            return jwt.decode(token, key, algorithms=[settings.jwt_algorithm])
        except JWTError:
            continue
    return None


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload: dict = {
        "sub": subject,
        "exp": expire,
        "type": "access",
        "kid": settings.jwt_key_id,
    }
    if settings.jwt_blacklist_enabled:
        payload["jti"] = str(uuid.uuid4())
    return jwt.encode(payload, _signing_key(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, db: Optional[Session] = None) -> Optional[str]:
    payload = _decode_payload(token)
    if not payload:
        return None

    if payload.get("type") != "access":
        return None

    if (
        settings.jwt_blacklist_enabled
        and db is not None
        and "access" in settings.jwt_blacklist_token_checks
    ):
        from app.services.token_blacklist_service import token_blacklist_service

        jti = payload.get("jti")
        if jti and token_blacklist_service.is_blacklisted(db, jti):
            return None

    return payload.get("sub")


def token_signed_with_internal_key(token: str) -> bool:
    """True if the token validates with the current internal signing secret."""
    try:
        jwt.decode(token, _signing_key(), algorithms=[settings.jwt_algorithm])
        return True
    except JWTError:
        return False


def reissue_access_token(token: str, db: Optional[Session] = None) -> Optional[str]:
    """Re-sign a valid legacy token with INTERNAL_JWT."""
    user_id = decode_access_token(token, db)
    if not user_id:
        return None
    if token_signed_with_internal_key(token):
        return None
    return create_access_token(user_id)


def decode_payload_ignore_expiry(token: str) -> Optional[dict]:
    for key in _verification_keys():
        try:
            return jwt.decode(
                token,
                key,
                algorithms=[settings.jwt_algorithm],
                options={"verify_exp": False},
            )
        except JWTError:
            continue
    return None
