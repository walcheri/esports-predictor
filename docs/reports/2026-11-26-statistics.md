# Statistics — 2026-11-26

Base: data pipeline 34a202c (dependent draft). Added past-only series, form, exact-ID H2H, separate map observations, and dated roster assignments. Current rosters cannot fill historical gaps. Conflicting match observations are quarantined; absent player/patch/roster effects remain null. Removed the fabricated prediction prompt and 50/50 fallback. Endpoint rejects client-supplied statistics and returns INSUFFICIENT_DATA until an approved server dataset/model exists. Groq account-catalog recovery helper is preserved.

npm test: exit 0, 18 tests, including four new statistics regressions. No historical provider dataset or real calls used. No live Supabase changes. API and UI activation still blocked. Rollback: revert dependent drafts together, do not re-enable legacy fabricated endpoints. Next: reproducible offline model/backtesting. Status PARTIAL.
