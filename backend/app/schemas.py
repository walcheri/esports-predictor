from datetime import datetime

from typing import Self

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator


class PlayerOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int | None = None
    name: str | None = None
    slug: str | None = None
    image_url: str | None = None
    role: str | None = None
    nationality: str | None = None
    active: bool | None = None


class StreamOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    language: str
    main: bool = False
    official: bool = False
    raw_url: str
    embed_url: str | None = None


class GameSummaryOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | None = None
    position: int | None = None
    status: str | None = None
    map: str | None = None
    winner_name: str | None = None
    winner_id: int | None = None
    length: int | None = None


class ScoreOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    team_id: int | None = None
    team_name: str | None = None
    score: int = 0


class RecentMatchOut(BaseModel):
    opponent: str
    date: str
    result: str
    score: str


class TeamOut(BaseModel):
    id: str
    name: str
    logo: str
    logo_url: str | None = None
    country: str | None = None
    players: list[PlayerOut] = []
    win_rate: float | None = None
    elo: int | None = None
    roster_stability: float | None = None
    recent_form: float | None = None
    map_pool_strength: float | None = None
    matches_sampled: int | None = None
    form_history: list[str] = []
    recent_matches: list[RecentMatchOut] = []

    model_config = {"from_attributes": True}


class UserPredictionOut(BaseModel):
    id: int
    match_id: str
    team_a: str
    team_b: str
    game_id: str
    tournament: str | None = None
    predicted_winner: str | None = None
    team_a_probability: float
    team_b_probability: float
    report_preview: str | None = None
    full_report: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileOut(BaseModel):
    username: str | None = None
    avatar_url: str | None = None
    predictions_count: int = 0
    created_at: datetime | None = None


class PremiumWaitlistIn(BaseModel):
    email: EmailStr


class GameOut(BaseModel):
    id: str
    name: str
    short_name: str
    color: str
    gradient: str
    match_count: int = 0

    model_config = {"from_attributes": True}


class TournamentOut(BaseModel):
    id: str
    name: str
    match_count: int = 0


class MatchOut(BaseModel):
    id: str
    game_id: str
    game_name: str
    team_a: TeamOut
    team_b: TeamOut
    status: str
    format: str
    tournament: str
    is_qualification: bool
    scheduled_at: datetime
    start_time: str
    map_pool: list[str] | None = None
    streams: list[StreamOut] = []
    games: list[GameSummaryOut] = []
    results: list[ScoreOut] = []
    official_stream_url: str | None = None
    live_url: str | None = None


class MatchListOut(BaseModel):
    items: list[MatchOut]
    page: int
    per_page: int
    total: int
    has_more: bool


class FactorBreakdown(BaseModel):
    name: str
    team_a: int
    team_b: int


class RequestQuotaOut(BaseModel):
    requests_limit: int
    requests_used: int
    requests_remaining: int


class PredictionOut(BaseModel):
    team_a_probability: float
    team_b_probability: float
    confidence: float
    factors: list[FactorBreakdown]
    key_arguments: list[str]
    report: str | None = None
    report_locked: bool = False
    report_source: str | None = None
    quota: RequestQuotaOut | None = None


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    password_confirm: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, value: str) -> str:
        if len(value) < 6:
            raise ValueError("Пароль должен быть не короче 6 символов")
        return value

    @model_validator(mode="after")
    def passwords_match(self) -> Self:
        if self.password != self.password_confirm:
            raise ValueError("Пароли не совпадают")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class EmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class RegisterPendingOut(BaseModel):
    message: str
    email: str
    requires_verification: bool = True
    code_ttl_seconds: int = 120
    dev_code: str | None = None
    email_sent: bool = False
    email_error: str | None = None


class UserOut(BaseModel):
    email: str
    is_premium: bool
    email_verified: bool = False
    username: str | None = None
    avatar_url: str | None = None
    predictions_count: int = 0
    requests_limit: int = 1
    requests_used: int = 0
    requests_remaining: int = 1
    created_at: datetime | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(BaseModel):
    message: str
