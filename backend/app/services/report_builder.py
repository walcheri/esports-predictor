"""Подробный отчёт только из реальных данных PandaScore."""

from __future__ import annotations

from app.models import Match
from app.services.match_analytics import (
    build_recent_lines,
    build_roster_lines,
    build_stats_rows,
    loads_json,
    match_has_analytics,
    team_has_stats,
)


def build_pandascore_report(
    match: Match,
    team_a_prob: float,
    team_b_prob: float,
    confidence: float,
) -> str:
    if not match_has_analytics(match):
        return ""

    ta, tb = match.team_a, match.team_b
    detail = loads_json(match.ps_detail_json)
    if not isinstance(detail, dict):
        detail = {}

    sections: list[str] = ["## Аналитика матча", ""]
    has_content = False

    # ── Матч ─────────────────────────────────────────
    header: list[str] = []
    if detail.get("name"):
        header.append(f"**{detail['name']}**")
    header.append(f"**Турнир:** {match.tournament}")
    header.append(f"**Формат:** {match.format} · **Статус:** {match.status}")
    if match.is_qualification:
        header.append("**Тип:** Квалификация")
    if detail.get("begin_at"):
        header.append(f"**Начало:** {str(detail['begin_at'])[:16].replace('T', ' ')}")
    sections.extend(header)
    sections.append("")

    # ── Счёт серии ───────────────────────────────────
    results = loads_json(match.results_json)
    if results:
        has_content = True
        sections.append("### Счёт серии")
        for r in results:
            if r.get("team_name") is not None:
                sections.append(f"- **{r['team_name']}:** {r.get('score', 0)}")
        sections.append("")

    # ── Карты / игры ─────────────────────────────────
    games = loads_json(match.games_json)
    if games:
        has_content = True
        sections.append("### Ход серии")
        for g in games:
            pos = g.get("position", "?")
            status = g.get("status") or "—"
            winner = g.get("winner_name")
            map_name = g.get("map") or ""
            map_part = f" · карта **{map_name}**" if map_name else ""
            if winner:
                sections.append(f"- Игра {pos}{map_part}: {status} · победитель **{winner}**")
            else:
                sections.append(f"- Игра {pos}{map_part}: {status}")
        sections.append("")

    # ── Составы (PandaScore /teams/{id}/players) ─────
    roster_a = build_roster_lines(ta)
    roster_b = build_roster_lines(tb)
    if roster_a:
        has_content = True
        sections.append(f"### Состав {ta.name}")
        sections.extend(roster_a)
        sections.append("")
    if roster_b:
        has_content = True
        sections.append(f"### Состав {tb.name}")
        sections.extend(roster_b)
        sections.append("")

    # ── Статистика и форма ───────────────────────────
    stats_rows = build_stats_rows(ta, tb)
    if stats_rows:
        has_content = True
        sections.append("### Статистика команд")
        sections.append(f"| Метрика | {ta.name} | {tb.name} |")
        sections.append("|---------|----------|----------|")
        for label, va, vb in stats_rows:
            sections.append(f"| {label} | {va} | {vb} |")
        sections.append("")

    for team in (ta, tb):
        recent = build_recent_lines(team)
        if recent:
            has_content = True
            sections.append(f"### Последние матчи — {team.name}")
            sections.extend(recent)
            sections.append("")

    # ── Трансляции ───────────────────────────────────
    streams = loads_json(match.streams_json)
    if streams:
        has_content = True
        sections.append("### Трансляции")
        for s in streams:
            lang = s.get("language", "?")
            flags = []
            if s.get("main"):
                flags.append("основная")
            if s.get("official"):
                flags.append("официальная")
            flag_str = f" ({', '.join(flags)})" if flags else ""
            url = s.get("raw_url")
            if url:
                sections.append(f"- [{lang}]({url}){flag_str}")
            else:
                sections.append(f"- {lang}{flag_str}")
        sections.append("")

    if detail.get("official_stream_url"):
        sections.append(f"**Официальный стрим:** {detail['official_stream_url']}")
        sections.append("")

    # ── Прогноз (только если есть статистика) ────────
    has_stats = team_has_stats(ta) or team_has_stats(tb)
    if has_stats:
        has_content = True
        sections.append("### Прогноз модели")
        sections.append(f"- **{ta.name}:** {round(team_a_prob * 100)}%")
        sections.append(f"- **{tb.name}:** {round(team_b_prob * 100)}%")
        sections.append(f"- **Уверенность:** {round(confidence * 100)}%")
        sections.append("")

    if not has_content:
        return ""
    return "\n".join(sections).strip()
