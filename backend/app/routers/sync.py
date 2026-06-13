import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import MessageOut
from app.services.pandascore import PandaScoreError
from app.services.sync import sync_from_pandascore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("", response_model=dict)
async def trigger_sync(db: Session = Depends(get_db)):
    if not settings.pandascore_api_key:
        raise HTTPException(
            status_code=503,
            detail="PANDASCORE_API_KEY не настроен. Добавьте ключ в .env",
        )
    try:
        result = await sync_from_pandascore(db)
        return {"status": "ok", **result}
    except PandaScoreError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/status", response_model=MessageOut)
def sync_status():
    if settings.pandascore_api_key:
        return MessageOut(message="PandaScore подключён")
    return MessageOut(message="PANDASCORE_API_KEY не задан — данные не синхронизируются")
