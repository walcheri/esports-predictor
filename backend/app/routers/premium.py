from fastapi import APIRouter, Depends, HTTPException
from pydantic import EmailStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import PremiumWaitlist, User
from app.schemas import MessageOut, PremiumWaitlistIn

router = APIRouter(prefix="/api/premium", tags=["premium"])


@router.post("/waitlist", response_model=MessageOut)
def join_waitlist(
    body: PremiumWaitlistIn,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    existing = db.query(PremiumWaitlist).filter(PremiumWaitlist.email == body.email).first()
    if existing:
        return MessageOut(message="Вы уже в списке ожидания")

    row = PremiumWaitlist(
        email=body.email,
        user_id=user.id if user else None,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email уже в списке ожидания") from None

    return MessageOut(message="Вы добавлены в список ожидания Premium")
