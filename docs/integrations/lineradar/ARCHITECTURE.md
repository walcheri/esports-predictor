# Архитектура интеграции LineRadar v1 (пока без live)
Статус: **проект + типовой контракт**. Не работает как подключение и не использует API. Совместный review обязателен.

```
PandaScore/GRID → Supabase Edge → нормализованные матчи → web UI
                                        ↑
LineRadar [private VPS, Python, SQLite, API-Sport]
    ↓ (только после лицензии и owner approval)
signed backend-only event → Supabase ingest → quarantine/verified match registry
    → server-side rights and entitlement gate → sanitized public DTO → read-only Radar UI
```

### Разделение ответственности
- LineRadar владеет платным API, квотой, нормализацией исходов, evidence, dedup, Telegram, состоянием VPS. **Не включать** `PRODUCTION_ENABLED` или `COMMERCIAL_REDISTRIBUTION_AUTHORIZED` через веб-репозиторий.
- Predictor владеет user/auth, frontend, каталожными esports-матчами и отчётами. В браузере не бывает ключа LineRadar/API-Sport или прямого адреса чувствительного ingest.
- Backend мост с подписью/ротацией ключей, timestamp+nonce/replay prevention, rate limits и allowlist должен появиться только после проверки прав на ретрансляцию.
- `verified_match_links` должен связывать различные IDs после проверки двух team IDs, дисциплины, турнира, start UTC, BO; non-match → quarantine. Лишь verified связь даёт UI ссылку.
- `SeriesWinner` НЕ тождественен победителю карты; поставщик должен подтвердить рынок BO1/3/5. Два исхода esports, футбольный 1X2 не совмещать.
- В Supabase таблицы с default-deny RLS: `radar_ingest_events` (private), `verified_match_links` (private), `radar_public_signals` (rights-gated). Отдельная политика TTL/retention и отсутствие секретов в журналах.
- Котировки и изменения — не модельные вероятности; избегать некалиброванного синтеза. Указывать источник/время/актуальность. При отсутствии данных показывать unavailable, а не 0%.
- Фронтенд без разрешений на публикацию должен оставаться работоспособным **без радара**.

### План PR для Codex
1. P0 security & integrity (edge auth, quota, RLS, убрать fabricated stats, базовый CI).
2. Canonical Match + provenance + verified mapping, мок-тесты.
3. Отключённый private bridge, ingest tests без реальных запросов.
4. Radar UI feature flag off, authorization, expiry/stale states.
5. Отдельно лицензия, нагрузочные тесты, synthetic smoke, staging+pilot.

Текущий `src/lib/lineradar/contract.ts` — **только TS/Zod схема offline**, не сетевой клиент и не разрешение публиковать данные.
