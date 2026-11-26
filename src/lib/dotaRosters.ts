import {
  OpenDotaError,
  OpenDotaRosters,
  type DotaRosterPlayer,
} from "../../supabase/functions/fetch-match-details/opendota.ts";

type MatchSide = {
  name?: string;
  players?: unknown[];
};

type MatchWithRosters = {
  game?: string;
  rostersSource?: string | null;
  team1?: MatchSide;
  team2?: MatchSide;
};

function mapPlayers(players: DotaRosterPlayer[]) {
  return players.map((player) => ({
    name: player.name || `ID ${player.account_id}`,
    account_id: player.account_id,
    games_played: player.games_played,
    wins: player.wins,
    role: "Player",
    image: "",
  }));
}

/** Replace Dota 2 lineups with the current OpenDota roster. Other games stay unchanged. */
export async function applyOpenDotaRosters<T extends MatchWithRosters>(match: T): Promise<T> {
  if (!match.game?.toLowerCase().includes("dota")) {
    return match;
  }

  const client = new OpenDotaRosters();
  const load = async (name?: string) => {
    if (!name) return [];
    try {
      return mapPlayers((await client.getRoster(name)).players);
    } catch (error) {
      const status = error instanceof OpenDotaError ? error.status : 0;
      console.warn(`OpenDota roster failed for ${name}:`, status, error instanceof Error ? error.message : error);
      return [];
    }
  };

  const [team1Players, team2Players] = await Promise.all([
    load(match.team1?.name),
    load(match.team2?.name),
  ]);

  if (team1Players.length === 0 && team2Players.length === 0) return match;

  return {
    ...match,
    rostersSource: "opendota",
    team1: match.team1
      ? { ...match.team1, players: team1Players.length > 0 ? team1Players : match.team1.players }
      : match.team1,
    team2: match.team2
      ? { ...match.team2, players: team2Players.length > 0 ? team2Players : match.team2.players }
      : match.team2,
  };
}
