"""Сбор реальных данных матча из PandaScore — без заглушек и выдумок."""

from __future__ import annotations

import json
from typing import Any

from app.models import Match, Team


def loads_json(raw: str | None) -> list | dict:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    return []


def get_players(team: Team) -> list[dict[str, Any]]:
    players = loads_json(team.players_json)
    if not isinstance(players, list):
        return []
    return [p for p in players if p.get("name")]


def get_form_history(team: Team) -> list[str]:
    history = loads_json(team.form_history_json)
    if not isinstance(history, list):
        return []
    return [str(x) for x in history if x in ("W", "L", "D")]


def get_recent_matches(team: Team) -> list[dict[str, Any]]:
    recent = loads_json(team.recent_matches_json)
    if not isinstance(recent, list):
        return []
    return [m for m in recent if m.get("opponent")]


def team_has_stats(team: Team) -> bool:
    return team.matches_sampled is not None and team.matches_sampled > 0 and team.win_rate is not None


def match_has_analytics(match: Match) -> bool:
    ta, tb = match.team_a, match.team_b
    if get_players(ta) or get_players(tb):
        return True
    if team_has_stats(ta) or team_has_stats(tb):
        return True
    if loads_json(match.games_json):
        return True
    if loads_json(match.results_json):
        return True
    return False


def format_player_line(player: dict[str, Any]) -> str:
    name = player.get("name") or "—"
    parts: list[str] = []
    if player.get("role"):
        parts.append(str(player["role"]))
    if player.get("nationality"):
        parts.append(str(player["nationality"]))
    if player.get("active") is False:
        parts.append("неактивен")
    suffix = f" ({', '.join(parts)})" if parts else ""
    return f"- **{name}**{suffix}"


def build_roster_lines(team: Team) -> list[str] | None:
    players = get_players(team)
    if not players:
        return None
    active = [p for p in players if p.get("active", True)]
    lines = [format_player_line(p) for p in active]
    bench = [p for p in players if not p.get("active", True)]
    if bench:
        lines.append("")
        lines.append("*Запас:*")
        lines.extend(format_player_line(p) for p in bench)
    return lines


def build_form_line(team: Team) -> str | None:
    history = get_form_history(team)
    if not history:
        return None
    return " → ".join(history)


def build_recent_lines(team: Team) -> list[str] | None:
    recent = get_recent_matches(team)
    if not recent:
        return None
    lines: list[str] = []
    for m in recent:
        result = m.get("result", "")
        label = {"win": "W", "loss": "L", "draw": "D"}.get(result, result)
        lines.append(
            f"- {m.get('date', '—')}: vs **{m.get('opponent')}** — {label} ({m.get('score', '—')})"
        )
    return lines


def build_stats_rows(ta: Team, tb: Team) -> list[tuple[str, str, str]] | None:
    rows: list[tuple[str, str, str]] = []

    if ta.win_rate is not None and tb.win_rate is not None and team_has_stats(ta) and team_has_stats(tb):
        rows.append(("Винрейт (история)", _pct(ta.win_rate), _pct(tb.win_rate)))
    if ta.recent_form is not None and tb.recent_form is not None and team_has_stats(ta) and team_has_stats(tb):
        rows.append(("Форма (взвешенная)", _pct(ta.recent_form), _pct(tb.recent_form)))
    if ta.matches_sampled and tb.matches_sampled:
        rows.append(("Матчей в выборке", str(ta.matches_sampled), str(tb.matches_sampled)))
    if ta.roster_stability is not None and tb.roster_stability is not None and (get_players(ta) or get_players(tb)):
        rows.append(("Активных в составе", _pct(ta.roster_stability), _pct(tb.roster_stability)))

    form_a = build_form_line(ta)
    form_b = build_form_line(tb)
    if form_a and form_b:
        rows.append(("Последние результаты", form_a, form_b))

    return rows or None


def build_llm_context(match: Match) -> dict[str, Any]:
    ta, tb = match.team_a, match.team_b
    ctx: dict[str, Any] = {
        "tournament": match.tournament,
        "format": match.format,
        "status": match.status,
        "is_qualification": match.is_qualification,
    }

    detail = loads_json(match.ps_detail_json)
    if isinstance(detail, dict) and detail:
        ctx["match_detail"] = {
            k: detail[k]
            for k in ("name", "match_type", "begin_at", "end_at", "forfeit", "draw", "rescheduled")
            if detail.get(k) is not None
        }

    if get_players(ta):
        ctx["roster_a"] = get_players(ta)
    if get_players(tb):
        ctx["roster_b"] = get_players(tb)

    for prefix, team in (("team_a", ta), ("team_b", tb)):
        stats: dict[str, Any] = {"name": team.name}
        if team_has_stats(team):
            stats.update({
                "win_rate": team.win_rate,
                "recent_form": team.recent_form,
                "matches_sampled": team.matches_sampled,
            })
        if get_form_history(team):
            stats["form_history"] = get_form_history(team)
        if get_recent_matches(team):
            stats["recent_matches"] = get_recent_matches(team)
        if len(stats) > 1:
            ctx[prefix] = stats

    games = loads_json(match.games_json)
    if games:
        ctx["games"] = games
    results = loads_json(match.results_json)
    if results:
        ctx["series_score"] = results
    streams = loads_json(match.streams_json)
    if streams:
        ctx["streams"] = [{"language": s.get("language"), "official": s.get("official")} for s in streams]

    return ctx


def _pct(v: float) -> str:
    return f"{round(v * 100)}%"
