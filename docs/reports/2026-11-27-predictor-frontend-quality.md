# Этап E — frontend, качество и повторный аудит модели

Дата: 2026-11-27. Репозиторий walcheri/esports-predictor. База: `4854848b32d857e0f76b0e5c571cefea19b6fdc4` (draft PR #9). Ветка `codex/predictor-frontend`, зависимый этап E. PR: [#10](https://github.com/walcheri/esports-predictor/pull/10), draft, base PR #9. Итоговый проверенный SHA кода: `f37c44e9759494776e8c8b109463bd97922292f5` (основная реализация `2d8dd98a86bf10c6b2e4f80afe78afe523853aa9`, затем точечная защита калибровки). Этот отчёт сохранён последующим документационным коммитом; точный SHA отчётного коммита доступен в истории файла. Main остаётся `ede72f3fe921b80cd4c32b4e8d7746d496bde5c1`.

## Исправления

- Каталог/карточки/детали переведены на валидируемые DTO: UTC с годом, nullable участники/BO/результат, partial catalogue и происхождение. Нет реконструкции дат по текущему году, ложной классификации неизвестного участника как квалификатора и восьми фоновых запросов с главной страницы.
- Страница матча использует контракт отказа backend, не принимает выдуманные проценты. Составы/H2H/карты без исторического источника явно недоступны; графики не строятся из нулей. Серверный endpoint пока намеренно не выдаёт OK-прогнозов. Неподтверждённый research baseline не попадает в пользовательскую историю.
- Поздние ответы при смене матча/пользователя/выходе не возвращают старые данные. История owner-scoped, упорядочена, агрегаты ограничены 1000 записями и явно названы архивом прежних LLM-прогнозов. Ошибки архива видимы, отсутствие счётчика отображается «—».
- Premium оставлен waitlist без цены/скидки/неограниченных прогнозов. Новый RPC валидирует email, назначает owner по auth.uid(), возвращает одинаковый результат для повтора; прямой доступ к списку закрыт. Предложенная отдельная миграция запрещает подделку новых прогнозов и profile counters клиентом, не удаляет старые записи.
- Убраны lint errors и предупреждения смешанных React exports: стили/контекст вынесены в отдельные модули, без отключения правил. Добавлены strict core/e2e typechecks, Deno check четырёх Edge entrypoints, браузерные тесты и CI security checks. Тяжёлые страницы загружаются лениво; дизайн сохранён.
- Elo пересмотрен: обязательный независимый prematch snapshot, доступность результата до прогноза, разделение BO, проверенные пять игроков и история того же состава. Неизвестный/новый состав, редкая команда, stale history, противоречия — abstention. Исправлены конфликты карт, prototype-like ID/slug и future-result timestamp. Версия `series-elo-v2-pit-roster`.

## Зависимости и совместимость

Исходный аудит: 27 advisories (18 high, 9 moderate). Финальная проверка npm audit после обновлений: 0. Обновлены совместимые patch/minor зависимости; осознанно обновлены Vite 5→6, React Router 6→7 и Zod 3→4 (ошибки валидации переведены на issues). React 18/Lovable tagger сохранены. Для транзитивных dev-зависимостей применены узкие overrides: esbuild у устаревшего @esbuild-kit/core-utils и исправленная ветка postcss-selector-parser у typography. Drizzle CLI загружается, исходники/миграции напарника не удалялись. `npm audit fix --force` не применялся. Возможные новые advisories проверяет CI; нулевой audit не доказывает отсутствие любых уязвимостей. Остались upstream deprecation notices для части dev/visual пакетов; они не скрыты.

PR #1 повторно прочитан на `0c10e8126a2c04e984ae1792ebf3f2da713e237c`: добавлены поиск Spirit Academy и принудительная вставка текущего OpenDota roster в текст. Это полезный эксперимент, но текущий roster не является PIT roster; fallback одной стороны с общим rostersSource и wins??0 остаются риском. Его frontend-прямые запросы не проходят новый серверный бюджет. Пересечения: Match.tsx, fetch-match-details/index.ts, generate-prediction/index.ts. Автоматический merge запрещён; адаптер следует переносить через общий серверный gate, per-side provenance и проверенное ID mapping после выбора источника. PR #1 не изменён. PR #5 `305259c4...` сохранён для отдельной будущей интеграции LineRadar.

## Фактические проверки и exit codes

Полностью успешный [CI 45897770983](https://github.com/walcheri/esports-predictor/actions/runs/45897770983) на SHA `f37c44e9759494776e8c8b109463bd97922292f5`. Предыдущий [CI 45897445823](https://github.com/walcheri/esports-predictor/actions/runs/45897445823) на основном коммите также успешен. Проверены не только статусы: прочитаны логи обоих application jobs и database job.

| Проверка | Результат |
|---|---|
| npm ci | Exit 0 на Windows/Ubuntu, воспроизводимый lockfile |
| npm test | Exit 0; **34/34** на Windows и Ubuntu, также локально |
| npm run typecheck | Exit 0; frontend, strict core и e2e config/tests |
| npm run build | Exit 0; lazy routes работают. Главный chunk ~760 KB, build warning о размере остаётся и не скрыт |
| npm run lint | Exit 0; **0 ошибок, 0 предупреждений**, без отключения правил |
| npm audit --audit-level=low | Exit 0; **0 vulnerabilities** на дату проверки |
| npm run security:secrets | Exit 0; tracked/review файлы без обнаруженных private keys/Groq keys/service-role JWT. Это не универсальный детектор непрозрачных секретов |
| Deno check четырёх Edge entrypoints | Exit 0 локально и в отдельном CI job; функции не запускались |
| npm run test:e2e | Exit 0; **9/9** на Windows (9.7s CI), Ubuntu (7.8s CI), локально (2.2m с холодным dev server) |
| PostgreSQL 16 disposable job | Exit 0; повторное применение миграций, owner RLS, guest waitlist RPC/validation/duplicate privacy, запрет forged forecasts/profile counters, owner-only legacy history, 40 конкурентных попыток ограничены 5 резервированиями/50 синтетическими единицами |
| Drizzle CLI --version | Exit 0; 0.31.11 / orm 0.45.4. Живые Drizzle/Supabase migration не запускались |
| git diff --check | Exit 0 |

Браузерные сценарии: guest catalogue, authenticated partial catalogue + mobile details + INSUFFICIENT_DATA, quota failure, late event response after navigation, logout with delayed profile, honest Premium, mocked registration confirmation, unverified archive, guest waitlist RPC. Приложение сохраняет запросы только к локальному dev server; остальные сети заблокированы/подменены. Реальные email, API и Supabase не использовались. Мобильный и desktop screenshot просмотрены.

Сквозной mock тест проходит reservation → provider response → normalization → frontend DTO parser. Отдельный CLI-тест запускает локальный PIT dataset с явным `synthetic=true`, prematch snapshots, результатами и датированными rosters; проверяет SHA256 и `productionApproved=false`. Это доказательство совместимости вычислительных компонентов, не настоящая история и не измерение реальной точности.

Повторный аудит после основного коммита выявил отсутствие проверки obtainedAt у калибровочных labels (availableAt уже проверялся). Исправление `f37c44e` исключает результат, полученный после начала holdout, даже если provider publication time раньше. Новый тест проходит; полный suite и все пять CI jobs повторены успешно.

Ранние локальные отказы сохранены как история диагностики: пропущенный импорт useAuth после разделения контекста; холодная загрузка dev-сервера превышала общий 30s лимит теста; несовместимость Object.hasOwn с ES2020. Исправлены импорт, SPA-навигация/60s test budget и совместимый вызов. Assertions не отключались. SQL tests на CI не являются проверкой фактических policies staging/production.

### Классификация dependency advisories

- Vite/Rollup/esbuild: build/dev-server attack surface, не код backend в production; обновлены Vite 6.4.6 и исправленные зависимости, локальные тесты слушают только loopback.
- Zod: реальный runtime validation path; major update до 4.6.7+ с заменой `.errors` на `.issues`, проверены Auth и DTO.
- React Router/Remix: routing path присутствует; SSR hydration в этом SPA не используется, маршруты матчей валидируются. Обновление до 7.18+ устраняет advisories без предположения, что отсутствие SSR решает остальные проблемы.
- lodash/ws/nanoid/postcss и связанные пакеты: смесь runtime/transitive/build путей; конкретная эксплуатация не заявлялась, исправленные версии зафиксированы lockfile.
- ajv/flatted/glob/minimatch/yaml и esbuild-kit/typography: преимущественно tooling/config/build; обновлены и/или применены узкие overrides. Существовавшие deprecated tooling packages пока сохранены ради совместимости, без известных audit findings.

## Реальные данные и готовность

`docs/research/REAL_DATA_VALIDATION_PLAN.md` задаёт endpoints, поля, выборки, PIT-требования, квоты и согласования отдельно для четырёх дисциплин. Изучены первичные документы, а не реальные ответы под ключом. Поставщики пока не утверждены; лицензии, доступ, PIT archive, полнота roster/map/player данных — NOT_VERIFIED. Реальный backtest NOT_RUN; качество и калибровка модели НЕ ДОКАЗАНЫ. Синтетический CLI-тест доказывает воспроизводимость вычислений, не выигрыш у baseline.

Статус: PARTIAL / NOT_READY_FOR_REAL_PILOT. Для завершения нужны: review draft stack; разрешённый staging с применением обеих миграций и проверкой фактических RLS; выбранный лицензированный PIT-источник; независимый исторический backtest; только после этого серверная выдача и неизменяемое сохранение утверждённых прогнозов. OAuth/email delivery, реальный paid tariff и live API не тестировались. На платные сервисы потрачено 0. Production, main, Timeweb, Telegram, API-Sport и LineRadar не изменены.

## Откат

Draft PR не слит и не развёрнут: откат на этом этапе — закрыть/revert зависимый стек. Перед будущим staging-deploy сохранить согласованные артефакты и backup, отключить external flags. Не восстанавливать публичное чтение профилей, фабрикацию прогнозов или клиентскую запись «проверенных» прогнозов ради старого UI. Не удалять budget ledger/историю. Live deployment/rollback требует отдельного согласования после staging.

## Изменённые файлы

- `.env.example`
- `.github/workflows/predictor.yml`
- `.gitignore`
- `README.md`
- `docs/analytics/BACKTEST_RESULTS.md`
- `docs/analytics/PREDICTION_MODEL_DESIGN.md`
- `docs/audits/PREDICTOR_FULL_AUDIT.md`
- `docs/reports/2026-11-27-predictor-frontend-quality.md`
- `docs/research/REAL_DATA_VALIDATION_PLAN.md`
- `e2e/product.spec.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `scripts/backtest.ts`
- `scripts/check-secrets.mjs`
- `scripts/test-database.mjs`
- `src/App.tsx`
- `src/components/AuthModal.tsx`
- `src/components/MatchCard.tsx`
- `src/components/PremiumModal.tsx`
- `src/components/UserMenu.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button-variants.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle-variants.ts`
- `src/components/ui/toggle.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/auth-state.ts`
- `src/hooks/usePredictions.ts`
- `src/integrations/supabase/types.ts`
- `src/lib/catalogue.ts`
- `src/lib/prediction.ts`
- `src/pages/Index.tsx`
- `src/pages/Match.tsx`
- `src/pages/Matches.tsx`
- `src/pages/Profile.tsx`
- `src/pages/ResetPassword.tsx`
- `supabase/functions/_shared/data.ts`
- `supabase/functions/_shared/model.ts`
- `supabase/functions/_shared/providers.ts`
- `supabase/functions/_shared/statistics.ts`
- `supabase/migrations/202611270001_stage_e_history_and_waitlist.sql`
- `tailwind.config.ts`
- `tests/data.test.ts`
- `tests/frontend.test.ts`
- `tests/model.test.ts`
- `tests/pipeline.test.ts`
- `tests/statistics.test.ts`
- `tsconfig.core.json`
- `tsconfig.e2e.json`

## Проверка финального HEAD и следующий этап (27.11.2026)
Финальный HEAD PR #10 040e4fbd5a149dc49628e882002951f470dae9fa подтверждён пятью успешными jobs: https://github.com/walcheri/esports-predictor/actions/runs/45951088736 (Win/Ubuntu app, lint/audit/secrets, Deno, PostgreSQL). Он включает исходный code SHA f37c44e9759494776e8c8b109463bd97922292f5; прежние pending-заметки являются историей, не текущим статусом.
Offline-import/probe preparation/handoff вынесены в отдельную зависимую ветку codex/predictor-real-data-readiness, база codex/predictor-frontend. Main и PR #1/#5 не изменены. Настоящий staging и точность по-прежнему не подтверждены.
