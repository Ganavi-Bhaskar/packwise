"""Environment-backed application settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or a local .env file."""

    app_name: str = "Food Packaging AI"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'food_packaging.db').as_posix()}"
    cors_origins: list[str] = ["http://localhost:5173"]
    model_artifact_dir: str = str(BACKEND_DIR / "ml" / "artifacts")
    materials_path: str = str(BACKEND_DIR / "data" / "materials.json")
    metrics_path: str = str(BACKEND_DIR / "ml" / "artifacts" / "metrics.json")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
