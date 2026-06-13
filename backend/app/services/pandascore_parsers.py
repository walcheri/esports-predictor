"""Парсинг ответов PandaScore в структуры для БД и API."""

from __future__ import annotations

import json
from typing import Any


def parse_streams(match: dict) -> list[dict]:
    streams: list[dict] = []
    for s in match.get("streams_list") or []:
        raw = s.get("raw_url") or s.get("embed_url")
        if not raw:
            continue
        streams.append({
            "language": s.get("language", "unknown"),
            "main": bool(s.get("main")),
            "official": bool(s.get("official")),
            "raw_url": raw,
            "embed_url": s.get("embed_url"),
        })
    return streams


def parse_results(match: dict) -> list[dict]:
    results: list[dict] = []
    for r in match.get("results") or []:
        team = r.get("team") or {}
        results.append({
            "team_id": team.get("id"),
            "team_name": team.get("name"),
            "score": r.get("score", 0),
        })
    return results


def parse_games(games: list[dict]) -> list[dict]:
    parsed: list[dict] = []
    for g in games:
        winner = g.get("winner") or {}
        entry: dict[str, Any] = {
            "id": g.get("id"),
            "position": g.get("position"),
            "status": g.get("status"),
            "length": g.get("length"),
            "begin_at": g.get("begin_at"),
            "end_at": g.get("end_at"),
            "winner_id": winner.get("id"),
            "winner_name": winner.get("name"),
            "complete": g.get("complete"),
        }
        # CS:GO / Valorant maps
        if g.get("map"):
            entry["map"] = (g["map"] or {}).get("name") or (g["map"] or {}).get("slug")
        # LoL / Dota
        if g.get("detailed_stats"):
            entry["detailed_stats"] = True
        for key in ("rounds_score", "kills", "deaths", "gold"):
            if g.get(key) is not None:
                entry[key] = g[key]
        parsed.append(entry)
    return parsed


def parse_players(players: list[dict]) -> list[dict]:
    result: list[dict] = []
    for p in players:
        result.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "slug": p.get("slug"),
            "first_name": p.get("first_name"),
            "last_name": p.get("last_name"),
            "image_url": p.get("image_url"),
            "role": p.get("role"),
            "nationality": p.get("nationality"),
            "active": p.get("active"),
        })
    return result


def extract_map_names(games: list[dict]) -> list[str]:
    names: list[str] = []
    for g in games:
        if g.get("map"):
            names.append(g["map"])
    return names


def dumps_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)
