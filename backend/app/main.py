from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app import __version__
from app.api.routes import (
    ai,
    analytics,
    auth,
    bills,
    budgets,
    categories,
    dashboard,
    goals,
    health,
    notifications,
    research,
    scenarios,
    transactions,
)
from app.core.config import BACKEND_DIR, settings
from app.db.base import SessionLocal
from app.models import User
from app.services.notifications import evaluate_notifications

logger = logging.getLogger("finsight")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

scheduler: BackgroundScheduler | None = None


def scheduled_notification_job() -> None:
    with SessionLocal() as db:
        users = db.scalars(select(User)).all()
        for user in users:
            try:
                evaluate_notifications(db, user)
            except Exception:
                db.rollback()
                logger.exception("Scheduled notification check failed for user_id=%s", user.id)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    if settings.auto_create_tables:
        from app.db.migrate import upgrade_database

        upgrade_database()
    if settings.seed_demo_on_startup:
        try:
            from app.seed import seed_demo

            with SessionLocal() as db:
                seed_demo(db)
        except Exception:
            logger.exception("Demo seed failed; the API will still start")
    global scheduler
    if settings.enable_scheduler and settings.environment != "test":
        try:
            scheduler = BackgroundScheduler(timezone=ZoneInfo(settings.timezone))
            scheduler.add_job(
                scheduled_notification_job,
                "interval",
                minutes=settings.notification_check_minutes,
                id="notification-evaluation",
                replace_existing=True,
                max_instances=1,
            )
            scheduler.start()
            logger.info("Notification scheduler started")
        except Exception:
            logger.exception("Could not start the notification scheduler")
    yield
    if scheduler is not None:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="FinSight AI",
    version=__version__,
    description=(
        "Personal finance analytics and grounded AI for Indian users. "
        "All financial figures are calculated by a deterministic engine. "
        "Demo records are fictional; no bank or UPI connection exists."
    ),
    docs_url=f"{settings.api_prefix}/docs" if settings.api_docs_enabled else None,
    redoc_url=f"{settings.api_prefix}/redoc" if settings.api_docs_enabled else None,
    openapi_url=f"{settings.api_prefix}/openapi.json" if settings.api_docs_enabled else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _origin_allowed(origin: str, request: Request) -> bool:
    if origin in settings.cors_origin_list:
        return True
    parsed = urlparse(origin)
    return bool(parsed.netloc) and parsed.netloc == request.url.netloc


@app.middleware("http")
async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
    if request.method in UNSAFE_METHODS:
        origin = request.headers.get("origin")
        if origin and not _origin_allowed(origin, request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Cross-origin request rejected"},
            )
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith(f"{settings.api_prefix}/auth"):
        response.headers.setdefault("Cache-Control", "no-store")
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


for router in [
    auth.router,
    categories.router,
    transactions.router,
    budgets.router,
    goals.router,
    dashboard.router,
    analytics.router,
    scenarios.router,
    notifications.router,
    bills.router,
    ai.router,
    research.router,
    health.router,
]:
    app.include_router(router, prefix=settings.api_prefix)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. No financial data was included in logs."},
    )


# Optionally serve the built frontend from the same origin (production convenience).
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"
if (FRONTEND_DIST / "index.html").exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        if full_path.startswith("api"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        root = FRONTEND_DIST.resolve()
        candidate = (root / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
