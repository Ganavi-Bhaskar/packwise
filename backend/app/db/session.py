"""SQLAlchemy engine and declarative base setup."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for persisted application models."""


def create_database_engine(database_url: str) -> Engine:
    """Create a SQLAlchemy engine and prepare a local SQLite parent directory."""
    if database_url.startswith("sqlite:") and ":memory:" not in database_url:
        sqlite_path = database_url.removeprefix("sqlite:///")
        database_file = Path(sqlite_path)
        if not database_file.is_absolute():
            database_file = Path.cwd() / database_file
        database_file.parent.mkdir(parents=True, exist_ok=True)

    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite:") else {}
    return create_engine(database_url, connect_args=connect_args, future=True)
