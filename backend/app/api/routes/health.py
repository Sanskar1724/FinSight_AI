from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import settings
from app.db.base import get_db
from app.schemas import HealthResponse, PublicConfig
from app.services.ai_service import ai_status

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    db.execute(text("SELECT 1"))
    ai = ai_status()
    return HealthResponse(
        status="ok",
        database=db.bind.dialect.name if db.bind is not None else "unknown",
        ai_provider=ai["provider"],
        ai_configured=ai["configured"],
        version=__version__,
    )


@router.get("/public-config", response_model=PublicConfig)
def public_config() -> PublicConfig:
    """Non-secret settings the web app needs at runtime (no rebuild to change)."""
    return PublicConfig(
        support_email=settings.support_email.strip() or None,
        demo_enabled=settings.seed_demo_on_startup,
    )


@router.get("/")
def api_root() -> dict:
    return {
        "name": "FinSight AI API",
        "version": __version__,
        "docs": "/api/docs",
        "disclaimer": "Demo data is fictional. Not connected to banks, UPI, or payment systems.",
    }
