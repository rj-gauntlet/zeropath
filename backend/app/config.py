"""Application configuration loaded from environment variables."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (one level above backend/)
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(env_path)


class Settings:
    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CSRF
    CSRF_SECRET: str = os.getenv("CSRF_SECRET", "dev-csrf-secret-change-in-production")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite+aiosqlite:///./zeropath.db"
    )

    # CORS
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173"
    ).split(",")

    # LLM
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    LLM_MAX_CONCURRENCY: int = int(os.getenv("LLM_MAX_CONCURRENCY", "5"))

    # Git/Scan limits
    MAX_FILE_SIZE_KB: int = int(os.getenv("MAX_FILE_SIZE_KB", "50"))
    MAX_FILES_PER_SCAN: int = int(os.getenv("MAX_FILES_PER_SCAN", "200"))

    # Paths
    CLONED_REPOS_DIR: str = os.getenv("CLONED_REPOS_DIR", "./cloned_repos")


settings = Settings()
