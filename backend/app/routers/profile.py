from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_user
from app.database import get_db
from app.models import User, UserPrediction
from app.auth import user_to_out
from app.models import Profile
from app.schemas import ProfileOut, UserOut, UserPredictionOut

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/me", response_model=UserOut)
def profile_me(user: User = Depends(require_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    return user_to_out(user, profile)


@router.get("/stats", response_model=ProfileOut)
def profile_stats(user: User = Depends(require_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        return ProfileOut()
    return ProfileOut(
        username=profile.username,
        avatar_url=profile.avatar_url,
        predictions_count=profile.predictions_count,
        created_at=profile.created_at,
    )


@router.get("/predictions", response_model=list[UserPredictionOut])
def list_user_predictions(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(UserPrediction)
        .filter(UserPrediction.user_id == user.id)
        .order_by(UserPrediction.created_at.desc())
        .limit(100)
        .all()
    )
    return rows
