from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Game
from app.schemas import GameOut
from app.serializers import game_to_out

router = APIRouter(prefix="/api/games", tags=["games"])


@router.get("", response_model=list[GameOut])
def list_games(db: Session = Depends(get_db)):
    games = db.query(Game).all()
    return [game_to_out(g, db) for g in games]


@router.get("/{game_id}", response_model=GameOut)
def get_game(game_id: str, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Дисциплина не найдена")
    return game_to_out(game, db)
