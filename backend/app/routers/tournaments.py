from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Match
from app.schemas import TournamentOut

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])


@router.get("", response_model=list[TournamentOut])
def list_tournaments(
    game_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Match.tournament, func.count(Match.id))
        .filter(Match.pandascore_id.isnot(None))
        .group_by(Match.tournament)
        .order_by(func.count(Match.id).desc())
    )
    if game_id:
        q = q.filter(Match.game_id == game_id)

    return [
        TournamentOut(id=name, name=name, match_count=count)
        for name, count in q.limit(50).all()
        if name
    ]
