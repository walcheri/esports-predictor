# Аудит esports-predictor + LineRadar
Дата: 2026-11-22. Версия predictor: `ede72f3fe921b80cd4c32b4e8d7746d496bde5c1` (`main`). LineRadar: `codex/lineradar-full-release-hardening`.

**Метод:** чтение исходников обоих GitHub-репозиториев. НЕ проверены живые Supabase policies, секреты, хостинг, API, npm/test/build. Выводы — статические; не являются доказательством эксплуатации уязвимости.

## P0: блокеры публичного запуска
1. **Возможен бесконтрольный расход Groq.** `supabase/config.toml`: у `generate-prediction` стоит `verify_jwt=false`. В `supabase/functions/generate-prediction/index.ts` запрос передаёт произвольный `matchData` напрямую в платную модель без проверенной серверной личности, лимитов на пользователя/IP и денежного бюджета. Нужны server-side auth + throttling + quota; один `verify_jwt=true` сам по себе не заменяет проверку подлинности пользователя.
2. **Фабрикация данных в качестве фактов.** `generate-prediction/index.ts` явно требует «сгенерируй реалистичные проценты», не говорить «данных нет», называть составы сканированными в феврале 2026 и приводить 5–10 H2H при отсутствии данных. `fetch-match-details/index.ts` через LLM/Artemox может переопределять неизвестные команды и добавлять невалидированные H2H/ростеры. Нужны provenance, null/unavailable, age/sample-size; не выдавать LLM за первоисточник.
3. **Права на данные.** `lineradar-mvp/DATA_RIGHTS_CHECKLIST.md` разрешает только закрытый некоммерческий тест. Не публиковать API-Sport odds, платные сырые данные, собственные SQLite, ключи, Telegram IDs или защищённую реализацию в публичном predictor до правовой проверки.

## P1: высокие риски
4. **RLS/профили.** Исходная `supabase/migrations/20251203100439_...sql` даёт `public.profiles` SELECT USING(true), таблица имеет `email`. В `drizzle/migrations/0000_restrict_profiles_and_validate_premium_waitlist.sql` есть DROP POLICY, но применение Drizzle SQL к живой Supabase **не подтверждено**. Проверить продакшен policies и исправить через идемпотентную Supabase-миграцию; waitlist вставки доступны анонимно и нуждаются в anti-abuse.
5. **Неверное описание winrate.** `fetch-match-details/index.ts` функция `calculateMapWinrate` считает победы на уровне матчей за 3 месяца, а результат подписан как winrate на карте. При отсутствии данных возвращается `0`, хотя должно быть `null`/недостаточно наблюдений.
6. **Ненадёжные вероятности.** `generate-prediction/index.ts` извлекает проценты регулярным выражением из произвольного текста, иначе пытается найти любые две суммы ~100, иначе ставит 50/50. Нет обученной/калиброванной модели, исторических backtests и validation. Не отображать как оценённую статистическую вероятность без калибровки.
7. **Публичные Edge Functions.** `fetch-matches`, `fetch-match-details`, `fetch-tournaments`, `generate-prediction` настроены с `verify_jwt=false`, нет полноценного бюджетного ограничителя, валидации входов, timeout/retries/caching. CORS `*` сам по себе не аутентификация. Провести обзор реальных gateway policies.
8. **ID матчей разных поставщиков несовместимы.** PandaScore match IDs отличаются от `api-sport` event IDs LineRadar. Нужен верифицированный server-side registry по discipline/ID команд/турниру/start UTC/BO, quarantine для unmatched. Нельзя матчить по названиям или времени без подтверждения.
9. **Даты и свежесть.** Фиксированные упоминания «декабрь 2025» и «февраль 2026» уже устарели. `fetch-matches` выдаёт дату без года/таймзоны, `src/pages/Matches.tsx` восстанавливает год эвристикой. Хранить ISO UTC, локализовать только UI.
10. **Нет CI.** В `package.json` нет `test`, `.github/workflows` отсутствует в текущем `main`. Нужны `npm ci`, ESLint, TypeScript, build, Deno/Edge tests, Supabase RLS тесты. Узкий Groq transport test не покрывает end-to-end.
11. **Недостоверные обещания Premium.** `PremiumModal.tsx` перечисляет коэффициенты/live, безлимитные прогнозы и скидку, но готового entitlement/payment/rights контура нет. Оставить как честный waitlist, без заявления о доступных функциях.
12. **Источники GRID.** `fetch-matches/index.ts` функция `fetchFromGRID` явно отключена и всегда возвращает `null`, при этом UI местами говорит «официальные данные GRID». Источник должен указываться отдельно для каждого поля и опираться на проверенный ответ.

## P2: качество и сопровождение
13. `fetch-matches` ограничен `per_page=200` без полного paging. Главная страница многократно вызывает provider Edge Functions каждые 5 минут; нужен cache/dedup/cost accounting.
14. `.env` отслеживается в Git с `VITE_SUPABASE_*`: это клиентские публичные параметры, сами по себе не доказанная утечка service role. Всё же добавить `.env` в gitignore, `.env.example` и проверить историю на настоящие секреты.
15. Одновременно `package-lock.json`, `bun.lock`, `bun.lockb`; выбрать единый package manager после согласования с напарником.
16. Client-side запись predictions хранит оценочные строки и отчёты; нет верифицированного реестра исходов и калибровки. Ограничить изменяемые атрибуты профиля, например `predictions_count`.
17. `any` в моделях матчей, нет нормализованного источника, origin timestamps, query cancellation и устойчивой обработки stale/error.

## LineRadar: что переносить, что сохранять отдельно
Переносить концепции: strict freshness/completeness, prematch guard, `SeriesWinner` с BO, continuity baseline, dedup, quota/near_quota, disabled-by-default, no evidence -> no signal, operational vs ready_for_signals, synthetic smoke.
Не копировать в публичный repo: production provider code с неизвестными лицензионными правами, приватные БД, Telegram token/ID, API keys, подробные платные линии и логи.

## Приоритет по этапам
**A Security:** auth/rate limits + hard spending caps, factual integrity, RLS verify, CI, truthful Premium copy.
**B Data:** canonical UTC match model + provenance; backtest/calibration; verified cross-provider identity.
**C Bridge:** restricted server-to-server ingest with replay protection, idempotency, rights checks, no live provider requests in CI.
**D UI:** `/radar` behind disabled-by-default flag and authorization, explicit unmatched/stale/no data.
**E Owner gates:** rights confirmation, independent backup/alerts, partner review, opt-in pilot after test evidence.

**Release gate:** ни одного открытого P0, RLS проверена на staging, CI green, private provider credentials never exposed, written permission for public odds, confirmed matching semantics; изменение production только по отдельному разрешению.
