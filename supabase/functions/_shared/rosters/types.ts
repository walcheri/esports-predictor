export type GameKey = "cs2" | "dota2" | "lol" | "valorant" | "unknown";

export type RosterSource =
  | "cache"
  | "hltv"
  | "liquipedia"
  | "leaguepedia"
  | "vlr"
  | "cybersport_ru"
  | "pandascore_fallback"
  | "none";

export interface Player {
  name: string;
  role?: string | null;
  image?: string | null;
  handle?: string | null;
}

export interface ResolvedRoster {
  players: Player[];
  source: RosterSource;
  fetchedAt: string; // ISO
  teamKey: string;
  teamName?: string;
}

