import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import type { Player, ResolvedRoster, RosterSource } from "./types.ts";
import { normalizeTeamKey } from "./utils.ts";

type SupabaseClient = ReturnType<typeof createClient>;

function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase admin credentials missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getRosterCache(params: {
  game: string;
  teamName: string;
}): Promise<ResolvedRoster | null> {
  const supabase = getAdminClient();
  const teamKey = normalizeTeamKey(params.teamName);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("roster_cache")
    .select("game, team_key, team_name, source, players, fetched_at, expires_at")
    .eq("game", params.game)
    .eq("team_key", teamKey)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    players: (data.players as Player[]) || [],
    source: "cache",
    fetchedAt: data.fetched_at,
    teamKey: data.team_key,
    teamName: data.team_name ?? undefined,
  };
}

export async function setRosterCache(params: {
  game: string;
  teamName: string;
  source: RosterSource;
  players: Player[];
  ttlHours: number;
}): Promise<void> {
  const supabase = getAdminClient();
  const teamKey = normalizeTeamKey(params.teamName);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.ttlHours * 60 * 60 * 1000);

  const { error } = await supabase
    .from("roster_cache")
    .upsert(
      {
        game: params.game,
        team_key: teamKey,
        team_name: params.teamName,
        source: params.source,
        players: params.players,
        fetched_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "game,team_key" },
    );

  if (error) throw error;
}

