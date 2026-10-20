from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from typing import Annotated

from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    jwt_secret: str = Field(min_length=32)
    jwt_expire_minutes: int = 720
    jwt_algorithm: str = "HS256"

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    cookie_secure: bool = False
    upload_dir: Path = Path("uploads")
    max_upload_mb: int = 5
    confidence_threshold: float = 0.6
    model_path: str = ""

    seed_user_name: str = "Dorji"
    seed_user_email: str = ""
    seed_user_password: str = ""

    seed_admin_name: str = "Admin"
    seed_admin_email: str = ""
    seed_admin_password: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def upload_path(self) -> Path:
        path = self.upload_dir if self.upload_dir.is_absolute() else BACKEND_DIR / self.upload_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
