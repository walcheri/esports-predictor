from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case
from sqlalchemy.orm import Session, joinedload
from zoneinfo import ZoneInfo

from app.database import get_db
from app.models import Match
from app.schemas import MatchListOut, MatchOut
from app.serializers import match_to_out
from app.services.sync import ensure_match_details

router = APIRouter(prefix="/api/matches", tags=["matches"])

_MSK = ZoneInfo("Europe/Moscow")


def _match_query(db: Session):
    return (
        db.query(Match)
        .options(
            joinedload(Match.team_a),
            joinedload(Match.team_b),
            joinedload(Match.game),
        )
    )


def _ordered(q):
    return q.order_by(
        case((Match.status == "live", 0), else_=1),
        Match.scheduled_at,
    )


def _msk_range(date: str) -> tuple[datetime, datetime] | None:
    now_msk = datetime.now(_MSK)
    if date == "today":
        start = now_msk.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    elif date == "tomorrow":
        start = now_msk.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        end = start + timedelta(days=1)
    elif date == "week":
        start = now_msk.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=8)
    else:
        return None

    def _to_utc_naive(dt: datetime) -> datetime:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    return _to_utc_naive(start), _to_utc_naive(end)


@router.get("", response_model=MatchListOut)
def list_matches(
    game_id: str | None = Query(None),
    status: str | None = Query(None),
    tournament: str | None = Query(None),
    date: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = _match_query(db).filter(Match.pandascore_id.isnot(None))
    if game_id:
        q = q.filter(Match.game_id == game_id)
    if status and status != "all":
        q = q.filter(Match.status == status)
    if tournament:
        q = q.filter(Match.tournament == tournament)

    if date and date != "all":
        bounds = _msk_range(date)
        if bounds:
            start, end = bounds
            q = q.filter(Match.scheduled_at >= start, Match.scheduled_at < end)

    total = q.count()
    matches = _ordered(q).offset((page - 1) * per_page).limit(per_page).all()
    return MatchListOut(
        items=[match_to_out(m) for m in matches],
        page=page,
        per_page=per_page,
        total=total,
        has_more=page * per_page < total,
    )


@router.get("/{match_id}", response_model=MatchOut)
async def get_match(match_id: str, db: Session = Depends(get_db)):
    match = _match_query(db).filter(Match.id == match_id).first()
    if not match or not match.pandascore_id:
        raise HTTPException(status_code=404, detail="Матч не найден")

    await ensure_match_details(db, match)
    match = _match_query(db).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Матч не найден")
    return match_to_out(match)
