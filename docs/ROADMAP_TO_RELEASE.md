# Roadmap to an honest closed predictor pilot

Status: **NOT_READY**. No automatic merge or production changes.

1. A / security: verified identity, bounded requests, default-off external calls,
   atomic provider budgets, reviewed RLS migration, transport recovery tests. Issue #2.
2. B / data: provider-qualified canonical schemas, observation provenance, bounded
   adapters, cache/dedup, explicit partial/unknown/conflict and provider selection gates.
3. C / statistics: past-only finished outcomes, separate series/maps, nullable sample
   estimates, exact H2H, roster validity. Remove fabricated LLM facts. Issue #3.
4. D / model: reproducible Elo baseline, chronological evaluation/calibration harness,
   synthetic tests and licensed real dataset gate. No unsupported probability publishing.
5. E / UI/quality: typed catalogue/details/history, honest empty/error/legacy states,
   auth races, truthful waitlist, lint/dependency remediation and CI/mobile tests.

Focused branches/PRs may be stacked when later layers depend on earlier contracts;
each diff, report and rollback must identify its base. PR #1 remains experimental,
PR #5 remains separate. Neither is merged or overwritten by this work.

OWNER gates: staging project permission and RLS verification; provider purpose/terms
and budget; historical dataset rights; out-of-time quality evidence; approved deployment
and closed user list. All remain open until actual evidence. Issue #4 gates future
LineRadar public-data use, not a substitute for predictor data quality.

Rollback: revert reviewed code/migration in staging first. Do not undo budget usage
or restore permissive public-profile policies. Keep external calls disabled on failure.
