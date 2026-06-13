"""Лёгкие миграции без Alembic (SQLite + PostgreSQL)."""

from sqlalchemy import inspect, text

from app.database import engine

_NEW_TEAM_COLS = {
    "logo_url": "VARCHAR(512)",
    "pandascore_id": "INTEGER",
    "country": "VARCHAR(8)",
    "players_json": "TEXT",
    "matches_sampled": "INTEGER",
    "form_history_json": "TEXT",
    "recent_matches_json": "TEXT",
}

_NEW_MATCH_COLS = {
    "pandascore_id": "INTEGER",
    "streams_json": "TEXT",
    "games_json": "TEXT",
    "results_json": "TEXT",
    "h2h_json": "TEXT",
    "ps_detail_json": "TEXT",
    "synced_at": "TIMESTAMP",
}

_NEW_GAME_COLS = {
    "pandascore_slug": "VARCHAR(64)",
    "pandascore_id": "INTEGER",
}

_NEW_USER_COLS = {
    "updated_at": "TIMESTAMP",
    "email_verified": "BOOLEAN DEFAULT 0",
}

_NEW_PROFILE_COLS = {
    "requests_used": "INTEGER DEFAULT 0",
}

_NEW_USER_PREDICTION_COLS = {
    "full_report": "TEXT",
}


def _is_sqlite() -> bool:
    return engine.dialect.name == "sqlite"


def _column_not_null_sqlite(table: str, column: str) -> bool:
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    for row in rows:
        if row[1] == column:
            return bool(row[3])
    return False


def _rebuild_teams_table_sqlite() -> None:
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        conn.execute(
            text("""
            CREATE TABLE teams_new (
                id VARCHAR(64) PRIMARY KEY,
                pandascore_id INTEGER UNIQUE,
                name VARCHAR(128) NOT NULL,
                logo VARCHAR(16) NOT NULL,
                logo_url VARCHAR(512),
                country VARCHAR(8),
                players_json TEXT,
                win_rate FLOAT,
                elo INTEGER,
                roster_stability FLOAT,
                recent_form FLOAT,
                map_pool_strength FLOAT,
                matches_sampled INTEGER
            )
            """)
        )
        conn.execute(
            text("""
            INSERT INTO teams_new (
                id, pandascore_id, name, logo, logo_url, country, players_json,
                win_rate, elo, roster_stability, recent_form, map_pool_strength, matches_sampled
            )
            SELECT
                id, pandascore_id, name, logo, logo_url, country, players_json,
                win_rate, elo, roster_stability, recent_form, map_pool_strength, matches_sampled
            FROM teams
            """)
        )
        conn.execute(text("DROP TABLE teams"))
        conn.execute(text("ALTER TABLE teams_new RENAME TO teams"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_teams_pandascore_id ON teams (pandascore_id)"))
        conn.execute(text("PRAGMA foreign_keys=ON"))


def _pg_column_def(typedef: str) -> str:
    return typedef.replace("BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE")


def _add_columns(table: str, columns: dict[str, str]) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns(table)}
    with engine.begin() as conn:
        for name, typedef in columns.items():
            if name in existing:
                continue
            if _is_sqlite():
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {typedef}"))
            else:
                conn.execute(
                    text(
                        f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {_pg_column_def(typedef)}"
                    )
                )


def run_migrations() -> None:
    if _is_sqlite():
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        if "teams" in tables and _column_not_null_sqlite("teams", "win_rate"):
            _rebuild_teams_table_sqlite()

    _add_columns("teams", _NEW_TEAM_COLS)
    _add_columns("matches", _NEW_MATCH_COLS)
    _add_columns("games", _NEW_GAME_COLS)
    _add_columns("users", _NEW_USER_COLS)
    _add_columns("profiles", _NEW_PROFILE_COLS)
    _add_columns("user_predictions", _NEW_USER_PREDICTION_COLS)

    _backfill_profiles()
    _cleanup_unverified_users()
    _fix_qualification_flags()


def _backfill_profiles() -> None:
    from app.database import SessionLocal
    from app.models import Profile, User
    from app.services.user_profile import ensure_profile

    db = SessionLocal()
    try:
        users = db.query(User).all()
        changed = False
        for user in users:
            if not db.query(Profile).filter(Profile.user_id == user.id).first():
                ensure_profile(db, user)
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()


def _cleanup_unverified_users() -> None:
    """Удаляем незавершённые регистрации старого формата (без подтверждения email)."""
    from app.database import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        stale = db.query(User).filter(User.email_verified.is_(False)).all()
        if stale:
            for user in stale:
                db.delete(user)
            db.commit()
    finally:
        db.close()


def _fix_qualification_flags() -> None:
    from app.database import SessionLocal
    from app.models import Match, Team
    from app.services.sync import _is_qualifier_team

    db = SessionLocal()
    try:
        teams = {t.id: t.name for t in db.query(Team).all()}
        changed = False
        for match in db.query(Match).all():
            a = teams.get(match.team_a_id, "")
            b = teams.get(match.team_b_id, "")
            flag = _is_qualifier_team(a) or _is_qualifier_team(b)
            if match.is_qualification != flag:
                match.is_qualification = flag
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()
