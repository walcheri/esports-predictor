import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Game, Match
from app.schemas import (
    GameSummaryOut,
    GameOut,
    MatchOut,
    PlayerOut,
    ScoreOut,
    StreamOut,
    TeamOut,
)


def _loads_list(raw: str | None) -> list:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _loads_dict(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def team_to_out(team) -> TeamOut:
    players_raw = _loads_list(team.players_json)
    return TeamOut(
        id=team.id,
        name=team.name,
        logo=team.logo,
        logo_url=team.logo_url,
        country=team.country,
        players=[PlayerOut(**p) for p in players_raw],
        win_rate=team.win_rate,
        elo=team.elo,
        roster_stability=team.roster_stability,
        recent_form=team.recent_form,
        map_pool_strength=team.map_pool_strength,
        matches_sampled=team.matches_sampled,
        form_history=_loads_list(team.form_history_json),
        recent_matches=_loads_list(team.recent_matches_json),
    )


def format_start_time_moscow(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    moscow = dt.astimezone(ZoneInfo("Europe/Moscow"))
    return f"{moscow.day:02d}.{moscow.month:02d} в {moscow.hour:02d}:{moscow.minute:02d}"


def parse_map_pool(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    return None


def match_to_out(match: Match) -> MatchOut:
    detail = _loads_dict(match.ps_detail_json)
    return MatchOut(
        id=match.id,
        game_id=match.game_id,
        game_name=match.game.name,
        team_a=team_to_out(match.team_a),
        team_b=team_to_out(match.team_b),
        status=match.status,
        format=match.format,
        tournament=match.tournament,
        is_qualification=match.is_qualification,
        scheduled_at=match.scheduled_at,
        start_time=format_start_time_moscow(match.scheduled_at),
        map_pool=parse_map_pool(match.map_pool),
        streams=[StreamOut(**s) for s in _loads_list(match.streams_json)],
        games=[GameSummaryOut(**g) for g in _loads_list(match.games_json)],
        results=[ScoreOut(**r) for r in _loads_list(match.results_json)],
        official_stream_url=detail.get("official_stream_url"),
        live_url=detail.get("live_url"),
    )


def game_to_out(game: Game, db: Session) -> GameOut:
    count = db.query(func.count(Match.id)).filter(Match.game_id == game.id).scalar() or 0
    return GameOut(
        id=game.id,
        name=game.name,
        short_name=game.short_name,
        color=game.color,
        gradient=game.gradient,
        match_count=count,
    )
