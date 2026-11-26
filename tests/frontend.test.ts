import { predictionSchema, failureMessage } from "../src/lib/prediction.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogueSchema,
  displayTime,
  statusLabel,
} from "../src/lib/catalogue.ts";
import { normalizePanda } from "../supabase/functions/_shared/data.ts";
test("UI contract preserves year, unknown teams and partial catalogue", () => {
  const m = normalizePanda(
    {
      id: 1,
      videogame: { slug: "lol" },
      status: "not_started",
      scheduled_at: "2027-01-01T00:00:00Z",
    },
    "2026-12-30T00:00:00Z",
  );
  const parsed = catalogueSchema.parse({
    matches: [m],
    partial: true,
    rejected: 0,
    conflicts: 0,
    obtainedAt: m.provenance.obtainedAt,
  });
  assert.equal(parsed.matches[0].team1, null);
  assert.match(displayTime(m.startsAt), /2027/);
  assert.match(displayTime(null), /не подтверждено/);
  assert.equal(statusLabel.unknown, "Статус не подтверждён");
});
test("malformed catalogue never renders as successful empty data", () => {
  assert.throws(() => catalogueSchema.parse({ matches: [], partial: false }));
  assert.throws(() => catalogueSchema.parse({ error: "BUDGET_EXHAUSTED" }));
});

test("prediction abstention never becomes 50/50; unsafe provider messages not displayed", async () => {
  assert.equal(
    predictionSchema.parse({
      status: "INSUFFICIENT_DATA",
      reason: "HISTORY",
      probability: null,
    }).probability,
    null,
  );
  assert.throws(() =>
    predictionSchema.parse({ status: "OK", probability: 0.9 }),
  );
  assert.match(
    await failureMessage({
      context: Response.json({ error: "BUDGET_EXHAUSTED" }),
    }),
    /Лимит/,
  );
  assert.doesNotMatch(
    await failureMessage({
      context: Response.json({ error: "private-provider-body" }),
    }),
    /private-provider-body/,
  );
});
