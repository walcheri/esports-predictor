# Data pipeline — 2026-11-26

Base: security commit 3c3eff0, draft PR #6. This stage is a dependent draft, not independently deployable with the old frontend.

Replaced legacy data functions with typed PandaScore catalogue/detail adapters. Removed fabricated LLM rosters/H2H and ambiguous name joins. Unknown teams, dates, BO and outcomes remain null; unsupported disciplines and contradictory records are rejected. Each row carries provider identity, UTC observation time and partial completeness. One-page catalogue is explicitly partial. Authorization, atomic budget reservation, bounded responses, per-user single-flight cache and destination checks apply before provider access.

Validation: npm test exit 0 (14 tests); npm run typecheck exit 0. No real provider requests. Official documentation research is recorded in API_PROVIDER_COMPARISON.md; coverage/licensing remain NOT_VERIFIED. Data adapters are disabled by default. Existing frontend requires phase E to consume the new DTO. Cache is process-local, not a distributed cache; DB budget remains global.

Security CI run 45767927940: Ubuntu/Windows application and disposable PostgreSQL policy/concurrency tests passed; lint failed on outstanding source errors. Staging policies have NOT been inspected or migrated.

Rollback: revert this draft before deployment; no live migration or provider access performed. Next: past-only statistics and historical roster provenance. Status: PARTIAL, not pilot-ready.
