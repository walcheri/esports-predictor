# Backtest evidence

Real historical backtest: **NOT_RUN**. No licensed, quality-verified historical dataset
has been supplied or fetched. Model calibration/performance and pilot readiness are
**NOT_VERIFIED**. No accuracy, profit or improvement claim is made.

Synthetic test reports must be labeled SYNTHETIC and cannot satisfy the release gate.
The planned harness must record dataset hash/license reference, chronological cutoffs,
model version, evaluated/abstained counts, per-discipline/BO metrics and calibration bins.
Publish aggregate metrics only, never private provider payloads or player/user data.

Next: approve a dataset source and bounded collection, verify IDs/results/availableAt,
freeze the manifest, run untouched holdout evaluation and independent review. Lack of
paid data does not block implementation or synthetic leakage/formula tests.

## Implemented offline harness (2026-11-26)
`npx tsx scripts/backtest.ts LOCAL.json CALIBRATION_UTC TEST_UTC` accepts an explicitly licensed local observation file; report includes SHA256, chronological scores and 12 discipline/BO strata. JSON input: `{"licenseConfirmed":true,"observations":[{"raw":{},"obtainedAt":"2026-01-01T00:00:00Z"}]}`; raw must satisfy the PandaScore adapter, not an empty object. Do not commit licensed datasets or raw outputs. CLI does no networking. Automated synthetic fixtures validate calculations, not forecast quality. Real metrics remain NOT_RUN. Roster/patch effectiveness and out-of-sample improvement are NOT_VERIFIED. Production endpoint remains abstaining.

Prematch identity/format must be independently observed before the start: provide `prematchObservations` in the same `{raw, obtainedAt}` format. A final-result snapshot alone causes abstention, even if historical ratings exist.


Stage E input additionally requires an explicit `synthetic` boolean and verified dated five-player `rosters` (teamId, game, players, effectiveFrom, effectiveTo, availableAt, sourceId, verified). Synthetic inputs are labeled as such in output. Real independent backtesting remains NOT_RUN. Source acquisition time cannot be retroactively inferred from an old match date.
