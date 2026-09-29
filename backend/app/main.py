"""FastAPI application entry point and lifecycle management."""

from contextlib import asynccontextmanager
import logging
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.api.routes import router
from app.db.session import Base, create_database_engine
from app.services.recommendation import RecommendationService

logger = logging.getLogger(__name__)


def create_app(
    database_url: str | None = None,
    model_artifact_dir: str | Path | None = None,
    materials_path: str | Path | None = None,
    metrics_path: str | Path | None = None,
) -> FastAPI:
    """Create the API application, optionally overriding its external resources."""
    resolved_database_url = database_url or settings.database_url
    resolved_model_dir = Path(model_artifact_dir or settings.model_artifact_dir)
    resolved_materials_path = Path(materials_path or settings.materials_path)
    resolved_metrics_path = Path(metrics_path or settings.metrics_path)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        engine = create_database_engine(resolved_database_url)
        Base.metadata.create_all(engine)
        application.state.session_factory = sessionmaker(
            bind=engine,
            autoflush=False,
            expire_on_commit=False,
        )
        recommender = RecommendationService(
            model_artifact_dir=resolved_model_dir,
            materials_path=resolved_materials_path,
            metrics_path=resolved_metrics_path,
        )
        recommender.load()
        application.state.recommender = recommender
        logger.info("API initialized with model artifacts from %s", resolved_model_dir)
        try:
            yield
        finally:
            engine.dispose()

    application = FastAPI(
        title="AI-Based Intelligent Food Packaging Material Recommendation System",
        version="0.1.0",
        description="Recommend food packaging materials from commodity and storage requirements.",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router, prefix="/api")

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error for %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred."})

    return application

app = create_app()
