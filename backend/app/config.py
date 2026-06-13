from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_DB = f"sqlite:///{_PROJECT_ROOT / 'predict.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    serve_static: bool = False
    static_dir: str = "dist"

    database_url: str = _DEFAULT_DB
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080

    # LLM через OpenAI-совместимый API (по умолчанию AITUNNEL — https://docs.aitunnel.ru/)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.aitunnel.ru/v1"

    pandascore_api_key: str = ""
    pandascore_base_url: str = "https://api.pandascore.co"
    sync_on_startup: bool = True
    sync_interval_minutes: int = 15

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    free_prediction_limit: int = 1
    premium_prediction_limit: int = 20

    # Email: Resend (HTTPS, работает из Docker) или SMTP
    resend_api_key: str = ""
    email_from: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Esports Predictor <noreply@localhost>"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    email_verification_ttl_seconds: int = 120
    email_dev_expose_code: bool = False

    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    @field_validator("database_url", mode="before")
    @classmethod
    def default_database_url(cls, value: str | None) -> str:
        if not value:
            return _DEFAULT_DB
        return value

    @property
    def project_root(self) -> Path:
        return _PROJECT_ROOT

    @property
    def static_dir_path(self) -> Path:
        return _PROJECT_ROOT / self.static_dir

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def expose_verification_code_in_api(self) -> bool:
        return self.email_dev_expose_code and not self.is_production

    @property
    def resolved_email_from(self) -> str:
        if self.email_from:
            return self.email_from
        if self.smtp_user and "@" in self.smtp_user:
            return f"Esports Predictor <{self.smtp_user}>"
        return self.smtp_from

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key or self.smtp_host)

    def validate_production(self) -> None:
        if not self.is_production:
            return
        if self.jwt_secret in ("", "change-me-in-production"):
            raise RuntimeError("Установите надёжный JWT_SECRET в .env для production")
        if not self.serve_static:
            raise RuntimeError("В production включите SERVE_STATIC=true")


settings = Settings()
