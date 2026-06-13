import json
from dataclasses import dataclass

from app.models import Match, Team
from app.services.match_analytics import (
    get_form_history,
    get_players,
    get_recent_matches,
    loads_json,
    match_has_analytics,
    team_has_stats,
)


@dataclass
class PredictionResult:
    team_a_probability: float
    team_b_probability: float
    confidence: float
    factors: list[dict]
    key_arguments: list[str]
    report: str
    report_source: str


WEIGHTS = {
    "win_rate": 0.35,
    "recent_form": 0.35,
    "roster_stability": 0.15,
    "map_pool": 0.15,
}


def _clamp(value: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, value))


def _team_metric_score(team: Team) -> tuple[float | None, list[dict]]:
    """Счёт только по реальным метрикам из истории матчей PandaScore."""
    if not team_has_stats(team):
        return None, []

    components: list[tuple[float, float]] = []
    factors: list[dict] = []

    if team.win_rate is not None:
        components.append((team.win_rate, WEIGHTS["win_rate"]))
    if team.recent_form is not None:
        components.append((team.recent_form, WEIGHTS["recent_form"]))
    if team.roster_stability is not None and get_players(team):
        components.append((team.roster_stability, WEIGHTS["roster_stability"]))
    if team.map_pool_strength is not None:
        components.append((team.map_pool_strength, WEIGHTS["map_pool"]))

    if not components:
        return None, []

    weight_sum = sum(w for _, w in components)
    score = sum(v * w for v, w in components) / weight_sum
    return score, factors


def _build_key_arguments(match: Match, map_pool: list[str] | None) -> list[str]:
    ta, tb = match.team_a, match.team_b
    args: list[str] = []

    players_a = get_players(ta)
    players_b = get_players(tb)
    if players_a:
        active_a = sum(1 for p in players_a if p.get("active", True))
        args.append(f"{ta.name}: состав {active_a} игрок(ов) (PandaScore).")
    if players_b:
        active_b = sum(1 for p in players_b if p.get("active", True))
        args.append(f"{tb.name}: состав {active_b} игрок(ов) (PandaScore).")

    results = loads_json(match.results_json)
    if results:
        scores = {r.get("team_id"): r.get("score", 0) for r in results}
        sa = scores.get(ta.pandascore_id, 0)
        sb = scores.get(tb.pandascore_id, 0)
        if sa != sb:
            leader = ta.name if sa > sb else tb.name
            args.append(f"Текущий счёт серии: {sa}:{sb} в пользу {leader}.")

    games = loads_json(match.games_json)
    if games:
        finished = [g for g in games if g.get("status") == "finished" and g.get("winner_id")]
        if finished:
            ta_wins = sum(1 for g in finished if g.get("winner_id") == ta.pandascore_id)
            tb_wins = sum(1 for g in finished if g.get("winner_id") == tb.pandascore_id)
            args.append(
                f"Завершённых карт: {len(finished)} — {ta.name} {ta_wins}:{tb_wins} {tb.name}."
            )

    form_a = get_form_history(ta)
    form_b = get_form_history(tb)
    if form_a:
        args.append(f"Форма {ta.name}: {' → '.join(form_a)}.")
    if form_b:
        args.append(f"Форма {tb.name}: {' → '.join(form_b)}.")

    if team_has_stats(ta) and team_has_stats(tb):
        if ta.win_rate is not None and tb.win_rate is not None:
            diff = abs(ta.win_rate - tb.win_rate)
            if diff >= 0.12:
                leader = ta.name if ta.win_rate > tb.win_rate else tb.name
                args.append(
                    f"{leader}: выше винрейт по {max(ta.matches_sampled or 0, tb.matches_sampled or 0)} матчам PandaScore."
                )

    recent_a = get_recent_matches(ta)
    recent_b = get_recent_matches(tb)
    if recent_a:
        last = recent_a[0]
        args.append(
            f"Последний матч {ta.name}: vs {last.get('opponent')} ({last.get('result')}, {last.get('score')})."
        )
    if recent_b:
        last = recent_b[0]
        args.append(
            f"Последний матч {tb.name}: vs {last.get('opponent')} ({last.get('result')}, {last.get('score')})."
        )

    if map_pool:
        args.append(f"Пул карт/иг: {', '.join(map_pool)}.")

    if ta.matches_sampled is not None and ta.matches_sampled < 5:
        args.append(f"{ta.name}: мало исторических матчей в PandaScore ({ta.matches_sampled}).")
    if tb.matches_sampled is not None and tb.matches_sampled < 5:
        args.append(f"{tb.name}: мало исторических матчей в PandaScore ({tb.matches_sampled}).")

    if match.is_qualification:
        args.append("Квалификационный матч — участники или данные могут быть неполными.")

    return args


def _build_factors(ta: Team, tb: Team) -> list[dict]:
    rows: list[tuple[str, float | None, float | None]] = [
        ("Винрейт", ta.win_rate if team_has_stats(ta) else None, tb.win_rate if team_has_stats(tb) else None),
        ("Текущая форма", ta.recent_form if team_has_stats(ta) else None, tb.recent_form if team_has_stats(tb) else None),
        ("Стабильность состава", ta.roster_stability if get_players(ta) else None, tb.roster_stability if get_players(tb) else None),
        ("Сила пула карт", ta.map_pool_strength if team_has_stats(ta) else None, tb.map_pool_strength if team_has_stats(tb) else None),
    ]
    factors: list[dict] = []
    for name, a, b in rows:
        if a is not None and b is not None:
            factors.append({
                "name": name,
                "team_a": round(a * 100),
                "team_b": round(b * 100),
            })
    return factors


def compute_prediction(match: Match, map_pool: list[str] | None) -> PredictionResult:
    score_a, _ = _team_metric_score(match.team_a)
    score_b, _ = _team_metric_score(match.team_b)

    if score_a is not None and score_b is not None:
        total = score_a + score_b
        team_a_prob = score_a / total
        team_b_prob = score_b / total
        if match.is_qualification:
            team_a_prob = _clamp(team_a_prob, 0.35, 0.65)
            team_b_prob = 1 - team_a_prob
        diff = abs(team_a_prob - team_b_prob)
        sample_penalty = 0.0
        for t in (match.team_a, match.team_b):
            if team_has_stats(t) and (t.matches_sampled or 0) < 5:
                sample_penalty += 0.08
        confidence = _clamp(0.45 + diff * 0.7 - sample_penalty, 0.35, 0.9)
    else:
        team_a_prob = 0.5
        team_b_prob = 0.5
        confidence = 0.35

    factors = _build_factors(match.team_a, match.team_b)
    key_arguments = _build_key_arguments(match, map_pool)

    from app.services.report_builder import build_pandascore_report

    report = build_pandascore_report(match, team_a_prob, team_b_prob, confidence)

    return PredictionResult(
        team_a_probability=team_a_prob,
        team_b_probability=team_b_prob,
        confidence=confidence,
        factors=factors,
        key_arguments=key_arguments,
        report=report,
        report_source="pandascore",
    )


def prediction_to_cache_dict(result: PredictionResult) -> dict:
    return {
        "team_a_probability": result.team_a_probability,
        "team_b_probability": result.team_b_probability,
        "confidence": result.confidence,
        "factors_json": json.dumps(result.factors, ensure_ascii=False),
        "key_arguments_json": json.dumps(result.key_arguments, ensure_ascii=False),
        "report": result.report,
        "report_source": result.report_source,
    }


def has_prediction_data(match: Match) -> bool:
    return match_has_analytics(match)
