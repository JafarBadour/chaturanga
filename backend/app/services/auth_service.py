"""User authentication service."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.models.user import TokenResponse, UserRegister, UserResponse


class AuthService:
    def register(self, db: Session, data: UserRegister) -> TokenResponse:
        if db.query(User).filter(User.username == data.username).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username already taken")
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

        user = User(
            username=data.username,
            email=data.email,
            hashed_password=hash_password(data.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return self._token_for_user(db, user)

    def login(self, db: Session, username: str, password: str) -> TokenResponse:
        user = db.query(User).filter(User.username == username).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
        return self._token_for_user(db, user)

    def get_user_by_id(self, db: Session, user_id: str) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return user

    def _token_for_user(self, db: Session, user: User) -> TokenResponse:
        token = create_access_token(user.id)
        return TokenResponse(
            access_token=token,
            user=UserResponse.from_user(db, user),
        )


auth_service = AuthService()
