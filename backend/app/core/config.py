"""
Configuration management for the Chess Analysis API.
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    app_name: str = "Chess Analysis API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Server Settings
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Chess Engine Settings
    stockfish_paths: List[str] = [
        "./stockfish",
        "/usr/local/bin/stockfish",
        "/usr/bin/stockfish",
        "stockfish"  # If it's in PATH
    ]
    default_analysis_time: float = 1.0
    max_analysis_time: float = 10.0
    
    # CORS Settings
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
