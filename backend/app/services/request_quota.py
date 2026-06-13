"""Лимиты запросов на прогнозы по подписке."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Profile, User, UserPrediction


def prediction_limit(user: User) -> int:
    return (
        settings.premium_prediction_limit
        if user.is_premium
        else settings.free_prediction_limit
    )


def user_has_prediction(db: Session, user_id: int, match_id: str) -> bool:
    return (
        db.query(UserPrediction.id)
        .filter(
            UserPrediction.user_id == user_id,
            UserPrediction.match_id == match_id,
        )
        .first()
        is not None
    )


def quota_snapshot(profile: Profile, user: User) -> dict[str, int]:
    limit = prediction_limit(user)
    used = profile.requests_used or 0
    remaining = max(0, limit - used)
    return {
        "requests_limit": limit,
        "requests_used": used,
        "requests_remaining": remaining,
    }


def ensure_can_request(db: Session, user: User, match_id: str) -> Profile:
    from app.services.user_profile import ensure_profile

    profile = ensure_profile(db, user)
    if user_has_prediction(db, user.id, match_id):
        return profile

    snap = quota_snapshot(profile, user)
    if snap["requests_remaining"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Лимит запросов исчерпан ({snap['requests_limit']} на подписку). Оформите Premium.",
        )
    return profile


def consume_request(db: Session, profile: Profile, user: User, match_id: str) -> None:
    if user_has_prediction(db, user.id, match_id):
        return
    profile.requests_used = (profile.requests_used or 0) + 1
