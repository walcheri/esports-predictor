# Деплой Esports Predictor

## Почему на `:8000` не было главной страницы

| Режим | URL | Что открывается |
|-------|-----|-----------------|
| **Разработка** | `http://127.0.0.1:5173` | Главная страница (Vite) |
| **Разработка** | `http://127.0.0.1:8000` | Только API (`/api/...`) |
| **Продакшен** | `http://127.0.0.1:8000` | Главная + API на одном порту |

В dev фронтенд и бэкенд — **два отдельных сервера**. Порт 8000 никогда не был главной страницей в режиме разработки.

---

## Быстрый старт (локальный прод)

```bash
# 1. Секреты
cp .env.example .env
# Заполните JWT_SECRET и OPENAI_API_KEY

# 2. В .env включите прод-режим:
#    APP_ENV=production
#    SERVE_STATIC=true
#    JWT_SECRET=<надёжный-ключ>

# 3. Сборка + запуск (всё на :8000)
npm install
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd ..
npm run start
```

Откройте: **http://127.0.0.1:8000** — главная страница.

---

## Разработка (два терминала)

```bash
# Терминал 1 — API
cd backend && source .venv/bin/activate && python run.py

# Терминал 2 — фронтенд с hot-reload
npm run dev
```

Главная: **http://127.0.0.1:5173**

---

## Docker (рекомендуется для прода)

```bash
cp .env.example .env
# Обязательно: JWT_SECRET, POSTGRES_PASSWORD, OPENAI_API_KEY

docker compose up --build -d
```

Приложение: **http://localhost:8000**

---

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `APP_ENV` | `development` / `production` |
| `SERVE_STATIC` | `true` — отдавать `dist/` с бэкенда |
| `JWT_SECRET` | Секрет JWT (обязателен в prod) |
| `OPENAI_API_KEY` | Ключ LLM (без него — шаблонный отчёт) |
| `DATABASE_URL` | SQLite или PostgreSQL |
| `CORS_ORIGINS` | Разрешённые origin через запятую |
| `VITE_API_URL` | Только dev; в prod пустой (same-origin) |
| `PANDASCORE_API_KEY` | Ключ PandaScore — матчи и команды |
| `SYNC_ON_STARTUP` | Синхронизация при старте (`true`/`false`) |
| `SYNC_INTERVAL_MINUTES` | Авто-синк каждые N минут |

Ключ PandaScore: https://pandascore.co/

---

## Структура продакшена

```
:8000
├── /              → React SPA (главная)
├── /game/:id      → React SPA
├── /match/:id     → React SPA
├── /assets/*      → JS/CSS бандлы
└── /api/*         → FastAPI (БД, прогнозы, LLM, auth)
```
