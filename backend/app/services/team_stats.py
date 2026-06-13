"""Расчёт метрик команды только по реальным матчам PandaScore."""

from __future__ import annotations


_SKIP_STATUSES = frozenset({"canceled", "cancelled", "postponed", "not_played"})


def _winner_team_id(winner: dict | None) -> int | None:
    if not winner:
        return None
    if winner.get("type") == "Team":
        return winner.get("id")
    wid = winner.get("id")
    return wid if isinstance(wid, int) else None


def _team_won(match: dict, team_id: int) -> bool | None:
    wid = _winner_team_id(match.get("winner"))
    if wid is None:
        return None
    return wid == team_id


def _match_result_label(match: dict, team_id: int) -> str | None:
    if match.get("status") in _SKIP_STATUSES:
        return None
    if match.get("draw"):
        return "D"
    won = _team_won(match, team_id)
    if won is None:
        return None
    return "W" if won else "L"


def _opponent_name(match: dict, team_id: int) -> str:
    for opp in match.get("opponents") or []:
        opponent = opp.get("opponent") or {}
        if opponent.get("id") != team_id:
            return opponent.get("name", "—")
    return "—"


def _match_score_str(match: dict, team_id: int) -> str:
    results = match.get("results") or []
    if len(results) < 2:
        return "—"
    scores = {r.get("team_id"): r.get("score", 0) for r in results}
    my = scores.get(team_id, 0)
    opp_id = next((r.get("team_id") for r in results if r.get("team_id") != team_id), None)
    opp = scores.get(opp_id, 0) if opp_id else 0
    return f"{my}-{opp}"


def build_recent_matches(past_matches: list[dict], team_id: int, limit: int = 5) -> list[dict]:
    items: list[dict] = []
    for match in past_matches:
        if match.get("status") in _SKIP_STATUSES:
            continue
        label = _match_result_label(match, team_id)
        if not label:
            continue
        begin = match.get("end_at") or match.get("begin_at")
        date = str(begin)[:10] if begin else "—"
        items.append({
            "opponent": _opponent_name(match, team_id),
            "date": date,
            "result": "win" if label == "W" else "loss" if label == "L" else "draw",
            "score": _match_score_str(match, team_id),
        })
        if len(items) >= limit:
            break
    return items


def build_form_history(past_matches: list[dict], team_id: int, limit: int = 5) -> list[str]:
    history: list[str] = []
    for match in past_matches:
        label = _match_result_label(match, team_id)
        if not label:
            continue
        history.append(label)
        if len(history) >= limit:
            break
    return history


def compute_team_stats(past_matches: list[dict], team_id: int) -> dict[str, float | int] | None:
    if not past_matches:
        return None

    results: list[bool] = []
    for match in past_matches:
        won = _team_won(match, team_id)
        if won is not None:
            results.append(won)

    if not results:
        return None

    wins = sum(1 for r in results if r)
    win_rate = wins / len(results)

    weighted = 0.0
    weight_sum = 0.0
    for i, won in enumerate(results[:15]):
        w = 0.85 ** i
        weighted += (1.0 if won else 0.0) * w
        weight_sum += w
    recent_form = weighted / weight_sum if weight_sum else win_rate

    elo = int(1500 + (win_rate - 0.5) * 800 + (recent_form - 0.5) * 200)
    elo = max(1200, min(2200, elo))
    roster_stability = min(0.95, 0.6 + len(results) * 0.02)
    map_pool_strength = min(0.95, win_rate * 0.7 + recent_form * 0.3)

    return {
        "win_rate": round(win_rate, 4),
        "elo": elo,
        "roster_stability": round(roster_stability, 4),
        "recent_form": round(recent_form, 4),
        "map_pool_strength": round(map_pool_strength, 4),
        "matches_sampled": len(results),
        "form_history": build_form_history(past_matches, team_id),
        "recent_matches": build_recent_matches(past_matches, team_id),
    }


def compute_roster_stability(players: list[dict]) -> float | None:
    if not players:
        return None
    active = sum(1 for p in players if p.get("active", True))
    return round(min(0.98, active / max(len(players), 1)), 4)


def team_initials(name: str) -> str:
    parts = [p for p in name.replace(".", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:3].upper()
    return "".join(p[0] for p in parts[:2]).upper()
