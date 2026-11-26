# Predictor full-chain audit — 2026-11-26

Base main: `ede72f3fe921b80cd4c32b4e8d7746d496bde5c1`. Source inspection, not a live exploitation or production audit.
PR #1 OpenDota: `63476ced8bbd21d7d213ef987c6b6c2d531b0b0d`, open, experimental, NOT merged.
PR #5: offline LineRadar foundation, preserved separately; not a dependency of this rebuild.
Issues #2–4 open. Changes to production/paid APIs are NOT authorized.

## Findings and proof obligations

Locations below refer to base main (or explicitly PR #1). Changed code can move lines.

| Priority / ID | Location | Cause and impact | Fix and regression evidence required |
|---|---|---|---|
| P0 S1 | supabase/config.toml; generate-prediction/index.ts:47–66 | verify_jwt=false; client JSON reaches Groq without verified user or quota; uncontrolled bill | Auth-server validation, default-off switch, atomic persistent reservation before every outbound attempt; concurrent-limit and unauthorized-zero-call tests |
| P0 D1 | generate-prediction/index.ts:75–130 | Prompts request invented H2H/percentages and pretend source scans; user sees fabricated evidence | Remove model-authored facts/probabilities; insufficient-data response; test missing evidence produces no call and no probability |
| P0 S2 | fetch-match-details/index.ts:184,247–305; other Edge handlers | Public request fans out into many provider calls; raw error propagation; no bound/timeout | Shared auth/budget gate on all handlers; bounded inputs/response size, timeouts, fixed host allowlist, sanitized errors |
| P1 D2 | fetch-match-details/index.ts:100,353–393 | First GRID name-search result and global rostersSource label; one team's source attributed to both | Provider-qualified team IDs, reject ambiguity, per-field/team provenance; mixed-source and conflicting-ID tests |
| P1 D3 | fetch-match-details/index.ts:397–405 | Match wins called map winrate, no games/map filter; missing sample reported 0 | Separate series and game statistics; null for no sample; game-level sample tests |
| P1 D4 | fetch-match-details/index.ts:407–421 | Missing/unrecognized winner assigned team2; uncertain name prefix determines H2H | Require finished result, exact participants/winner, reject draw/void/unknown; no false away-win test |
| P1 D5 | generate-prediction/index.ts:180–220 | Regex selects arbitrary percentages, fallback 50/50; no trained or calibrated model | Reproducible baseline, timestamped features, versioned artifact and holdout; no model probability until validation gate |
| P1 D6 | fetch-matches/index.ts:130–160; Matches.tsx:89–116 | UTC converted to yearless string then reconstructed using current year and local timezone | Canonical ISO UTC throughout; UI-only formatting; year boundary/timezone tests |
| P1 D7 | fetch-matches/index.ts:64–110 | Date filters skipped for selected upcoming game; 200 cap silently partial | Validated query, bounded pagination/explicit partial flag, completeness accounting |
| P1 D8 | fetch-match-details/index.ts:288–305 | Five history entries and limited H2H interpreted as comprehensive form | Carry coverage/sample sizes/selection, exclude future/incomplete records, never call partial history complete |
| P1 S3 | supabase/migrations/20251203100439…sql; drizzle/migrations/0000…sql | Base Supabase allows public profile SELECT; Drizzle correction exists but application is unknown | Preserve partner correction, idempotent Supabase migration and cross-user/guest SQL tests; staging still NOT_VERIFIED |
| P1 S4 | same migrations; usePredictions.ts | Client owns probability/report writes; profile counter can be changed as editable row field | Restrict writable profile columns; model results server-owned, label legacy records unverified; RLS tests |
| P1 U1 | AuthContext.tsx:72–101 | Older async profile fetch can populate state after account changes/logout | Ignore stale auth generation; clear profile/query data on session transition; race test |
| P1 U2 | Match.tsx:40–103 | In-flight detail/prediction can land after route change; previous state survives | Cancel/ignore stale responses, reset prediction on ID change; route race test |
| P1 U3 | PremiumModal.tsx:21–27,76; Index.tsx:102 | Promises unlimited forecasts/odds/discount and accurate forecasts without evidence | Honest waitlist and research state, no odds/accuracy claims; rendered text tests |
| P1 O1 | package-lock.json vs package.json | npm ci fails; lint 62 errors; dependency audit 27 advisories at foundation | Reproducible npm install, typed replacements, reviewed upgrades, CI without suppressions |
| P2 U4 | Index.tsx:48–65 | Failed counts become 0, eight calls every refresh | Aggregate/cache, null/unavailable errors, disabled default; no zero-on-error tests |
| P2 U5 | usePredictions.ts:78–113 | Entire history fetched for stats, no order before recent slice, provider row limit unnoticed | Bounded ordered query and honest partial aggregate labeling |
| P2 S5 | .env; integration client | Tracked public-client config mixed with secrets conventions | Preserve public config semantics; ignore private env variants, example placeholders, secret checks; public anon key is not a service role key |
| P1 PR1-A | PR #1 opendota.ts:getCurrentPlayers | Missing games/wins become 0; current membership does not establish historical roster | Nullable statistics and time-valid roster evidence tests; no overwrite of historical lineup |
| P1 PR1-B | PR #1 dotaRosters.ts and Match.tsx | Browser and Edge both lookup names; possible duplicate calls, partial source relabeling | Server-only provider, exact verified cross-provider registry and per-team provenance |
| P1 PR1-C | PR #1 opendota.ts:getTeam/getJson | Typed assertion without response schema, optional key in query, no timeout | Strict schema, no URL logging, bounded requests, mocked malformed/429 tests |

## Coverage and limits

Reviewed frontend routes/components/AuthContext/hooks, public Supabase client/types,
four Edge entrypoints and Groq helper/tests, Supabase and Drizzle schema/policies,
dependency locks, Vite/TypeScript/ESLint configuration, PR #1 patch and PR #5 reports.
No Supabase project, provider key, personal row, provider payload or VPS was read.
Live RLS, deployment state, identity coverage, current rosters, exact paid entitlements
and model quality are NOT_VERIFIED. The repository cannot establish them by itself.

## Source audit conclusion

PandaScore is currently the actual catalogue provider. GRID listing is disabled;
its roster query/name matching is not evidence of a verified source. Artemox and Groq
are text generation, not primary sports facts. PR #1 is useful experimental work but
its current-roster flag cannot be projected backward into historical matches.
No provider is accepted unconditionally. See provider comparison and release roadmap.


## Stage E follow-up (2026-11-27)
The dependent frontend draft fixes the legacy DTO mismatch, fabricated percentages/rosters, date reconstruction, stale request/session races, misleading Premium offers, lint/dependency findings, and client-authored forecast trust. New issues found on re-audit: retrospective target identity leakage, stale-roster history, contradictory map IDs, prototype-like slugs and waitlist duplicate enumeration. Fixes/tests and remaining blockers are documented in `../reports/2026-11-27-predictor-frontend-quality.md`. Actual staging RLS and licensed PIT data remain unverified; Issues #2/#3 are not closed merely because proposed code exists. Production forecast persistence remains gated until model approval.
