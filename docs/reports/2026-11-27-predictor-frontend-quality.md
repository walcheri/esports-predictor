# Этап E — frontend, качество и повторный аудит модели

Дата: 2026-11-27. Репозиторий walcheri/esports-predictor. База: `4854848b32d857e0f76b0e5c571cefea19b6fdc4` (draft PR #9). Ветка `codex/predictor-frontend`, зависимый этап E. Итоговый SHA и CI будут внесены после публикации и завершения проверок; этот коммит — кандидат на проверку, не утверждённый релиз.

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

## Проверки (кандидат, до финального CI)

- npm ci: exit 0 после обновления lockfile; найдено 0 advisories.
- npm test: 31 тест прошёл, exit 0; дополнительные сквозные/CLI тесты добавлены и входят в финальный прогон.
- npm run typecheck: ранее exit 0 после исправления Object.hasOwn для ES2020; повторный финальный прогон выполняется.
- npm run lint: exit 0, без ошибок/предупреждений; правила не отключались.
- npm run build: exit 0; после lazy loading повторная сборка проверяется.
- npm audit --audit-level=low: exit 0, 0 vulnerabilities.
- npm run security:secrets: exit 0; приватные ключи, Groq keys, service-role JWT не обнаружены. Непрозрачные provider keys требуют ручного review.
- npx deno check (4 entrypoints): exit 0, без запуска функций.
- Playwright: 9 сценариев прошли по выводу, финальный exit ещё фиксируется. Все не-локальные запросы блокируются/подменяются; реальные email, API и Supabase не использовались. Мобильный и desktop screenshot просмотрены.
- Ранние локальные отказы: пропущенный импорт useAuth после разделения контекста; холодная загрузка dev-сервера превышала общий 30s лимит теста; несовместимость Object.hasOwn с ES2020. Исправлены импорт, SPA-навигация/60s test budget и совместимый вызов. Продуктовые assertions не отключены.
- SQL/RLS: в PR #6 disposable PostgreSQL CI прошёл; дополнительная миграция E требует нового CI. Это не проверка фактических policies в staging/production.

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
