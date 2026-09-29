"""HTTP endpoints for recommendations, catalogue data, and history."""

from collections.abc import Generator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.history import RecommendationHistory
from app.schemas import (
    CompareRequest,
    CompareResponse,
    FoodProfile,
    HistoryPage,
    HistoryRecord,
    RecommendationResponse,
)
from app.services.recommendation import RecommendationService

router = APIRouter()

FOOD_PRESETS: dict[str, dict[str, Any]] = {
    "fruits": {"moisture_content": 86, "fat_content": 0.5, "pH": 4.0, "water_activity": 0.97, "respiration_rate": "high", "oxygen_sensitivity": "medium", "light_sensitivity": "medium", "storage_temp": 8, "relative_humidity": 88},
    "vegetables": {"moisture_content": 91, "fat_content": 0.3, "pH": 6.0, "water_activity": 0.98, "respiration_rate": "high", "oxygen_sensitivity": "medium", "light_sensitivity": "low", "storage_temp": 6, "relative_humidity": 90},
    "dairy": {"moisture_content": 70, "fat_content": 3.5, "pH": 6.6, "water_activity": 0.97, "respiration_rate": "low", "oxygen_sensitivity": "medium", "light_sensitivity": "high", "storage_temp": 4, "relative_humidity": 65},
    "meat": {"moisture_content": 68, "fat_content": 15, "pH": 5.8, "water_activity": 0.97, "respiration_rate": "low", "oxygen_sensitivity": "high", "light_sensitivity": "medium", "storage_temp": 2, "relative_humidity": 80},
    "seafood": {"moisture_content": 76, "fat_content": 8, "pH": 6.5, "water_activity": 0.98, "respiration_rate": "low", "oxygen_sensitivity": "high", "light_sensitivity": "medium", "storage_temp": 1, "relative_humidity": 85},
    "bakery": {"moisture_content": 28, "fat_content": 8, "pH": 5.5, "water_activity": 0.78, "respiration_rate": "low", "oxygen_sensitivity": "medium", "light_sensitivity": "low", "storage_temp": 20, "relative_humidity": 55},
    "grains": {"moisture_content": 12, "fat_content": 4, "pH": 6.2, "water_activity": 0.48, "respiration_rate": "low", "oxygen_sensitivity": "medium", "light_sensitivity": "medium", "storage_temp": 20, "relative_humidity": 45},
    "snacks": {"moisture_content": 6, "fat_content": 20, "pH": 6.0, "water_activity": 0.32, "respiration_rate": "low", "oxygen_sensitivity": "high", "light_sensitivity": "medium", "storage_temp": 20, "relative_humidity": 45},
    "beverages": {"moisture_content": 96, "fat_content": 1, "pH": 4.2, "water_activity": 0.99, "respiration_rate": "low", "oxygen_sensitivity": "medium", "light_sensitivity": "high", "storage_temp": 10, "relative_humidity": 55},
    "frozen": {"moisture_content": 65, "fat_content": 8, "pH": 5.8, "water_activity": 0.92, "respiration_rate": "low", "oxygen_sensitivity": "medium", "light_sensitivity": "low", "storage_temp": -18, "relative_humidity": 55},
    "spices": {"moisture_content": 10, "fat_content": 8, "pH": 5.8, "water_activity": 0.42, "respiration_rate": "low", "oxygen_sensitivity": "medium", "light_sensitivity": "high", "storage_temp": 20, "relative_humidity": 40},
    "oils": {"moisture_content": 0.2, "fat_content": 99, "pH": 6.0, "water_activity": 0.1, "respiration_rate": "low", "oxygen_sensitivity": "high", "light_sensitivity": "high", "storage_temp": 20, "relative_humidity": 45},
}


def get_session(request: Request) -> Generator[Session, None, None]:
    """Yield a request-scoped SQLAlchemy session."""
    session_factory = request.app.state.session_factory
    with session_factory() as session:
        yield session


