"""SQLAlchemy model for saved recommendation requests and responses."""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class RecommendationHistory(Base):
    """Immutable snapshot of a recommendation request and its result."""

    __tablename__ = "recommendation_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    food_category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    input_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
