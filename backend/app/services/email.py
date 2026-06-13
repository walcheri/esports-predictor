"""Отправка email: Resend API (HTTPS) или SMTP."""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailSendResult:
    ok: bool
    error: str | None = None


def _from_address() -> str:
    if settings.smtp_user and "@" in settings.smtp_user:
        return formataddr(("Esports Predictor", settings.smtp_user))
    return settings.smtp_from


def _parse_resend_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        message = data.get("message")
        if message:
            return str(message)
    except Exception:
        pass
    return response.text or f"HTTP {response.status_code}"


def _send_via_resend(to_email: str, subject: str, body: str) -> EmailSendResult:
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resolved_email_from,
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
            timeout=20,
        )
    except httpx.HTTPError as exc:
        logger.error("Resend HTTP error для %s: %s", to_email, exc)
        return EmailSendResult(ok=False, error=f"Ошибка сети Resend: {exc}")

    if response.status_code in (200, 201):
        logger.info("Resend: письмо отправлено на %s", to_email)
        return EmailSendResult(ok=True)

    error = _parse_resend_error(response)
    logger.error("Resend error %s для %s: %s", response.status_code, to_email, error)
    return EmailSendResult(ok=False, error=error)


def _send_via_smtp(to_email: str, subject: str, body: str) -> EmailSendResult:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _from_address()
    message["To"] = to_email
    message.set_content(body)

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
                smtp.ehlo()
                if settings.smtp_use_tls:
                    smtp.starttls()
                    smtp.ehlo()
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.error("SMTP error для %s (%s). Текст письма:\n%s", to_email, exc, body)
        return EmailSendResult(ok=False, error=str(exc))

    logger.info("SMTP: письмо отправлено на %s", to_email)
    return EmailSendResult(ok=True)


def send_email(to_email: str, subject: str, body: str) -> EmailSendResult:
    if settings.resend_api_key:
        return _send_via_resend(to_email, subject, body)

    if not settings.smtp_host:
        logger.warning(
            "Email не настроен (RESEND_API_KEY или SMTP_HOST). Получатель: %s\n%s",
            to_email,
            body,
        )
        return EmailSendResult(ok=False, error="Email не настроен на сервере")

    return _send_via_smtp(to_email, subject, body)


def send_verification_email(to_email: str, code: str, ttl_seconds: int) -> EmailSendResult:
    minutes = max(1, ttl_seconds // 60)
    body = (
        f"Здравствуйте!\n\n"
        f"Ваш код подтверждения для Esports Predictor: {code}\n\n"
        f"Код действует {minutes} мин.\n\n"
        f"Если вы не регистрировались — просто проигнорируйте это письмо."
    )
    return send_email(to_email, "Код подтверждения — Esports Predictor", body)
