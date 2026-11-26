import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { secure, json } from "../supabase/functions/_shared/security.ts";
import { catalogue } from "../supabase/functions/_shared/providers.ts";
import { catalogueSchema } from "../src/lib/catalogue.ts";
const raw = (id: number) => ({
  id,
  videogame: { slug: "csgo" },
  opponents: [
    { opponent: { id: 1, name: "Synthetic A" } },
    { opponent: { id: 2, name: "Synthetic B" } },
  ],
  number_of_games: 3,
});
test("mock provider passes budget, normalization and the frontend DTO parser", async () => {
  let spent = 0,
    calls = 0;
  const handler = secure(
    "pandascore",
    async (body, fetcher) =>
      json(
        await catalogue(
          body,
          "fixture-token",
          fetcher,
          new Date("2026-01-01T00:00:00Z"),
        ),
      ),
    {
      enabled: true,
      authenticate: async () => "fixture-user",
      reserve: async () => {
        spent++;
        return true;
      },
      fetcher: async () => {
        calls++;
        return Response.json([
          {
            ...raw(1),
            status: "not_started",
            scheduled_at: "2026-02-01T00:00:00Z",
          },
        ]);
      },
    },
  );
  const r = await handler(
    new Request("https://edge.invalid", {
      method: "POST",
      headers: {
        authorization: "Bearer offline-test-token",
        "content-type": "application/json",
      },
      body: '{"game":"cs2"}',
    }),
  );
  const result = catalogueSchema.parse(await r.json());
  assert.equal(result.matches.length, 1);
  assert.equal(result.partial, true);
  assert.equal(spent, 1);
  assert.equal(calls, 1);
});
test("local backtest CLI labels a synthetic PIT dataset and emits no approved production forecast", () => {
  const dir = mkdtempSync(join(tmpdir(), "predictor-fixture-"));
  try {
    const observations = [],
      prematchObservations = [];
    for (let i = 0; i < 80; i++) {
      const start = new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
        end = new Date(Date.UTC(2026, 0, i + 1, 1)).toISOString();
      observations.push({
        raw: {
          ...raw(i + 1),
          status: "finished",
          scheduled_at: start,
          end_at: end,
          winner_id: i % 3 === 0 ? 2 : 1,
        },
        obtainedAt: end,
      });
      prematchObservations.push({
        raw: { ...raw(i + 1), status: "not_started", scheduled_at: start },
        obtainedAt: start,
      });
    }
    const rosters = [1, 2].map((id) => ({
      teamId: `pandascore:${id}`,
      game: "cs2",
      players: Array.from({ length: 5 }, (_, i) => `${id}:${i}`),
      effectiveFrom: "2025-01-01T00:00:00Z",
      effectiveTo: null,
      availableAt: "2025-01-01T00:00:00Z",
      sourceId: `fixture:${id}`,
      verified: true,
    }));
    const file = join(dir, "fixture.json");
    writeFileSync(
      file,
      JSON.stringify({
        licenseConfirmed: true,
        synthetic: true,
        observations,
        prematchObservations,
        rosters,
      }),
    );
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          resolve("node_modules/tsx/dist/cli.mjs"),
          resolve("scripts/backtest.ts"),
          file,
          "2026-01-11T00:00:00Z",
          "2026-02-15T00:00:00Z",
        ],
        { encoding: "utf8", timeout: 30000 },
      ),
    );
    assert.equal(report.synthetic, true);
    assert.equal(report.productionApproved, false);
    assert.equal(report.calibrationFitted, true);
    assert.ok(report.raw.n > 0);
    assert.match(report.datasetSha256, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(join(dir, "fixture.json"), { force: true });
    rmdirSync(dir);
  }
});
