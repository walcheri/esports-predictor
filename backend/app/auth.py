from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Profile, User
from app.schemas import UserOut
from app.services.request_quota import quota_snapshot

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        return None

    return db.query(User).filter(User.id == user_id).first()


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    if user.email_verified is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Подтвердите email. Проверьте почту или запросите новый код.",
        )
    return user


def user_to_out(user: User, profile: Profile | None = None) -> UserOut:
    p = profile if profile is not None else getattr(user, "profile", None)
    if p:
        quota = quota_snapshot(p, user)
    else:
        limit = settings.premium_prediction_limit if user.is_premium else settings.free_prediction_limit
        quota = {
            "requests_limit": limit,
            "requests_used": 0,
            "requests_remaining": limit,
        }
    return UserOut(
        email=user.email,
        is_premium=user.is_premium,
        email_verified=user.email_verified,
        username=p.username if p else None,
        avatar_url=p.avatar_url if p else None,
        predictions_count=p.predictions_count if p else 0,
        requests_limit=quota["requests_limit"],
        requests_used=quota["requests_used"],
        requests_remaining=quota["requests_remaining"],
        created_at=user.created_at,
    )
