from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_user,
    user_to_out,
    verify_password,
)
from app.database import get_db
from app.models import PendingRegistration, Profile, User
from app.schemas import (
    EmailVerifyRequest,
    MessageOut,
    RegisterPendingOut,
    ResendVerificationRequest,
    TokenOut,
    UserLogin,
    UserOut,
    UserRegister,
)
from app.services.email_verification import (
    complete_pending_registration,
    resend_pending_code,
    start_pending_registration,
)
from app.services.user_profile import ensure_profile

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _register_pending(email: str, dispatch) -> RegisterPendingOut:
    email_sent = dispatch.email_sent
    if email_sent:
        message = "На почту отправлен код подтверждения"
    elif dispatch.dev_code:
        message = "Письмо не отправилось — используйте код ниже (режим разработки)"
    elif dispatch.email_error:
        message = dispatch.email_error
    else:
        message = "Не удалось отправить письмо"
    return RegisterPendingOut(
        message=message,
        email=email,
        code_ttl_seconds=dispatch.ttl_seconds,
        dev_code=dispatch.dev_code,
        email_sent=email_sent,
        email_error=dispatch.email_error,
    )


def _remove_unverified_user(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email == email, User.email_verified.is_(False)).first()
    if user:
        db.delete(user)
        db.flush()


@router.post("/register", response_model=RegisterPendingOut)
def register(body: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing and existing.email_verified:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    _remove_unverified_user(db, body.email)

    dispatch = start_pending_registration(db, body.email, hash_password(body.password))
    db.commit()
    return _register_pending(body.email, dispatch)


@router.post("/verify-email", response_model=TokenOut)
def verify_email(body: EmailVerifyRequest, db: Session = Depends(get_db)):
    user = complete_pending_registration(db, body.email, body.code)
    profile = ensure_profile(db, user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return TokenOut(access_token=token, user=user_to_out(user, profile))


@router.post("/resend-verification", response_model=RegisterPendingOut)
def resend_verification(body: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.email_verified:
        raise HTTPException(status_code=400, detail="Email уже подтверждён")

    pending = (
        db.query(PendingRegistration).filter(PendingRegistration.email == body.email).first()
    )
    if not pending:
        raise HTTPException(
            status_code=404,
            detail="Регистрация не найдена. Начните регистрацию заново.",
        )

    dispatch = resend_pending_code(db, body.email)
    db.commit()
    return _register_pending(body.email, dispatch)


@router.post("/login", response_model=TokenOut)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        pending = (
            db.query(PendingRegistration)
            .filter(PendingRegistration.email == body.email)
            .first()
        )
        if pending and verify_password(body.password, pending.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Подтвердите email. Проверьте почту или запросите новый код.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Подтвердите email. Проверьте почту или запросите новый код.",
        )

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = ensure_profile(db, user)
        db.commit()

    token = create_access_token(user.id, user.email)
    return TokenOut(access_token=token, user=user_to_out(user, profile))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    return user_to_out(user, profile)


@router.post("/premium", response_model=UserOut)
def upgrade_premium(user: User = Depends(require_user), db: Session = Depends(get_db)):
    user.is_premium = True
    db.commit()
    db.refresh(user)
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    return user_to_out(user, profile)


@router.post("/logout", response_model=MessageOut)
def logout(_user: User | None = Depends(get_current_user)):
    return MessageOut(message="Выход выполнен. Удалите токен на клиенте.")
