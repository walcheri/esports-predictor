# Staging prerequisites и rollback

Этот документ — план для владельца/напарника. Настоящий Supabase staging не создан и миграции не применялись. CI PostgreSQL моделирует роли/auth.uid и проверяет SQL; он не подтверждает GoTrue, HTTP JWT gateway или конфигурацию конкретного проекта.

1. Получить отдельное разрешение владельца на staging, бюджет и доступ. Создать изолированный проект без production данных. Не импортировать реальные пользователей. Зафиксировать project ref и URL, разрешённые redirect origins, owner и дату; секреты только в secret manager. Не использовать production service_role.
2. Оставить PREDICTOR_EXTERNAL_ENABLED=false и VITE_PREDICTOR_EXTERNAL_ENABLED=false. Не добавлять PandaScore/Groq ключи в Edge. Не включать SMTP/рассылку. Auth test users создать через разрешённый staging admin createUser с email_confirm=true и адресами .invalid (без invitation/signup email); пароли сгенерировать локально, не писать в отчёт.
3. Сохранить staging schema/roles/grants и проверенный backup до миграций. На новом пустом staging применить SQL в порядке двух исходных миграций 20251203/20251206, затем 202611260001_provider_budget_and_rls.sql (A), 202611270001_stage_e_history_and_waitlist.sql (E). Проверить ref непосредственно перед исполнением. Команды linked db push без явной проверки target здесь намеренно не предлагаются. Не применять bootstrap scripts/test-database.mjs к Supabase.
4. Через SQL editor с админ-доступом проверить только metadata (без строк пользовательских таблиц):

```sql
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public';
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role');
SELECT proname, prosecdef, proconfig FROM pg_proc
WHERE proname IN ('join_waitlist','reserve_provider_attempt');
```

5. В локальном защищённом staging test harness войти двумя пользователями через signInWithPassword без email. Проверить actual JWT и API: отсутствие/чужой/expired JWT отвергается, user A не читает history B, A не вставляет/изменяет predictions, не меняет predictions_count, не вызывает reserve_provider_attempt; username меняет только свой. Guest join_waitlist валидный тестовый .invalid адрес проходит, повтор не раскрывает членство, неверный email отклоняется, SELECT/прямой INSERT waitlist недоступны. Fixture histories вставляет только staging admin; результаты — boolean/count/status без PII и JWT.
6. Проверить false external flag на всех Edge endpoints: ни одного provider вызова. Бюджет — отдельная SQL-only staging fixture с небольшими пределами, concurrent reserve RPC только service_role, 401/403/retries должны расходовать каждую попытку в mock transport. Сверить фактические policy rows и aggregate attempt counts; не удалять ledger для прохождения теста. После проверки вернуть disabled policy. Не использовать live API или Groq.
7. Зафиксировать команды/exit/status, project reference hash, commit/migration versions и результирующие boolean gates в отдельном обезличенном отчёте. Секреты/токены/таблицы/сырые ответы не публиковать.

## Rollback acceptance
До staging теста сохранить известный frontend artifact/Edge revision, schema/grants backup и snapshot БД. Репетиция восстановления — в другом disposable staging, с отдельным разрешением; сверить integrity/counts/RLS и сохранность budget/history. Не откатывать A/E через снятие защитных REVOKE и не удалять quota/history. При неуспехе: external flags остаются false, остановить тест, вернуть совместимый app artifact; схема сохраняет защитные ограничения. Несовместимый старый frontend не разрешается чинить открытием защищённых записей. Любой destructive restore только отдельным решением владельца, не в действующий проект.

## Условия будущего включения model OK
Сейчас generate-prediction принимает только matchId, не доверяет client stats и сознательно возвращает INSUFFICIENT_DATA; UI не означает работающий production прогноз. Нужны: approved server dataset и license; серверная вычисляемая версия модели/immutable input hash; temporal validation + calibration/coverage; корректный DTO с реальными метриками и abstention; immutable saved forecast (user/model/input/time/hash), protected counters; reviewer approval, actual staging RLS/Auth и rollback. Не принимать forecast или уверенность от браузера. LineRadar остаётся отдельным отложенным проектом.
