# LineRadar integration foundation — 2026-11-25

Status: **PARTIAL — draft for partner review, not a production release**.

## Revision and scope

- Repository: `walcheri/esports-predictor` (public).
- Draft PR: [#5](https://github.com/walcheri/esports-predictor/pull/5).
- Branch: `codex/lineradar-integration-foundation`; target: `main`.
- Base: `ede72f3fe921b80cd4c32b4e8d7746d496bde5c1`.
- Tested implementation HEAD: `807385021bb6b8aca09a36ca762c4882713ed220`.
- Subsequent report-only commits do not change that implementation. The PR records the final head.
- Incoming ZIP: `esports_predictor_lineradar_handoff_2026-11-22.zip`.
  Its audit references exactly the current base SHA; remote main was rechecked unchanged.

Read existing AGENTS.md and Lovable north-star before changes. The ZIP has the seven
listed handoff materials plus a duplicate CODEX_PROMPT.md. Six destination files were
absent on main and imported; supplementary rules were manually appended to existing
AGENTS.md. Neither temporary rules nor duplicate prompt were added to the branch.
Existing Groq transport/model recovery, owner-scoped profile reads, Drizzle policies,
Lovable north-star and application runtime files remain unchanged.

## Changes and compatibility

- Added the supplied static audit, phased architecture, handoff and report standard.
- Added an **offline-only** Zod contract and 37 synthetic unit tests.
- Canonicalized explicit timezone offsets to UTC; rejected invalid calendar dates,
  invalid offsets, missing timezone and inconsistent evidence ordering. Expiry may
  not exceed event start; this schema is not a wall-clock freshness/TTL service.
- Added tournament identity to verified links (missing in ZIP), rejected identical
  opposing team IDs, and revalidated runtime inputs before registry matching.
- Exact event/tournament/discipline/oriented-team/start/BO matching only; no fuzzy
  matching. Zero or multiple matches, including duplicate records, return null.
- Reject invalid odds, wrong changePercent, unsupported market/sport/BO and extra fields.
- A verified status/evidence reference is **not cryptographic verification**. Future
  server-side code must control the registry and validate evidence, signatures,
  rights, freshness, replay protection and authorization before exposing any DTO.
- No web component imports this contract. No bridge, ingest endpoint, provider client,
  Radar page, production flag or migration has been activated.
- Added npm test using Node's built-in test runner and a direct dev dependency on tsx.
  It loads only synthetic contract tests, not Supabase clients or Deno provider tests.
- Repaired pre-existing package.json/package-lock inconsistency using npm only.
  Bun lockfiles are byte-for-byte unchanged. npm is used for this PR/CI, not declared
  a unilateral permanent migration away from Bun; partner agreement remains required.
- Added CI with separate frontend (install/tests/types/build) and full lint jobs.
  Existing lint failures stay visible and fail their job; no rule suppression,
  continue-on-error, or false green status.

Modified files: AGENTS.md; package.json; package-lock.json; .github/workflows/quality.yml;
docs/audits/2026-11-22-static-audit.md; docs/integrations/lineradar/ARCHITECTURE.md;
docs/integrations/lineradar/CODEX_HANDOFF.md; docs/reports/README.md;
src/lib/lineradar/contract.ts; src/lib/lineradar/contract.test.ts; this report.

## Actual local checks (Windows, Node 22.16.0, npm 10.9.2)

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm ci` on untouched main | 1 | EUSAGE: package-lock missing declared Lovable plugins, drizzle-kit/orm, postgres and transitive packages |
| Initial `npm run lint` / `npm run build` | 1 / 1 | Dependencies unavailable after failed install; not code validation |
| Initial `npx --no-install tsc -p tsconfig.app.json --noEmit` | 1 | Missing local compiler, download refused |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | 0 | Reconciled npm lock |
| Final `npm ci` | 0 | 488 packages installed |
| `npm test` | 0 | 37 tests, 2 suites, zero failures/skips; synthetic only |
| `npx tsc -p tsconfig.app.json --noEmit` | 0 | Frontend scope; does not typecheck Deno edge functions |
| `npm run build` | 0 | Vite production bundle; no deploy/network provider calls |
| `npm run lint` | 1 | Initial complete run: 63 errors, 11 warnings, including one newly introduced formatting error subsequently fixed |
| `node node_modules/eslint/bin/eslint.js . -f json -o .git/eslint-results.json` | 1 | After correction: **62 existing errors, 11 warnings**, zero errors in foundation files |
| `npx eslint src/lib/lineradar` | 0 | New contract/tests lint clean |
| `npm audit --json` | 1 | Final lock: **27 advisories (9 moderate, 18 high, 0 critical)**; not a clean dependency audit |
| Changed-file credential/artifact pattern scan | 0 | No candidate keys, private-key blocks, JWTs, bot tokens or DB/.env additions found; limited scan, not full-history proof |
| `git diff --check` | 0 | No whitespace errors |

The first test-runner choice, Vitest 3, introduced critical transitive advisories.
It was removed before committing; final runner is node:test + tsx. Do not apply
`npm audit fix --force` blindly to the existing app. Dependency remediation is a
separate reviewed change. A PowerShell attempt to forward lint JSON flags through
npm failed with exit 2; the direct ESLint command above produced the valid result.

Existing lint violations are in unchanged files: PremiumModal's Infinity import,
empty UI interfaces, frontend/Edge `any` types, prefer-const, unnecessary regex
escapes and tailwind require(). React-refresh/hook warnings remain. No legacy errors
were hidden. Build warns about old Browserslist data and a >500 kB bundle.

CI: [run 45664817663](https://github.com/walcheri/esports-predictor/actions/runs/45664817663)
completed on PR head `91ed51b0868b3e2bfece0636bdffea09d81dbe24`.
Ubuntu frontend job **success**: locked install, 37/37 tests, TypeScript and build.
Full lint job **failure**, exit 1: logs confirm 62 errors and 11 warnings in existing
code. Overall CI conclusion **failure**, intentionally not presented as green.
This report update changes documentation only; the PR discussion records subsequent head/CI.
Deno edge tests, live RLS tests, historical backtests and real bridge tests: **NOT_RUN**.

## Static audit verification and follow-up PRs

Confirmed by source inspection (not live exploit tests):

1. generate-prediction has verify_jwt=false and no server-validated caller or shared
   spending control before Groq. **P0 separate PR:** [Issue #2](https://github.com/walcheri/esports-predictor/issues/2).
2. Prompt/enrichment request fabricated statistics/rosters/H2H and false source claims.
   **P0 separate PR:** [Issue #3](https://github.com/walcheri/esports-predictor/issues/3).
3. Public redistribution rights remain unconfirmed. **P0 separate approval/gate PR:**
   [Issue #4](https://github.com/walcheri/esports-predictor/issues/4).
4. Existing Drizzle migration removes public profile access and validates waitlist
   inserts; applying it to production Supabase is **NOT_VERIFIED**. Preserve it.
   Next P1 PR: reviewed/idempotent migration and staging RLS/abuse tests, no live edits here.
5. calculateMapWinrate counts match wins, not map wins, and uses 0 for absent evidence.
   Next P1 data PR: canonical UTC/provenance/null/sample size, truthful Premium/source
   copy, probability validation/calibration, verified match registry.
6. Next P1 maintenance PR: existing lint and dependency advisories, without hiding failures.
7. Only after P0/P1 and owner/data-rights gates: separate disabled server-to-server bridge
   PR with signatures, replay/idempotency, private registry/quarantine and mock tests;
   then separate disabled Radar UI PR.

The GitHub connector returned 403 `Resource not accessible by integration` for issue
and PR creation. Existing local Git credentials were checked separately (push permission
confirmed); the authorized GitHub API fallback successfully created Issues #2–#4
and draft PR #5. Python HTTPS later failed certificate validation; the PowerShell
HTTPS client using the system trust store succeeded without disabling TLS verification.
Credentials were held in memory, never printed or written to project files.

## External state and security boundaries

API-Sport, Groq, PandaScore, GRID, Artemox, Telegram, Supabase production and Timeweb:
**NOT_CONTACTED / NOT_VERIFIED in this task**. No VPS SSH, runtime switch, deploy,
policy change, real odds or private Python/database export. Network use was limited
to GitHub and npm dependency operations. No paid service was enabled or purchased.
Existing tracked public-client .env was not copied into any new artifact or modified;
its existence is not proof of a leaked service-role secret. Full historical secret
rotation/audit and production entitlement validation are outside this foundation PR.

## Rollback and release gate

Do not merge automatically. Partner reviews the draft, npm lock and schema additions.
Rollback is reverting the foundation commits; no database rollback or VPS operation
is needed because this PR changes no deployed state or migrations. P0 issues remain
open, full lint is red and dependency advisories remain. Status stays **PARTIAL**.
