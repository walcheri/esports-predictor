"""Профили, история прогнозов и waitlist — как в esports-predictor."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Match, PredictionCache, Profile, User, UserPrediction


def ensure_profile(db: Session, user: User) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile:
        if profile.email != user.email:
            profile.email = user.email
        return profile

    profile = Profile(user_id=user.id, email=user.email, predictions_count=0)
    db.add(profile)
    db.flush()
    return profile


def save_user_prediction(
    db: Session,
    user: User,
    match: Match,
    *,
    team_a_probability: float,
    team_b_probability: float,
    report: str | None,
) -> UserPrediction:
    profile = ensure_profile(db, user)
    predicted_winner = (
        match.team_a.name
        if team_a_probability >= team_b_probability
        else match.team_b.name
    )
    preview = (report or "")[:200] or None
    full_report = report or None

    existing = (
        db.query(UserPrediction)
        .filter(
            UserPrediction.user_id == user.id,
            UserPrediction.match_id == match.id,
        )
        .first()
    )
    if existing:
        existing.team_a = match.team_a.name
        existing.team_b = match.team_b.name
        existing.game_id = match.game_id
        existing.tournament = match.tournament
        existing.predicted_winner = predicted_winner
        existing.team_a_probability = team_a_probability
        existing.team_b_probability = team_b_probability
        existing.report_preview = preview
        existing.full_report = full_report
        return existing

    row = UserPrediction(
        user_id=user.id,
        match_id=match.id,
        team_a=match.team_a.name,
        team_b=match.team_b.name,
        game_id=match.game_id,
        tournament=match.tournament,
        predicted_winner=predicted_winner,
        team_a_probability=team_a_probability,
        team_b_probability=team_b_probability,
        report_preview=preview,
        full_report=full_report,
    )
    db.add(row)
    profile.predictions_count = (profile.predictions_count or 0) + 1
    return row


def save_user_prediction_from_cache(
    db: Session, user: User, match: Match, cache: PredictionCache
) -> UserPrediction | None:
    existing = (
        db.query(UserPrediction)
        .filter(
            UserPrediction.user_id == user.id,
            UserPrediction.match_id == match.id,
        )
        .first()
    )
    if existing:
        return existing
    return save_user_prediction(
        db,
        user,
        match,
        team_a_probability=cache.team_a_probability,
        team_b_probability=cache.team_b_probability,
        report=cache.report,
    )
