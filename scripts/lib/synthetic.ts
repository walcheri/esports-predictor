import type { Dataset } from "./dataset.ts";
export function syntheticDataset(count = 80): Dataset {
  const observations = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(Date.UTC(2026, 0, i + 1)),
      end = new Date(+start + 3600000),
      before = new Date(+start - 60000);
    const common = {
      eventId: `pandascore:match:${i + 1}`,
      seriesId: `pandascore:match:${i + 1}`,
      level: "series",
      game: "cs2",
      team1Id: "pandascore:team:1",
      team2Id: "pandascore:team:2",
      tournamentId: "pandascore:tournament:1",
      bestOf: 3,
      startsAt: start.toISOString(),
      availableAt: null,
    };
    observations.push({
      ...common,
      recordId: `pre-${i}`,
      phase: "prematch",
      obtainedAt: before.toISOString(),
      endedAt: null,
      winnerId: null,
    });
    observations.push({
      ...common,
      recordId: `result-${i}`,
      phase: "result",
      obtainedAt: end.toISOString(),
      endedAt: end.toISOString(),
      winnerId: `pandascore:team:${i % 3 === 0 ? 2 : 1}`,
    });
  }
  return {
    schemaVersion: "predictor-pit-v1",
    synthetic: true,
    provider: "pandascore",
    game: "cs2",
    collectedAt: "2026-04-01T00:00:00.000Z",
    license: {
      approved: true,
      reference: "synthetic-owned-fixture",
      purpose: "closed-noncommercial",
      storageAllowed: true,
      backtestAllowed: true,
      expiresAt: null,
    },
    acquisition: {
      scope: "bounded-sample",
      completedPlan: true,
      httpStatuses: [200],
    },
    observations,
    rosters: [1, 2].map((id) => ({
      recordId: `roster-${id}`,
      teamId: `pandascore:team:${id}`,
      game: "cs2",
      players: Array.from(
        { length: 5 },
        (_, i) => `pandascore:player:${id * 10 + i + 1}`,
      ),
      effectiveFrom: "2025-12-01T00:00:00Z",
      effectiveTo: null,
      obtainedAt: "2025-12-01T00:00:00Z",
      availableAt: null,
      basis: "historical_observation",
      evidenceReference: "synthetic-owned-roster",
    })),
  };
}
