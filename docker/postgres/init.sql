-- Esports Predictor — PostgreSQL
-- Таблицы создаёт приложение (SQLAlchemy). Здесь только расширения и настройки.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

COMMENT ON DATABASE predict IS 'Esports Predictor: users, profiles, predictions, matches';
