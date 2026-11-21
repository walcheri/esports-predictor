-- Roster cache for scraped team lineups (24h TTL)
-- Stores normalized player lists per team+game to reduce load on upstream sites.

CREATE TABLE IF NOT EXISTS public.roster_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL,
  team_key TEXT NOT NULL,
  team_name TEXT,
  source TEXT NOT NULL,
  players JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS roster_cache_game_team_key_uidx
  ON public.roster_cache (game, team_key);

CREATE INDEX IF NOT EXISTS roster_cache_expires_at_idx
  ON public.roster_cache (expires_at);

ALTER TABLE public.roster_cache ENABLE ROW LEVEL SECURITY;

-- The frontend should never access this table directly.
-- Edge Functions should use the service role key to read/write.
REVOKE ALL ON TABLE public.roster_cache FROM anon, authenticated;

