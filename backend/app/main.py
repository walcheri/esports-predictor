import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

_root = Path(__file__).resolve().parents[2]
load_dotenv(_root / ".env")

from app.config import settings
from app.database import Base, SessionLocal, engine, get_db
from app.migrate import run_migrations
from app.routers import auth, games, matches, predictions, premium, profile, sync, tournaments
from app.services.pandascore import PandaScoreError
from app.services.sync import purge_legacy_data, sync_from_pandascore
from app.static import mount_frontend

logger = logging.getLogger(__name__)


async def _run_sync() -> None:
    if not settings.pandascore_api_key:
        logger.error("PANDASCORE_API_KEY обязателен — данные только из PandaScore")
        return
    db = SessionLocal()
    try:
        result = await sync_from_pandascore(db)
        logger.info("PandaScore sync: %s", result)
    except PandaScoreError as exc:
        logger.error("PandaScore sync failed: %s", exc)
    finally:
        db.close()


async def _sync_loop() -> None:
    interval = max(settings.sync_interval_minutes, 5) * 60
    while True:
        await asyncio.sleep(interval)
        await _run_sync()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.validate_production()
    if settings.resend_api_key:
        logger.info("Email: Resend (%s)", settings.resolved_email_from)
    elif settings.smtp_host:
        logger.info("Email: SMTP %s:%s", settings.smtp_host, settings.smtp_port)
    else:
        logger.warning("Email не настроен — добавьте RESEND_API_KEY в .env")
    Base.metadata.create_all(bind=engine)
    run_migrations()

    db = SessionLocal()
    try:
        removed = purge_legacy_data(db)
        db.commit()
        if removed["removed_matches"] or removed["removed_teams"]:
            logger.info("Removed legacy seed data: %s", removed)
    finally:
        db.close()

    background_tasks: list[asyncio.Task] = []
    if settings.sync_on_startup and settings.pandascore_api_key:
        background_tasks.append(asyncio.create_task(_run_sync()))
    if settings.pandascore_api_key and settings.sync_interval_minutes > 0:
        background_tasks.append(asyncio.create_task(_sync_loop()))

    yield

    for task in background_tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Esports Predictor",
    description="Данные только из PandaScore: матчи, трансляции, составы, прогнозы",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)
app.include_router(tournaments.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(premium.router)
app.include_router(sync.router)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    from sqlalchemy import func

    from app.models import Match

    synced_matches = (
        db.query(func.count(Match.id))
        .filter(Match.pandascore_id.isnot(None))
        .scalar()
        or 0
    )
    live_matches = (
        db.query(func.count(Match.id))
        .filter(Match.pandascore_id.isnot(None), Match.status == "live")
        .scalar()
        or 0
    )
    return {
        "status": "ok",
        "env": settings.app_env,
        "static": settings.serve_static and settings.static_dir_path.is_dir(),
        "pandascore": bool(settings.pandascore_api_key),
        "synced_matches": synced_matches,
        "live_matches": live_matches,
        "llm": bool(settings.openai_api_key),
        "llm_model": settings.openai_model,
        "llm_base_url": settings.openai_base_url,
        "email_provider": "resend" if settings.resend_api_key else ("smtp" if settings.smtp_host else None),
        "email_configured": settings.email_configured,
    }


if settings.serve_static:
    mount_frontend(app)
