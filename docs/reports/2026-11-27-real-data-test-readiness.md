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
Локально: 58 unit/CLI tests (34 прежних +24 новых), typecheck, lint, npm audit (0 vulnerabilities), security:secrets — exit0. Synthetic pipeline прошёл полностью, default mock probe0network, downstream неполный sample ожидаемо exit2. Local build/browser и final CI результаты будут дописаны после завершения, до этого не заявляются успешными.
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
