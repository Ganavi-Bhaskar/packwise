"""Shared FastAPI test fixtures."""

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import BACKEND_DIR
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    """Start the API with real saved models and an isolated temporary SQLite DB."""
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'history.db').as_posix()}",
        model_artifact_dir=BACKEND_DIR / "ml" / "artifacts",
        materials_path=BACKEND_DIR / "data" / "materials.json",
        metrics_path=BACKEND_DIR / "ml" / "artifacts" / "metrics.json",
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def food_payload() -> dict[str, object]:
    """Return a valid fruit profile for API tests."""
    return {
        "food_category": "fruits",
        "moisture_content": 86,
        "fat_content": 1,
        "pH": 4.1,
        "water_activity": 0.97,
        "respiration_rate": "high",
        "oxygen_sensitivity": "medium",
        "light_sensitivity": "medium",
        "storage_temp": 8,
        "relative_humidity": 88,
        "transport_days": 5,
        "required_shelf_life_days": 14,
        "budget_level": "medium",
        "sustainability_priority": "high",
    }
