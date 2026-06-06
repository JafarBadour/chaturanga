"""
Configuration management for the Chaturanga chess platform.
"""

from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / backend/.env"""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # API
    app_name: str = "Chaturanga Chess Platform"
    app_version: str = "2.0.0"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = "postgresql+psycopg2://chaturanga:chaturanga@localhost:5432/chaturanga"

    # External / rotating JWT secret (optional; used during key rotation window)
    jwt_secret_key: str = Field(
        default="change-me-in-production-use-a-long-random-string",
        validation_alias="JWT_SECRET_KEY",
    )
    jwt_secret_key_previous: Optional[str] = Field(
        default=None,
        validation_alias="JWT_SECRET_KEY_PREVIOUS",
    )

    # Internal secret for all app-issued session tokens
    internal_jwt: str = Field(validation_alias="INTERNAL_JWT")
    internal_jwt_previous: Optional[str] = Field(
        default=None,
        validation_alias="INTERNAL_JWT_PREVIOUS",
    )

    jwt_key_id: str = Field(default="v1", validation_alias="JWT_KEY_ID")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")

    @field_validator("jwt_secret_key_previous", "internal_jwt_previous", mode="before")
    @classmethod
    def empty_previous_key_is_none(cls, value: object) -> object:
        if value == "" or value is None:
            return None
        return value
    jwt_access_token_expire_minutes: int = Field(
        default=60 * 24 * 7,
        validation_alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    jwt_refresh_token_expire_minutes: int = Field(
        default=60 * 24 * 7,
        validation_alias="JWT_REFRESH_TOKEN_EXPIRE_MINUTES",
    )
    jwt_blacklist_enabled: bool = Field(default=False, validation_alias="JWT_BLACKLIST_ENABLED")
    jwt_blacklist_token_checks: List[str] = Field(
        default=["access"],
        validation_alias="JWT_BLACKLIST_TOKEN_CHECKS",
    )

    # Chess engine
    stockfish_paths: List[str] = [
        "./stockfish",
        "/usr/local/bin/stockfish",
        "/usr/bin/stockfish",
        "stockfish",
    ]
    default_analysis_time: float = 1.0
    max_analysis_time: float = 10.0

    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # Redis (matchmaking queues)
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias="REDIS_URL",
    )

    log_level: str = "INFO"


settings = Settings()
