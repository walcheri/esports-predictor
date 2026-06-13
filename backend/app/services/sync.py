"""Полная синхронизация с PandaScore: матчи, трансляции, составы, карты."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.design_config import DESIGN_BY_PS_SLUG, SUPPORTED_PS_SLUGS
from app.models import Game, Match, PredictionCache, Team
from app.services.pandascore import PandaScoreClient, PandaScoreError
from app.services.pandascore_parsers import (
    dumps_json,
    extract_map_names,
    parse_games,
    parse_players,
    parse_results,
    parse_streams,
)
from app.services.team_stats import (
    build_form_history,
    build_recent_matches,
    compute_roster_stability,
    compute_team_stats,
    team_initials,
)

logger = logging.getLogger(__name__)

def _parse_dt(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _match_format(number_of_games: int | None) -> str:
    mapping = {1: "Bo1", 3: "Bo3", 5: "Bo5", 7: "Bo7"}
    n = number_of_games or 1
    return mapping.get(n, f"Bo{n}")


def _is_qualifier_team(name: str | None) -> bool:
    if not name:
        return True
    lower = name.lower().strip()
    return (
        lower in ("team 1", "team 2", "team a", "team b", "qualifier", "tbd", "tba")
        or lower in ("to be determined", "to be announced")
        or lower.startswith("qualifier team")
        or "winner of" in lower
        or "loser of" in lower
    )


def _is_qualification(_match: dict, team_a_name: str = "", team_b_name: str = "") -> bool:
    """Квалификация только если участник ещё не определён (TBD / winner of …)."""
    return _is_qualifier_team(team_a_name) or _is_qualifier_team(team_b_name)


def _tournament_name(match: dict) -> str:
    league = (match.get("league") or {}).get("name", "")
    serie = (match.get("serie") or {}).get("full_name", "")
    return league or serie or match.get("name", "")


def _extract_teams(match: dict) -> list[dict]:
    teams: list[dict] = []
    for item in match.get("opponents") or []:
        if item.get("type") != "Team":
            continue
        opponent = item.get("opponent") or {}
        if opponent.get("id") and opponent.get("name"):
            teams.append(opponent)
    return teams[:2]


def _team_id(ps_id: int) -> str:
    return f"ps-{ps_id}"


def _match_id(ps_id: int) -> str:
    return f"ps-{ps_id}"


async def sync_games(db: Session, client: PandaScoreClient) -> int:
    videogames = await client.get_videogames()
    count = 0
    for vg in videogames:
        slug = vg.get("slug", "")
        if slug not in SUPPORTED_PS_SLUGS:
            continue
        design = DESIGN_BY_PS_SLUG[slug]
        game = db.query(Game).filter(Game.pandascore_slug == slug).first()
        if not game:
            game = Game(id=design["id"], pandascore_slug=slug)
            db.add(game)
        game.pandascore_id = vg["id"]
        game.name = vg.get("name", design["short_name"])
        game.short_name = design["short_name"]
        game.color = design["color"]
        game.gradient = design["gradient"]
        count += 1
    db.commit()
    return count


def _upsert_team_brief(db: Session, team_brief: dict) -> Team:
    """Минимальные данные команды из opponents — без запросов к API."""
    ps_id = team_brief["id"]
    tid = _team_id(ps_id)
    team = db.query(Team).filter(Team.pandascore_id == ps_id).first()
    if not team:
        team = Team(id=tid, pandascore_id=ps_id, name="", logo="?")
        db.add(team)

    team.name = team_brief["name"]
    team.logo = (team_brief.get("acronym") or team_initials(team.name))[:16]
    team.logo_url = team_brief.get("image_url")
    return team


def _apply_list_payload(match: Match, ps_match: dict) -> None:
    """Стримы и счёт из ответа списка матчей (include=streams_list)."""
    streams = parse_streams(ps_match)
    if streams:
        match.streams_json = dumps_json(streams)
    results = parse_results(ps_match)
    if results:
        match.results_json = dumps_json(results)

    extras = {
        k: ps_match.get(k)
        for k in ("live_url", "official_stream_url", "name", "status")
        if ps_match.get(k)
    }
    if extras:
        match.ps_detail_json = dumps_json(extras)


def _form_history_empty(team: Team) -> bool:
    raw = team.form_history_json
    if not raw or raw in ("[]", "null", ""):
        return True
    try:
        return len(json.loads(raw)) == 0
    except json.JSONDecodeError:
        return True


def _team_needs_enrichment(team: Team) -> bool:
    if not team.players_json or team.players_json in ("[]", "null"):
        return True
    if not team.matches_sampled:
        return True
    return _form_history_empty(team)


async def _refresh_team_form(
    db: Session,
    client: PandaScoreClient,
    team: Team,
    game_slug: str,
) -> None:
    if not team.pandascore_id:
        return
    try:
        past = await client.get_team_past_matches(team.pandascore_id, game_slug)
        team.form_history_json = dumps_json(build_form_history(past, team.pandascore_id))
        team.recent_matches_json = dumps_json(build_recent_matches(past, team.pandascore_id))
    except Exception:
        logger.warning("form refresh skip: %s", team.name, exc_info=True)


def _details_ttl(match: Match) -> timedelta:
    return timedelta(minutes=5) if match.status == "live" else timedelta(hours=1)


def _needs_detail_enrichment(match: Match) -> bool:
    if not match.synced_at:
        return True
    return datetime.utcnow() - match.synced_at > _details_ttl(match)


async def _enrich_team(
    db: Session,
    client: PandaScoreClient,
    team_brief: dict,
    game_slug: str,
    stats_cache: dict[int, dict | None],
    players_cache: dict[int, list[dict]],
) -> Team:
    ps_id = team_brief["id"]
    tid = _team_id(ps_id)

    team = db.query(Team).filter(Team.pandascore_id == ps_id).first()
    if not team:
        team = Team(id=tid, pandascore_id=ps_id, name="", logo="?")
        db.add(team)
    elif not _team_needs_enrichment(team):
        return team

    detail = await client.get_team(ps_id)
    source = detail or team_brief

    team.name = source.get("name", team_brief["name"])
    team.logo = (source.get("acronym") or team_initials(team.name))[:16]
    team.logo_url = source.get("image_url") or team_brief.get("image_url")
    team.country = source.get("location") or source.get("nationality")

    if ps_id not in players_cache:
        raw_players = await client.get_team_players(ps_id)
        players_cache[ps_id] = parse_players(raw_players)
    team.players_json = dumps_json(players_cache[ps_id])

    roster_stab = compute_roster_stability(players_cache[ps_id])

    if ps_id not in stats_cache:
        past = await client.get_team_past_matches(ps_id, game_slug)
        stats_cache[ps_id] = compute_team_stats(past, ps_id)

    stats = stats_cache[ps_id]
    if stats:
        team.win_rate = stats["win_rate"]
        team.elo = stats["elo"]
        team.recent_form = stats["recent_form"]
        team.map_pool_strength = stats["map_pool_strength"]
        team.matches_sampled = stats["matches_sampled"]
        team.form_history_json = dumps_json(stats.get("form_history", []))
        team.recent_matches_json = dumps_json(stats.get("recent_matches", []))
        team.roster_stability = roster_stab if roster_stab is not None else stats["roster_stability"]
    else:
        team.form_history_json = dumps_json([])
        team.recent_matches_json = dumps_json([])
        if roster_stab is not None:
            team.roster_stability = roster_stab

    return team


async def _enrich_match(
    db: Session,
    client: PandaScoreClient,
    match: Match,
    ps_match: dict,
    game_slug: str,
    team_a: Team,
    team_b: Team,
) -> None:
    ps_id = ps_match.get("id") or match.pandascore_id
    detail = ps_match if ps_match.get("id") else (await client.get_match(ps_id) or ps_match)

    raw_games = await client.get_match_games(ps_id, game_slug)
    games = parse_games(raw_games)
    streams = parse_streams(detail)
    results = parse_results(detail)
    maps = extract_map_names(games)

    match.streams_json = dumps_json(streams)
    match.games_json = dumps_json(games)
    match.results_json = dumps_json(results)
    match.h2h_json = None
    match.map_pool = dumps_json(maps) if maps else None
    match.ps_detail_json = dumps_json({
        "name": detail.get("name"),
        "status": detail.get("status"),
        "match_type": detail.get("match_type"),
        "number_of_games": detail.get("number_of_games"),
        "begin_at": detail.get("begin_at"),
        "end_at": detail.get("end_at"),
        "live_url": detail.get("live_url"),
        "official_stream_url": detail.get("official_stream_url"),
        "rescheduled": detail.get("rescheduled"),
        "draw": detail.get("draw"),
        "forfeit": detail.get("forfeit"),
        "league": detail.get("league"),
        "serie": detail.get("serie"),
        "tournament": detail.get("tournament"),
    })
    match.synced_at = datetime.utcnow()
    db.query(PredictionCache).filter(PredictionCache.match_id == match.id).delete()


def _map_status(ps_status: str) -> str | None:
    if ps_status == "running":
        return "live"
    if ps_status in ("not_started", "pre_match"):
        return "upcoming"
    return None


def purge_legacy_data(db: Session) -> dict:
    """Удаляет старые seed-данные без pandascore_id."""
    stale_matches = db.query(Match).filter(Match.pandascore_id.is_(None)).all()
    for m in stale_matches:
        db.query(PredictionCache).filter(PredictionCache.match_id == m.id).delete()
        db.delete(m)

    synced_team_ids = {
        row[0]
        for row in db.query(Match.team_a_id).filter(Match.pandascore_id.isnot(None)).all()
    } | {
        row[0]
        for row in db.query(Match.team_b_id).filter(Match.pandascore_id.isnot(None)).all()
    }
    teams_q = db.query(Team).filter(Team.pandascore_id.is_(None))
    if synced_team_ids:
        teams_q = teams_q.filter(~Team.id.in_(synced_team_ids))
    stale_teams = teams_q.all()
    for t in stale_teams:
        db.delete(t)

    db.flush()
    return {"removed_matches": len(stale_matches), "removed_teams": len(stale_teams)}


async def sync_from_pandascore(db: Session) -> dict:
    client = PandaScoreClient()
    purge_legacy_data(db)

    games_synced = await sync_games(db, client)
    seen_match_ids: set[str] = set()
    synced_matches = 0

    games = db.query(Game).all()
    for game in games:
        raw: list[tuple[dict, str]] = []
        for ps in await client.get_running_matches(game.pandascore_slug):
            raw.append((ps, "live"))
        for ps in await client.get_upcoming_matches(game.pandascore_slug):
            if _map_status(ps.get("status", "")) == "upcoming":
                raw.append((ps, "upcoming"))

        for ps_match, status in raw:
            teams_data = _extract_teams(ps_match)
            if len(teams_data) < 2:
                continue

            mid = _match_id(ps_match["id"])
            seen_match_ids.add(mid)

            team_a = _upsert_team_brief(db, teams_data[0])
            team_b = _upsert_team_brief(db, teams_data[1])

            match = db.query(Match).filter(Match.pandascore_id == ps_match["id"]).first()
            if not match:
                match = Match(id=mid, pandascore_id=ps_match["id"])
                db.add(match)

            match.id = mid
            match.pandascore_id = ps_match["id"]
            match.game_id = game.id
            match.team_a_id = team_a.id
            match.team_b_id = team_b.id
            match.status = status
            match.format = _match_format(ps_match.get("number_of_games"))
            match.tournament = _tournament_name(ps_match)
            match.is_qualification = _is_qualification(
                ps_match, teams_data[0].get("name", ""), teams_data[1].get("name", "")
            )
            match.scheduled_at = _parse_dt(
                ps_match.get("scheduled_at") or ps_match.get("begin_at")
            )
            _apply_list_payload(match, ps_match)

            synced_matches += 1
            db.commit()

    stale = (
        db.query(Match)
        .filter(Match.pandascore_id.isnot(None))
        .filter(Match.id.notin_(seen_match_ids))
        .all()
    )
    for old in stale:
        db.query(PredictionCache).filter(PredictionCache.match_id == old.id).delete()
        db.delete(old)

    db.commit()
    return {
        "games": games_synced,
        "matches": synced_matches,
        "teams": db.query(Team).filter(Team.pandascore_id.isnot(None)).count(),
        "removed": len(stale),
    }


async def _refresh_team_rosters(
    db: Session,
    client: PandaScoreClient,
    team: Team,
    players_cache: dict[int, list[dict]],
) -> None:
    if not team.pandascore_id:
        return
    if team.pandascore_id not in players_cache:
        raw_players = await client.get_team_players(team.pandascore_id)
        players_cache[team.pandascore_id] = parse_players(raw_players)
    players = players_cache[team.pandascore_id]
    if players:
        team.players_json = dumps_json(players)
        roster_stab = compute_roster_stability(players)
        if roster_stab is not None:
            team.roster_stability = roster_stab


async def ensure_match_details(db: Session, match: Match) -> None:
    """Подгружает детали матча и команд по требованию (страница матча / прогноз)."""
    if not match.pandascore_id or not settings.pandascore_api_key:
        return

    client = PandaScoreClient()
    game_slug = match.game.pandascore_slug
    stats_cache: dict[int, dict | None] = {}
    players_cache: dict[int, list[dict]] = {}

    await _refresh_team_form(db, client, match.team_a, game_slug)
    await _refresh_team_form(db, client, match.team_b, game_slug)
    await _refresh_team_rosters(db, client, match.team_a, players_cache)
    await _refresh_team_rosters(db, client, match.team_b, players_cache)

    needs_teams = _team_needs_enrichment(match.team_a) or _team_needs_enrichment(match.team_b)
    needs_match = _needs_detail_enrichment(match)

    if needs_teams:
        if _team_needs_enrichment(match.team_a):
            await _enrich_team(
                db, client, {"id": match.team_a.pandascore_id, "name": match.team_a.name},
                game_slug, stats_cache, players_cache,
            )
        if _team_needs_enrichment(match.team_b):
            await _enrich_team(
                db, client, {"id": match.team_b.pandascore_id, "name": match.team_b.name},
                game_slug, stats_cache, players_cache,
            )

    if needs_match:
        ps_match = await client.get_match(match.pandascore_id) or {}
        await _enrich_match(
            db,
            client,
            match,
            ps_match,
            game_slug,
            match.team_a,
            match.team_b,
        )

    db.commit()
