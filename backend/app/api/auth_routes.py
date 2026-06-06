"""Authentication API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, security
from app.core.security import reissue_access_token, token_signed_with_internal_key
from app.db.database import get_db
from app.db.models import User
from app.models.user import TokenResponse, UserLogin, UserRegister, UserResponse
from app.services.auth_service import auth_service
from app.services.token_blacklist_service import token_blacklist_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    return auth_service.register(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    return auth_service.login(db, data.username, data.password)


@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token_blacklist_service.blacklist_token(db, credentials.credentials)
    return {"status": "logged_out"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-issue a token signed with the current JWT secret (after key rotation)."""
    old_token = credentials.credentials
    if token_signed_with_internal_key(old_token):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token already uses the internal secret")

    new_token = reissue_access_token(old_token, db)
    if not new_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    token_blacklist_service.blacklist_token(db, old_token)
    return TokenResponse(
        access_token=new_token,
        user=UserResponse.from_user(db, current_user),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return UserResponse.from_user(db, current_user)
