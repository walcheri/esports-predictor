import type { Player, ResolvedRoster } from "./types.ts";
import { detectGameKey } from "./utils.ts";
import { getRosterCache, setRosterCache } from "./cache.ts";

import { scrapeHltvRoster } from "./scrapers/hltv.ts";
import { scrapeLiquipediaDota2Roster } from "./scrapers/liquipedia.ts";
import { scrapeLeaguepediaLolRoster } from "./scrapers/leaguepedia.ts";
import { scrapeVlrRoster } from "./scrapers/vlr.ts";
import { scrapeCybersportRoster } from "./scrapers/cybersportRu.ts";

const TTL_HOURS = 24;

async function tryScrape(
  label: ResolvedRoster["source"],
  fn: () => Promise<Player[]>,
): Promise<{ source: ResolvedRoster["source"]; players: Player[] } | null> {
  try {
    const players = await fn();
    if (players && players.length > 0) return { source: label, players };
    return null;
  } catch (e) {
    console.log(`[roster] ${label} failed:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function resolveRoster(params: {
  gameName: string;
  teamName: string;
}): Promise<ResolvedRoster> {
  const gameKey = detectGameKey(params.gameName);
  const game = gameKey === "unknown" ? "unknown" : gameKey;

  // Cache first
  try {
    const cached = await getRosterCache({ game, teamName: params.teamName });
    if (cached && cached.players.length > 0) return cached;
  } catch (e) {
    console.log("[roster] cache read failed:", e instanceof Error ? e.message : String(e));
  }

  // Source priority by game
  let result:
    | { source: ResolvedRoster["source"]; players: Player[] }
    | null = null;

  if (gameKey === "cs2") {
    result =
      (await tryScrape("hltv", () => scrapeHltvRoster(params.teamName))) ??
      (await tryScrape("cybersport_ru", () => scrapeCybersportRoster(params.teamName)));
  } else if (gameKey === "dota2") {
    result =
      (await tryScrape("liquipedia", () => scrapeLiquipediaDota2Roster(params.teamName))) ??
      (await tryScrape("cybersport_ru", () => scrapeCybersportRoster(params.teamName)));
  } else if (gameKey === "lol") {
    result =
      (await tryScrape("leaguepedia", () => scrapeLeaguepediaLolRoster(params.teamName))) ??
      (await tryScrape("cybersport_ru", () => scrapeCybersportRoster(params.teamName)));
  } else if (gameKey === "valorant") {
    result =
      (await tryScrape("vlr", () => scrapeVlrRoster(params.teamName))) ??
      (await tryScrape("cybersport_ru", () => scrapeCybersportRoster(params.teamName)));
  } else {
    result = await tryScrape("cybersport_ru", () => scrapeCybersportRoster(params.teamName));
  }

  const players = result?.players ?? [];
  const source = (result?.source ?? "none") as ResolvedRoster["source"];

  // Cache result (even empty results are not cached; we only cache meaningful rosters)
  if (players.length > 0) {
    try {
      await setRosterCache({
        game,
        teamName: params.teamName,
        source,
        players,
        ttlHours: TTL_HOURS,
      });
    } catch (e) {
      console.log("[roster] cache write failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return {
    players,
    source,
    fetchedAt: new Date().toISOString(),
    teamKey: params.teamName,
    teamName: params.teamName,
  };
}

