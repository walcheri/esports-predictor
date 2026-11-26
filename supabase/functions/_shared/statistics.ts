import { type Match, type Discipline, utc } from "./data.ts";
export type Rate = { wins: number; observations: number; rate: number | null };
export type Roster = {
  teamId: string;
  game: Discipline;
  players: string[];
  effectiveFrom: string;
  effectiveTo: string | null;
  availableAt: string;
  sourceId: string;
  verified: boolean;
};
export function rosterAt(
  rows: Roster[],
  teamId: string,
  game: Discipline,
  at: string,
): Roster | null {
  const t = Date.parse(utc(at));
  const eligible = rows.filter(
    (r) =>
      r.verified &&
      r.sourceId &&
      r.teamId === teamId &&
      r.game === game &&
      Date.parse(utc(r.availableAt)) <= t &&
      Date.parse(utc(r.effectiveFrom)) <= t &&
      (!r.effectiveTo || Date.parse(utc(r.effectiveTo)) > t) &&
      r.players.length > 0 &&
      new Set(r.players).size === r.players.length,
  );
  return eligible.length === 1 ? eligible[0] : null;
}
export function historical(
  rows: Match[],
  game: Discipline,
  at: string,
  allowSynthetic = false,
): Match[] {
  const t = Date.parse(utc(at)),
    byId = new Map<string, Match>(),
    conflicts = new Set<string>();
  for (const m of rows) {
    if (byId.has(m.id) && JSON.stringify(byId.get(m.id)) !== JSON.stringify(m))
      conflicts.add(m.id);
    else byId.set(m.id, m);
  }
  return [...byId.values()]
    .filter(
      (m) =>
        m.game === game &&
        !conflicts.has(m.id) &&
        m.status === "finished" &&
        m.startsAt &&
        m.endedAt &&
        Date.parse(utc(m.endedAt)) < t &&
        Date.parse(utc(m.startsAt)) <= Date.parse(utc(m.endedAt)) &&
        Date.parse(utc(m.provenance.availableAt)) < t &&
        Date.parse(utc(m.provenance.obtainedAt)) < t &&
        m.team1 &&
        m.team2 &&
        m.team1.id !== m.team2.id &&
        [m.team1.id, m.team2.id].includes(m.winnerId ?? "") &&
        (m.provenance.verification === "provider_observed" ||
          (allowSynthetic && m.provenance.verification === "synthetic")),
    )
    .sort(
      (a, b) =>
        a.endedAt!.localeCompare(b.endedAt!) || a.id.localeCompare(b.id),
    );
}
function rate(wins: number, observations: number): Rate {
  return {
    wins,
    observations,
    rate: observations ? wins / observations : null,
  };
}
export function statistics(
  rows: Match[],
  teamId: string,
  opponentId: string,
  game: Discipline,
  at: string,
) {
  const past = historical(rows, game, at),
    team = past.filter((m) => m.team1?.id === teamId || m.team2?.id === teamId);
  const summarize = (items: Match[]) =>
    rate(items.filter((m) => m.winnerId === teamId).length, items.length);
  const h2h = team.filter(
    (m) =>
      teamId !== opponentId && [m.team1?.id, m.team2?.id].includes(opponentId),
  );
  const mapRates = new Map<string, Rate>();
  for (const m of team) {
    const games = new Map<string, (typeof m.games)[number]>(),
      conflicts = new Set<string>();
    for (const g of m.games) {
      const prior = games.get(g.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(g))
        conflicts.add(g.id);
      else games.set(g.id, g);
    }
    for (const g of games.values()) {
      if (
        conflicts.has(g.id) ||
        !g.map ||
        ![m.team1?.id, m.team2?.id].includes(g.winnerId) ||
        Date.parse(utc(g.endedAt)) > Date.parse(m.endedAt!) ||
        Date.parse(g.endedAt) < Date.parse(m.startsAt!)
      )
        continue;
      const prior = mapRates.get(g.map) ?? rate(0, 0);
      mapRates.set(
        g.map,
        rate(
          prior.wins + Number(g.winnerId === teamId),
          prior.observations + 1,
        ),
      );
    }
  }
  const maps = Object.fromEntries(mapRates);
  return {
    series: summarize(team),
    last5: summarize(team.slice(-5)),
    last10: summarize(team.slice(-10)),
    h2h: summarize(h2h),
    maps,
    playerRatings: null,
    patchImpact: null,
    rosterImpact: null,
    partial: true,
    asOf: utc(at),
    sourceIds: team.map((m) => m.id),
  };
}
