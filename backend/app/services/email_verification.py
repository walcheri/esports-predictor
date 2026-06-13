"""Регистрация с подтверждением email — аккаунт создаётся только после ввода кода."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PendingRegistration, User
from app.services.email import send_verification_email


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_code(code: str) -> str:
    payload = f"{code}:{settings.jwt_secret}".encode()
    return hashlib.sha256(payload).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


@dataclass
class VerificationDispatch:
    ttl_seconds: int
    email_sent: bool = False
    email_error: str | None = None
    dev_code: str | None = None


def _set_pending_code(pending: PendingRegistration) -> tuple[str, int]:
    code = _generate_code()
    ttl = settings.email_verification_ttl_seconds
    pending.code_hash = _hash_code(code)
    pending.expires_at = _utcnow() + timedelta(seconds=ttl)
    return code, ttl


def _dispatch_code(email: str, code: str, ttl: int) -> VerificationDispatch:
    result = send_verification_email(email, code, ttl)
    dev_code = None
    if not result.ok and settings.expose_verification_code_in_api:
        dev_code = code
    return VerificationDispatch(
        ttl_seconds=ttl,
        email_sent=result.ok,
        email_error=result.error,
        dev_code=dev_code,
    )


def start_pending_registration(db: Session, email: str, password_hash: str) -> VerificationDispatch:
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    if pending:
        pending.password_hash = password_hash
    else:
        pending = PendingRegistration(
            email=email,
            password_hash=password_hash,
            code_hash="",
            expires_at=_utcnow(),
        )
        db.add(pending)

    code, ttl = _set_pending_code(pending)
    db.flush()
    return _dispatch_code(email, code, ttl)


def resend_pending_code(db: Session, email: str) -> VerificationDispatch:
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    if not pending:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Регистрация не найдена")

    code, ttl = _set_pending_code(pending)
    db.flush()
    return _dispatch_code(email, code, ttl)


def complete_pending_registration(db: Session, email: str, code: str) -> User:
    normalized = code.strip()
    if len(normalized) != 6 or not normalized.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код должен состоять из 6 цифр",
        )

    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Регистрация не найдена. Начните регистрацию заново.",
        )

    if pending.expires_at < _utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода истёк. Запросите новый.",
        )

    if pending.code_hash != _hash_code(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код подтверждения",
        )

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        if existing.email_verified:
            db.delete(pending)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email уже зарегистрирован")
        db.delete(existing)

    user = User(
        email=email,
        password_hash=pending.password_hash,
        email_verified=True,
    )
    db.add(user)
    db.delete(pending)
    db.flush()
    return user