def get_recommender(request: Request) -> RecommendationService:
    """Return the model service loaded during application startup."""
    return request.app.state.recommender


@router.get("/health", tags=["system"])
def health_check(recommender: RecommendationService = Depends(get_recommender)) -> dict[str, str]:
    """Report API and model readiness."""
    return {"status": "ok", "model_status": "loaded" if recommender.classifier is not None else "unavailable"}


@router.post("/recommend", response_model=RecommendationResponse, tags=["recommendations"])
def recommend(
    profile: FoodProfile,
    session: Session = Depends(get_session),
    recommender: RecommendationService = Depends(get_recommender),
) -> RecommendationResponse:
    """Generate a safe top-three material recommendation and save it to history."""
    result = recommender.recommend(profile)
    history = RecommendationHistory(
        food_category=profile.food_category,
        input_data=profile.model_dump(mode="json"),
        result=result.model_dump(mode="json"),
    )
    session.add(history)
    session.commit()
    return result


@router.get("/materials", tags=["materials"])
def list_materials(
    search: str | None = Query(default=None, max_length=100),
    cost_level: str | None = Query(default=None, pattern="^(low|medium|high)$"),
    recommender: RecommendationService = Depends(get_recommender),
) -> dict[str, Any]:
    """List packaging materials, optionally filtering by name or cost level."""
    materials = recommender.material_list()
    if search:
        term = search.casefold()
        materials = [item for item in materials if term in item["name"].casefold()]
    if cost_level:
        materials = [item for item in materials if item.get("cost_level") == cost_level]
    return {"materials": materials, "total": len(materials)}


@router.get("/materials/{name}", tags=["materials"])
def material_detail(name: str, recommender: RecommendationService = Depends(get_recommender)) -> dict[str, Any]:
    """Return the properties for one material by its exact catalogue name."""
    material = recommender.material_detail(name)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown material: {name}")
    return material


@router.get("/foods", tags=["foods"])
def list_food_presets() -> dict[str, Any]:
    """Return supported food categories with editable default property presets."""
    return {
        "categories": [
            {"name": category, "defaults": defaults}
            for category, defaults in FOOD_PRESETS.items()
        ]
    }


@router.get("/history", response_model=HistoryPage, tags=["history"])
def list_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    food_category: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> HistoryPage:
    """Return newest recommendation history records with pagination."""
    statement = select(RecommendationHistory)
    count_statement = select(func.count()).select_from(RecommendationHistory)
    if food_category:
        statement = statement.where(RecommendationHistory.food_category == food_category)
        count_statement = count_statement.where(RecommendationHistory.food_category == food_category)
    records = session.scalars(
        statement.order_by(RecommendationHistory.created_at.desc(), RecommendationHistory.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    items = [
        HistoryRecord(
            id=record.id,
            created_at=record.created_at,
            food_category=record.food_category,
            input_data=record.input_data,
            result=record.result,
        )
        for record in records
    ]
    return HistoryPage(items=items, total=int(session.scalar(count_statement) or 0), limit=limit, offset=offset)


@router.delete("/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["history"])
def delete_history(history_id: int, session: Session = Depends(get_session)) -> Response:
    """Delete a saved recommendation history record."""
    record = session.get(RecommendationHistory, history_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History record not found")
    session.delete(record)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/model/metrics", tags=["model"])
def model_metrics(recommender: RecommendationService = Depends(get_recommender)) -> dict[str, Any]:
    """Return saved model evaluation, confusion matrix, and feature importance."""
    return recommender.model_metrics()


@router.post("/compare", response_model=CompareResponse, tags=["recommendations"])
def compare_materials(
    request: CompareRequest,
    recommender: RecommendationService = Depends(get_recommender),
) -> CompareResponse:
    """Compare two or three selected materials against the same food profile."""
    profile = FoodProfile.model_validate(request.model_dump(exclude={"material_names"}))
    try:
        results = recommender.compare(profile, request.material_names)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown material: {exc.args[0]}") from exc
    return CompareResponse(materials=results)
