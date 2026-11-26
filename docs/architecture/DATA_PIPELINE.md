# Predictor data pipeline

Provider selection → bounded authenticated transport → strict schema → provider-qualified
identity → quarantine conflicts → immutable observation/provenance → as-of features →
versioned numerical model → uncertainty/validation gate → deterministic explanation → UI.

Every observation needs source, source ID, obtainedAt, availableAt, completeness,
verification status and sample size. Match identity includes discipline, provider,
event, tournament, oriented team IDs, UTC start and BO. Game records are separate
from series; current roster is separate from effective historical roster.

Never merge by display name or a shared numeric ID. No winner without finished state
and valid scores. Duplicate conflicting records invalidate evidence, not last-write-wins.
No data means null/unavailable, not zero. Partial pages cannot claim complete history.

Server alone holds provider credentials and budgets. All routes require validated user
identity; shared durable reservations precede every outbound attempt including retries.
Service-role RPC has fixed search_path, revoked public execution and RLS-private tables.
Policies default disabled/zero limits; configuration is a separately approved operation.
Timeouts and schema failures have fixed public codes, never raw provider bodies/tokens.

Frontend consumes a validated DTO, localizes ISO UTC once, renders provenance/sample
counts and explicit errors, and discards stale route/auth responses. Saved historical
LLM reports are unverified legacy records, not training labels or calibrated predictions.

LineRadar remains outside this pipeline; PR #5 is preserved for future review.
