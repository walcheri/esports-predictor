# Standalone predictor — review candidate, not a validated forecasting service

The A–E draft stack replaces fabricated statistics with typed, partial data and explicit abstention. Main, PR #1 and the future LineRadar PR #5 are not merged or modified. No real API collection or production Supabase deployment has been performed. Real model quality and staging policies remain unverified.

## Local checks (Windows PowerShell or Ubuntu)

Use Node 22.12+ and npm. `npm ci` is the tested dependency source; the old Bun lock is not the release source. Preserve Lovable configuration and review before switching its deployment branch.

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm audit --audit-level=low
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests use a fake Supabase hostname, local synthetic fixtures, and block external traffic. They never query production. Server Edge type-check: `npx deno check supabase/functions/fetch-matches/index.ts supabase/functions/fetch-match-details/index.ts supabase/functions/fetch-tournaments/index.ts supabase/functions/generate-prediction/index.ts`.

For development, create an ignored `.env.local` from `.env.example`. Keep both external-data flags false until source/staging approval. Do not put a service-role secret in a VITE variable. `npm run dev` preserves the Lovable tagger. A real sign-in requires an approved Supabase project; OAuth/email delivery is not demonstrated by mocks.

- [Source validation and required approvals](docs/research/REAL_DATA_VALIDATION_PLAN.md)
- [Full audit](docs/audits/PREDICTOR_FULL_AUDIT.md)
- [Model and limitations](docs/analytics/PREDICTION_MODEL_DESIGN.md)
- [Backtest status](docs/analytics/BACKTEST_RESULTS.md)
- [Release roadmap](docs/ROADMAP_TO_RELEASE.md)

Historical LLM predictions remain an explicitly unverified archive. New client-authored inserts are disabled by a proposed SQL migration; no live migration has been applied. Roster/H2H/map panels show unavailable while no licensed PIT dataset is connected. Premium is a waitlist only, without a price or discount promise. Paid API/infrastructure spend authorized in this stage: **0**.

Rollback: before merge, close/revert the dependent draft stack. For a future approved staging deployment, retain the prior frontend/Edge artifacts and schema backup; disable external flags first, then restore reviewed application artifacts. Do not restore permissive public profile reads or fabricate predictions to obtain backward compatibility. Keep budget ledgers and historical user records. Production deployment/rollback requires a separate approved runbook and staging evidence.

---

# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/de55cee3-3531-4317-8b49-11ad948fa557

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/de55cee3-3531-4317-8b49-11ad948fa557) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/de55cee3-3531-4317-8b49-11ad948fa557) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Продолжение 27.11.2026: подготовка реального теста
Совокупная ветка A–E: codex/predictor-real-data-readiness. Статус READY_FOR_OFFLINE_REVIEW; реальные API, staging и accuracy не подтверждены. Добавлены строгий offline dataset import/quarantine/manifest/backtest и отдельный dry-run probe с durable quota ledger. Инструкции и ограничения: [передача напарнику](docs/handoff/PREDICTOR_PARTNER_HANDOFF.md), [staging](docs/handoff/STAGING_READINESS.md), [отчёт](docs/reports/2026-11-27-real-data-test-readiness.md).
Быстрый безопасный тест: `npm run probe -- --out .local/demo-probe-01` (mock, без ключа, 0 внешних запросов). Live-проверки запрещены до отдельного owner approval и проверки лицензии/тарифа. Groq/external flags остаются false. Стоимость офлайн-данных: 0; стоимость будущего источника не подтверждена.
