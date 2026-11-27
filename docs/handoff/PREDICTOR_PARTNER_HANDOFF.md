# Передача Predictor — 2026-11-27

**READY_FOR_OFFLINE_REVIEW.** Настоящий staging, лицензия, тариф, квота, PIT dataset и точность модели не проверены. Live probe не разрешён. LineRadar, VPS, Telegram и main не изменены.

## Стек review
Совокупный A–E код + подготовка: `codex/predictor-real-data-readiness`, база нового draft PR `codex/predictor-frontend`. Закреплять полный SHA из PR перед review.

| PR | Head SHA | Base |
|---|---|---|
| #6 security | 3c3eff0f7d9eb2e0b4c8361ec262b40baadf1230 | main ede72f3fe921b80cd4c32b4e8d7746d496bde5c1 |
| #7 data | 34a202c83b3ccb04933e17d0ad2fc0dfc966f592 | #6 |
| #8 statistics | 196e116225545a39b0b6467ce602a144f33b0e13 | #7 |
| #9 model | 4854848b32d857e0f76b0e5c571cefea19b6fdc4 | #8 |
| #10 frontend | 040e4fbd5a149dc49628e882002951f470dae9fa | #9 |

PR10 code f37c44e9759494776e8c8b109463bd97922292f5; финальный отчётный HEAD 040e4fb: [успешный CI](https://github.com/walcheri/esports-predictor/actions/runs/45951088736).
Ручной порядок после review: #6 → #7 → #8 → #9 → #10 → новый PR. После каждого merge проверить/перенацелить следующую базу и CI, не squash/rebase цепочку вслепую. Здесь merge не выполнялся.
PR #1 OpenDota напарника (0c10e8126a2c04e984ae1792ebf3f2da713e237c) и #5 LineRadar (305259c4a82a89293f64ac5ac978c3e92eb89a06) отдельные. OpenDota требует собственных namespace, DTO, provenance, license и PIT-тестов, не подставлять его данные под PandaScore IDs.

## Windows PowerShell и Linux
Нужны Git, Node 22/npm. Команды из отдельного checkout, существующие изменения не стирать:

```sh
git fetch origin
git worktree add --detach ../predictor-review origin/codex/predictor-real-data-readiness
cd ../predictor-review
git rev-parse HEAD
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=low
npm run security:secrets
npx playwright install chromium
npm run test:e2e
```

Linux runner: `npx playwright install --with-deps chromium` только в разрешённой среде. CI также проверяет Deno Edge и одноразовую PostgreSQL. `scripts/test-database.mjs` только для disposable localhost predictor_test, никогда для staging/production.
Для UI: PowerShell `Copy-Item .env.example .env.local`, Linux `cp .env.example .env.local`. Оба external flags false. Offline URL `https://offline.invalid`, publishable key `offline-placeholder` — заглушки, auth не работает. `npm run dev -- --host 127.0.0.1`. Playwright блокирует внешнюю сеть и подставляет mocks. Vite6/Router7/Zod4/Lovable config проверяются types/build/browser; публикация Lovable не проверена.

## Dataset pipeline (обе ОС)
Каждый output — новый пустой подкаталог .local. Не публиковать sample/logs. На Windows mode0600 не заменяет ACL: перед реальными данными выбрать приватный каталог вне OneDrive/общих папок, проверить ACL своей учётной записи.

```sh
npm run dataset -- example --out .local/example-01
npm run dataset -- validate-dataset --input .local/example-01/synthetic.json --out .local/validate-01
npm run dataset -- convert --input .local/example-01/synthetic.json --out .local/convert-01
npm run dataset -- backtest --input .local/example-01/synthetic.json --out .local/backtest-01 --calibration-start 2026-01-11T00:00:00Z --test-start 2026-02-15T00:00:00Z
npm run probe -- --out .local/probe-dry-01 --max-requests 3
npm run dataset -- validate-dataset --input .local/probe-dry-01/sample.json --out .local/probe-validate-01
```

Последняя команда ожидаемо exit2 (нет historical roster/PIT), остальные synthetic примеры exit0. CLI exit1 — отклонение команды/пути/разрешения; exit2 — недостаточность или лимит; exit0 не означает одобрение модели.
Manifest: SHA256 JSON-сериализации входа (не исходных байтов), source/schema, legal reference hash, collectedAt, coverage/missing/reasons/counts, convertedSha256 также от JSON-сериализации. Quarantine: индекс/digest/reason без payload. Converted содержит необходимые ID/времена/результаты и остаётся лицензируемым локальным файлом. Backtest повторно валидирует исходный dataset, не доверяет отдельному converted.

### Контракт predictor-pit-v1
Исполняемая строгая схема scripts/lib/dataset.ts; полный synthetic пример — команда example. Лишние поля запрещены.
Корень: synthetic, provider=pandascore, game, collectedAt, license (approved/reference/purpose/storageAllowed/backtestAllowed/expiresAt), acquisition (scope=bounded-sample/completedPlan/httpStatuses), observations, rosters.
Observation: recordId, eventId/seriesId pandascore:match:N, level=series, game, phase=prematch/result/cancellation, team1Id/team2Id pandascore:team:N, tournamentId pandascore:tournament:N, bestOf1/3/5, startsAt/endedAt, winnerId, obtainedAt, availableAt. Неизвестное null, не0; timezone обязателен, нормализуется UTC.
**Наш seriesId — head-to-head BO match, НЕ PandaScore serie_id (сезон лиги).** Карты отклоняются. Отмена/противоречие участников/BO/расписания/результата карантинирует событие.
Roster: recordId/teamId/game, пять разных pandascore:player:N, effectiveFrom/To, obtainedAt/availableAt, basis=historical_observation, evidenceReference. Current snapshot не становится историческим от подставленного effectiveFrom. Evidence/timestamps обязан подтвердить сборщик; схема не доказывает правдивость заявления.
Доступность max(obtainedAt,availableAt), при неизвестной публикации obtainedAt; дата результата не заменяет дату получения. Prematch независимо получен до startsAt без winner/end. Минимум30 пригодных событий — входной барьер; backtest дополнительно требует30 calibration и30 held-out, обучение строго раньше cutoff. Любой HTTP!=200/незавершённый план блокирует convert, даже при частичных данных.
Core: _shared/statistics.ts и _shared/model.ts, series-elo-v2-pit-roster. Разделены game/BO, chronological train/calibration/test, Brier/logloss/0.5baseline/calibration bins. Пять подтверждённых игроков не ослаблены. У сегодняшнего среза ожидаемо нулевое historical roster coverage. Result-only research baseline возможен отдельной версией/PR без недоказанных roster features и production approval.

## Будущий разрешённый probe: сейчас НЕ выполнять
Только PandaScore CS2. Два маршрута /csgo/matches/upcoming и /csgo/matches/past, первая страница per_page50. По умолчанию mock0network. Live: server-only Bearer, exact host, redirect:error, timeout8s, body≤1MB, один retry network/5xx, stop401/403/429. Default cap3, верхний40; текущий план максимум4 попытки, полная пагинация НЕ заявляется.
Официальные документы проверены27.11.2026: [plans](https://developers.pandascore.co/docs/plan-reference), [auth](https://developers.pandascore.co/docs/authentication), [CS2 endpoint](https://developers.pandascore.co/reference/get_csgo_matches_upcoming-1). Тариф/лимиты/права хранения НЕ подтверждены. Публичный маршрут не равен лицензии.
Владелец/напарник предоставляет: дисциплина/один тариф, разрешение closed noncommercial storage/backtest, reference/expiry, фактическая квота, отсутствие других клиентов, дневной/месячный денежный предел, отдельный staging URL/права и live approval. Секрет PANDASCORE_PROBE_TOKEN через локальный secret manager/environment, НЕ чат/GitHub.
Скопировать probe-approval.example.json в защищённый .local/approval.json, заполнить подтверждёнными значениями. Шаблон намеренно невалиден. Assessment≤15min, approval≤24h/UTC-day, reserve20%, minute≤5, experiment≤40. Денежные поля microUSD, 1USD=1000000; zero только для подтверждённого бесплатного тарифа.
Digest: PowerShell `(Get-FileHash .local/approval.json -Algorithm SHA256).Hash.ToLower()`; Linux `sha256sum .local/approval.json`.

**НЕ ВЫПОЛНЯТЬ БЕЗ APPROVAL** (секрет уже в окружении):
```sh
npm run probe -- --live --provider pandascore --game cs2 --approval .local/approval.json --approval-sha256 APPROVED_DIGEST --run-id owner-approved-001 --max-requests 3 --out .local/approved-001
```
Единый .local/probe-state/pandascore.jsonl: exclusive lock + append/fsync перед каждым HTTP; неопределённые попытки не возвращаются, run-id не повторяется, sentinel/повреждение/clock rollback/ledger>10MB блокируют. Не удалять ledger/sentinel/lock ради перезапуска. Crash требует ручной проверки. Общий лимит чужих клиентов не гарантируется: approval требует noOtherClients. Консервативный baseline может двойно учитывать попытки — безопасный недорасход. Не сбрасывать историю при новом approval.
Минимальные ID/времена/результаты и численные diagnostics сохраняются локально; имена/логотипы/raw/error bodies не записываются. Разовый sample не заменяет prospective PIT collection.

## Staging и оставшиеся условия
[STAGING_READINESS.md](STAGING_READINESS.md). Staging не создан/не проверен. Probe независим от external flags и имеет отдельное разрешение.

READY_FOR_CONTROLLED_REAL_DATA_TEST:
- [x] Offline import/quarantine/manifests, strict PIT, mock pipeline и инструкции.
- [ ] Review stack/CI — reviewer/напарник.
- [ ] Лицензия, тариф/стоимость/квота, разрешение live — владелец.
- [ ] Secret защищённым способом, staging URL/права — владелец.
- [ ] Настоящие staging auth/RLS/budgets/rollback — напарник после разрешения.
- [ ] Подтверждение полей настоящего sample — ответственный за approved probe.

READY_FOR_REAL_PILOT (отдельный этап): prospective PIT dataset/исторические rosters; достаточный независимый temporal backtest/coverage/calibration; серверная versioned модель и immutable forecast; review, operational monitoring, privacy/retention и rollback.
Живой прогноз сейчас сознательно INSUFFICIENT_DATA. History-model approval, historical PIT collection, real backtest и LineRadar не готовы. На данные в офлайн-этапе потрачено0; будущие расходы не подтверждены.
