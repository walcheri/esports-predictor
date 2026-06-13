import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth import require_user
from app.database import get_db
from app.models import Match, PredictionCache, User
from app.schemas import FactorBreakdown, PredictionOut, RequestQuotaOut
from app.serializers import parse_map_pool
from app.services.llm import generate_llm_report
from app.services.prediction import compute_prediction, has_prediction_data, prediction_to_cache_dict
from app.services.request_quota import (
    consume_request,
    ensure_can_request,
    quota_snapshot,
    user_has_prediction,
)
from app.services.sync import ensure_match_details
from app.services.user_profile import save_user_prediction, save_user_prediction_from_cache

router = APIRouter(prefix="/api/matches", tags=["predictions"])


def _load_match(db: Session, match_id: str) -> Match | None:
    return (
        db.query(Match)
        .options(
            joinedload(Match.team_a),
            joinedload(Match.team_b),
            joinedload(Match.game),
        )
        .filter(Match.id == match_id)
        .first()
    )


def _cache_to_out(
    cache: PredictionCache,
    is_premium: bool,
    quota: RequestQuotaOut | None = None,
) -> PredictionOut:
    factors = [FactorBreakdown(**f) for f in json.loads(cache.factors_json)]
    key_arguments = json.loads(cache.key_arguments_json)
    return PredictionOut(
        team_a_probability=cache.team_a_probability,
        team_b_probability=cache.team_b_probability,
        confidence=cache.confidence,
        factors=factors,
        key_arguments=key_arguments,
        report=cache.report if is_premium else None,
        report_locked=not is_premium,
        report_source=cache.report_source,
        quota=quota,
    )


def _quota_out(profile, user: User) -> RequestQuotaOut:
    snap = quota_snapshot(profile, user)
    return RequestQuotaOut(**snap)


@router.get("/{match_id}/prediction", response_model=PredictionOut)
async def get_prediction(
    match_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    match = _load_match(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Матч не найден")
    if not match.pandascore_id:
        raise HTTPException(status_code=400, detail="Матч не синхронизирован с PandaScore")

    await ensure_match_details(db, match)
    match = _load_match(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Матч не найден")

    profile = ensure_can_request(db, user, match_id)
    is_premium = user.is_premium
    map_pool = parse_map_pool(match.map_pool)
    already_had = user_has_prediction(db, user.id, match_id)

    cached = db.query(PredictionCache).filter(PredictionCache.match_id == match_id).first()
    if cached:
        if not already_had:
            consume_request(db, profile, user, match_id)
        save_user_prediction_from_cache(db, user, match, cached)
        db.commit()
        db.refresh(profile)
        return _cache_to_out(cached, is_premium, _quota_out(profile, user))

    if not has_prediction_data(match):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Недостаточно данных PandaScore для прогноза (нет составов, статистики и истории матча).",
        )

    result = compute_prediction(match, map_pool)

    if not result.report.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Недостаточно данных PandaScore для формирования отчёта.",
        )

    llm_report = await generate_llm_report(
        match,
        result.report,
        result.team_a_probability,
        result.team_b_probability,
        result.confidence,
        result.key_arguments,
    )
    if llm_report:
        result.report = llm_report
        result.report_source = "pandascore+llm"

    cache_data = prediction_to_cache_dict(result)
    cache = PredictionCache(match_id=match_id, **cache_data)
    db.add(cache)

    if not already_had:
        consume_request(db, profile, user, match_id)

    save_user_prediction(
        db,
        user,
        match,
        team_a_probability=result.team_a_probability,
        team_b_probability=result.team_b_probability,
        report=result.report,
    )

    db.commit()
    db.refresh(cache)
    db.refresh(profile)

    return _cache_to_out(cache, is_premium, _quota_out(profile, user))
