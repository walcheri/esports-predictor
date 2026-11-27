# 27.11.2026 — real-data test readiness

## Фактический статус
READY_FOR_OFFLINE_REVIEW. Работа выполнена локально в Windows, без live API, staging, email, Groq, VPS, LineRadar или Telegram. Отдельная ветка codex/predictor-real-data-readiness от PR10 HEAD040e4fbd5a149dc49628e882002951f470dae9fa; новый draft PR базируется на codex/predictor-frontend. Main/PR1/PR5 не изменены, merge/deploy не выполнены.

## Реализовано
- Строгий predictor-pit-v1 offline contract и CLI validate-dataset → quarantine/manifest → convert → backtest. Только qualified IDs и минимальные поля, licence/storage/backtest gates, независимые prematch/result/roster knowledge timestamps. Конфликты, cancellation, wrong game, maps, future leakage исключаются; null остаётся неизвестностью. Исторические составы: пять подтверждённых игроков, exact intervals, current snapshot не принимается.
- Проверки конфликтующих recordId событий/составов; испорченная ревизия не позволяет выбрать удобный результат. Hash/quarantine без raw payload, outputs только новый .local подкаталог, symlink/outside-output отклоняются. Старый backtest CLI ограничен synthetic, real import обязан пройти новый validator.
- Отдельный PandaScore CS2 probe: mock по умолчанию, explicit live approval/digest/expiry/license/quota gate, секрет server env, exact host/route, redirect deny, 8s timeout/1MB body, stop401/403/429, bounded retry с резервированием каждой попытки. Максимум40 attempts, ≤5/min, reserve20%, durable fsync ledger/lock/sentinel, persisted budgets и run-id replay protection. Ledger не сбрасывается после ошибок/перезапуска.
- Daily/monthly monetary ceilings, approval expiry/UTC rollover, corruption/clock rollback/oversized ledger fail closed. Plan bounded:first upcoming+past page; никаких обещаний полной выборки/исторического PIT.
- Partner handoff, approval template (намеренно невалидный), staging/rollback checklist; disabled external flags сохранены. Actual model OK сознательно не включён.

## Проверки
Локально: 58 unit/CLI tests (34 прежних +24 новых), typecheck, lint, npm audit (0 vulnerabilities), security:secrets — exit0. Synthetic pipeline прошёл полностью, default mock probe0network, downstream неполный sample ожидаемо exit2. Local build/browser завершены успешно; подтверждённые CI результаты ниже.
Новые тесты охватывают leakage, late publication, same-day roster changes, current-as-historical, map/series, duplicate/conflicting IDs, 401/403/429/partial, cancellation, license, sample size, game, shuffled input, zero/null, quota persistence/lock/replay/cost/reserve/midnight, bounded body/allowlist/retries, error redaction, сквозные CLI и fresh outputs.

## Источники и ограничения
Официальная документация PandaScore plan-reference/authentication/CS2 upcoming прочитана; actual subscription, endpoints data, tariff/quota и юридические права не проверены реальными запросами. Наш seriesId означает BO match, не PandaScore season serie_id. Readiness manifest — проверка контракта, не доказательство истинности timestamps/лицензионных заявлений. Manifest hash вычислен от JSON-сериализации, не исходных байтов.
Разовый probe не содержит historical rosters и сопоставимых prospective prematch/results, поэтому honest INSUFFICIENT_DATA. Synthetic80 events и backtest не доказывают accuracy. Result-only baseline не реализован и требует отдельного research review.
CI PostgreSQL — disposable, не actual Supabase Auth/RLS gateway. Staging migrations/backup/rollback не выполнены. На Windows mode0600 не равен ACL, настоящие sample хранить вне синхронизируемых/общих директорий. Opaque secrets требуют manual review помимо pattern scanner.

## Следующие действия и ответственные
1. Reviewer/напарник: review цепочки6→10→этот draft, сверка CI, затем только разрешённые merges.
2. Владелец: provider/CS2 tariff и права closed noncommercial/storage/backtest, бюджеты/квота, отдельное probe approval, secret через защищённое окружение и staging доступ. Не присылать ключи в чат/GitHub.
3. Напарник после разрешения: реальные staging Auth/RLS/budgets/rollback; минимальный approved probe; prospective PIT сбор; независимый temporal backtest/coverage/calibration.
4. После успешных prerequisites отдельно оценить READY_FOR_CONTROLLED_REAL_DATA_TEST. READY_FOR_REAL_PILOT/production/точность сейчас не заявляются.

Команды Windows/Linux, SHAs/базы PR, exit codes и будущий live-пример (не выполнять без approval): docs/handoff/PREDICTOR_PARTNER_HANDOFF.md. Стоимость данных текущего offline этапа0; будущие данные/инфраструктура не оплачены и стоимость не подтверждена.

## Подтверждённые локальные результаты
Code commit: f307b1204de3fe555578930d6f015eeac13344cb; draft https://github.com/walcheri/esports-predictor/pull/11 . Push подтверждён совпадением remote SHA.

| Проверка | Среда | Результат / exit |
|---|---|---|
| npm test | Windows local | 58/58, 0 |
| npm run typecheck | Windows local | app/core/e2e, 0 |
| npm run lint | Windows local | без ошибок/warnings, 0 |
| npm run build | Windows local | 0; сохраняется warning chunk>500kB |
| npm run test:e2e | Windows local | 9/9, 0; только mocked network |
| npm audit --audit-level=low | Windows local | 0 vulnerabilities, 0 |
| npm run security:secrets | Windows local | PASS, 0; opaque secrets требуют manual review |
| Synthetic example/validate/convert/backtest | Windows local | 0; 80 events,160 observations,2 rosters; PIT/roster coverage1; held-out35 |
| Default probe + validate sample | Windows local | probe0/mock2attempts/0network; validator2 ожидаемо |

Synthetic backtest raw Brier0.2398702901, logloss0.6756761404, baseline0.25/0.6931471806; это только воспроизводимый контроль вычислений, НЕ измерение реальной accuracy. Порог30 в CLI не заменяет предлагаемые research1000/300/500 train/calibration/test. Произвольное ретроспективное присвоение timestamps запрещено.

## Подтверждённый GitHub Actions
[Run45954220049](https://github.com/walcheri/esports-predictor/actions/runs/45954220049), code HEAD f307b1204de3fe555578930d6f015eeac13344cb: **completed/success**, все5jobs.
- Windows application job140356839426: npm ci/test/typecheck/build, Playwright install и9e2e — success; логи подтверждают58/58unit и9/9browser.
- Ubuntu application job140356839449: те же58/58unit и9/9browser — success.
- lint job140356839378: lint0, npm audit0 vulnerabilities, secretsPASS.
- edge-types job140356839118: Deno check всех четырёх Edge entrypoints — success.
- database job140356839736: disposablePostgreSQL16, migration replay A/E, RLS/guest/forged waitlist/protected counters;40parallel reservations capped5/50 — PASS. Permission-denied/invalid-email в PostgreSQL logs — ожидаемые негативные сценарии, не пропущенные ошибки.

Повторная сверка GitHub: PR6–10 остаются draft с исходными head/base SHA из handoff; PR1/5 не изменены, main=ede72f3fe921b80cd4c32b4e8d7746d496bde5c1. PR11 draft base=codex/predictor-frontend, baseSHA040e4fbd5a149dc49628e882002951f470dae9fa. Отчётный follow-up commit меняет только Markdown; код проверен SHA выше. Актуальный HEAD и его CI видны в PR11, не выдаются за тот же SHA.
