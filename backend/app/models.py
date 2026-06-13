from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    pandascore_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pandascore_slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    short_name: Mapped[str] = mapped_column(String(32))
    color: Mapped[str] = mapped_column(String(16))
    gradient: Mapped[str] = mapped_column(String(128))


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pandascore_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    logo: Mapped[str] = mapped_column(String(16))
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    country: Mapped[str | None] = mapped_column(String(8), nullable=True)
    players_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    win_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    elo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roster_stability: Mapped[float | None] = mapped_column(Float, nullable=True)
    recent_form: Mapped[float | None] = mapped_column(Float, nullable=True)
    map_pool_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    matches_sampled: Mapped[int | None] = mapped_column(Integer, nullable=True)
    form_history_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    recent_matches_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pandascore_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    game_id: Mapped[str] = mapped_column(ForeignKey("games.id"))
    team_a_id: Mapped[str] = mapped_column(ForeignKey("teams.id"))
    team_b_id: Mapped[str] = mapped_column(ForeignKey("teams.id"))
    status: Mapped[str] = mapped_column(String(16))
    format: Mapped[str] = mapped_column(String(8))
    tournament: Mapped[str] = mapped_column(String(256))
    is_qualification: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime)
    map_pool: Mapped[str | None] = mapped_column(Text, nullable=True)
    streams_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    games_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    results_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    h2h_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ps_detail_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    game: Mapped["Game"] = relationship("Game")
    team_a: Mapped["Team"] = relationship("Team", foreign_keys=[team_a_id])
    team_b: Mapped["Team"] = relationship("Team", foreign_keys=[team_b_id])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    profile: Mapped["Profile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    predictions: Mapped[list["UserPrediction"]] = relationship(back_populates="user")


class Profile(Base):
    """Профиль пользователя (как profiles в esports-predictor)."""

    __tablename__ = "profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    predictions_count: Mapped[int] = mapped_column(Integer, default=0)
    requests_used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="profile")


class UserPrediction(Base):
    """История прогнозов пользователя (как predictions в esports-predictor)."""

    __tablename__ = "user_predictions"
    __table_args__ = (UniqueConstraint("user_id", "match_id", name="uq_user_match_prediction"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    match_id: Mapped[str] = mapped_column(String(64), index=True)
    team_a: Mapped[str] = mapped_column(String(128))
    team_b: Mapped[str] = mapped_column(String(128))
    game_id: Mapped[str] = mapped_column(String(32))
    tournament: Mapped[str | None] = mapped_column(String(256), nullable=True)
    predicted_winner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    team_a_probability: Mapped[float] = mapped_column(Float)
    team_b_probability: Mapped[float] = mapped_column(Float)
    report_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="predictions")


class PendingRegistration(Base):
    """Незавершённая регистрация — User создаётся только после подтверждения кода."""

    __tablename__ = "pending_registrations"

    email: Mapped[str] = mapped_column(String(256), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PremiumWaitlist(Base):
    """Лист ожидания Premium (как premium_waitlist в esports-predictor)."""

    __tablename__ = "premium_waitlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(256), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PredictionCache(Base):
    __tablename__ = "prediction_cache"

    match_id: Mapped[str] = mapped_column(ForeignKey("matches.id"), primary_key=True)
    team_a_probability: Mapped[float] = mapped_column(Float)
    team_b_probability: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    factors_json: Mapped[str] = mapped_column(Text)
    key_arguments_json: Mapped[str] = mapped_column(Text)
    report: Mapped[str] = mapped_column(Text)
    report_source: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
