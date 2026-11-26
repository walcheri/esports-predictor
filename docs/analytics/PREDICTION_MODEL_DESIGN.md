# Reproducible prediction design

Start with a per-discipline series-result Elo baseline, not an LLM. Initial rating
1500; expected home win p=1/(1+10^((Raway-Rhome)/400)); K=24 fixed before holdout.
Update only after the finished result becomes available, never when its start time
passes. Timestamp batches prevent simultaneous matches seeing each other's result.
Series-level ratings predict series; do NOT apply a BO transform to series Elo.
BO1/3/5 are evaluated separately. Game-level BO binomial assumptions require a separate
model and map-level evidence; correlated maps violate independence.

Minimum reliable historical sample per team, known discipline/BO/teams, no conflicts,
freshness and historical roster coverage are explicit gates. Without them return
INSUFFICIENT_DATA with no 50/50 replacement. No production prediction until a reviewed
model/data manifest passes independent chronological evaluation for that discipline.

Alternative next models: logistic regression on past-only rating difference, recent
form, tournament strength and verified roster continuity; map-specific strength only
with real map records. Glicko uncertainty helps sparse histories but needs validation.
Gradient boosting is deferred until sufficient independent history exists. Never use
post-match player ratings, revised future rosters or end-of-series stats as prematch features.

Evaluate Brier mean((p-y)^2), clipped log loss, coverage/abstention, calibration bins,
counts and paired comparison to 0.5 and train-only base-rate baselines. Time-split
train/validation/test with no series leakage; calibration fit on validation only,
final test untouched. Report each discipline/BO and roster-change/sample-size stratum.
No arbitrary accuracy target; demonstrated holdout improvement and adequate coverage
are prerequisites. Small synthetic tests validate formulas, not model quality.

LLM may later paraphrase only validated facts and computed probabilities. For now
deterministic templates provide complete provenance without model cost or hallucination.
Groq recovery helper remains available and must retain account-catalog restrictions.
