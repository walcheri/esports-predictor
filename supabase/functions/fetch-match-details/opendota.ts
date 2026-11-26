/**
 * Dota 2 team rosters from OpenDota.
 *
 * Team names are resolved with GET /teams (name, tag, or the same name
 * without a leading "Team"). Teams outside that top list, such as
 * "Spirit Academy" → "Team Spirit Academy", are resolved through
 * GET /proPlayers and then loaded with GET /teams/{team_id}/players.
 * GET /search is a player search and is not used. An API key is optional:
 * pass `apiKey` or set OPENDOTA_API_KEY.
 *
 * ```ts
 * const rosters = new OpenDotaRosters();
 * const liquid = await rosters.getRoster("Team Liquid");
 * const byId = await rosters.getRoster(2163);
 * // liquid.players: { name, account_id, games_played, wins }[]
 * ```
 */

const API_BASE = "https://api.opendota.com/api";

export interface DotaRosterPlayer {
  name: string;
  account_id: number;
  games_played: number;
  wins: number;
}

export interface DotaTeamRoster {
  team_id: number;
  name: string;
  tag: string | null;
  players: DotaRosterPlayer[];
}

export interface OpenDotaOptions {
  /** Overrides OPENDOTA_API_KEY. Empty string means no key. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

interface OpenDotaTeam {
  team_id: number;
  name?: string | null;
  tag?: string | null;
}

interface OpenDotaTeamPlayer {
  account_id?: number | null;
  name?: string | null;
  games_played?: number | null;
  wins?: number | null;
  is_current_team_member?: boolean | null;
}

interface OpenDotaProPlayer {
  team_id?: number | null;
  team_name?: string | null;
  team_tag?: string | null;
}

export class OpenDotaError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenDotaError";
    this.status = status;
  }
}

function readEnvApiKey(): string | undefined {
  const deno = (globalThis as { Deno?: { env: { get(name: string): string | undefined } } }).Deno;
  const key = deno?.env.get("OPENDOTA_API_KEY")?.trim();
  return key || undefined;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "Team Spirit Academy" and "Spirit Academy" describe the same side. */
function canonicalTeamName(value: string): string {
  return normalizeName(value)
    .replace(/[.'’`]/g, "")
    .replace(/^team\s+/, "")
    .replace(/\s+esports$/, "")
    .trim();
}

function parseTeamId(team: string | number): number | null {
  if (typeof team === "number" && Number.isInteger(team) && team > 0) return team;
  if (typeof team === "string" && /^[0-9]+$/.test(team.trim())) {
    const id = Number(team.trim());
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

export class OpenDotaRosters {
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private teamListRequest: Promise<OpenDotaTeam[]> | null = null;
  private proPlayerRequest: Promise<OpenDotaProPlayer[]> | null = null;

  constructor(options: OpenDotaOptions = {}) {
    this.apiKey = options.apiKey === undefined ? readEnvApiKey() : options.apiKey.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Current roster for a team id or an exact team name/tag. */
  async getRoster(team: string | number): Promise<DotaTeamRoster> {
    const teamInfo = await this.resolveTeam(team);
    const players = await this.getCurrentPlayers(teamInfo.team_id);
    return {
      team_id: teamInfo.team_id,
      name: teamInfo.name?.trim() || String(teamInfo.team_id),
      tag: teamInfo.tag?.trim() || null,
      players,
    };
  }

  private async resolveTeam(team: string | number): Promise<OpenDotaTeam> {
    const teamId = parseTeamId(team);
    if (teamId !== null) return this.getTeam(teamId);

    const query = typeof team === "string" ? team.trim() : "";
    if (!query) throw new OpenDotaError(400, "Team name or team_id is required");

    const teams = await this.getTeams();
    const needle = normalizeName(query);
    const byName = teams.filter((item) => item.name && normalizeName(item.name) === needle);
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) {
      throw new OpenDotaError(409, `Multiple OpenDota teams match "${query}"`);
    }

    const byTag = teams.filter((item) => item.tag && normalizeName(item.tag) === needle);
    if (byTag.length === 1) return byTag[0];
    if (byTag.length > 1) {
      throw new OpenDotaError(409, `Multiple OpenDota teams match tag "${query}"`);
    }

    const canonical = canonicalTeamName(query);
    const byCanonical = teams.filter((item) => item.name && canonicalTeamName(item.name) === canonical);
    if (byCanonical.length === 1) return byCanonical[0];
    if (byCanonical.length > 1) {
      throw new OpenDotaError(409, `Multiple OpenDota teams match "${query}"`);
    }

    return this.findTeamFromProPlayers(query, needle, canonical);
  }

  private async findTeamFromProPlayers(query: string, needle: string, canonical: string): Promise<OpenDotaTeam> {
    const players = await this.getProPlayers();
    const matches = new Map<number, OpenDotaTeam>();

    for (const player of players) {
      const teamId = player.team_id;
      if (!Number.isInteger(teamId) || !teamId || teamId <= 0 || matches.has(teamId)) continue;
      const name = player.team_name?.trim() || "";
      const tag = player.team_tag?.trim() || "";
      const nameMatches = Boolean(name) && (normalizeName(name) === needle || canonicalTeamName(name) === canonical);
      const tagMatches = Boolean(tag) && normalizeName(tag) === needle;
      if (nameMatches || tagMatches) matches.set(teamId, { team_id: teamId, name, tag });
    }

    if (matches.size === 0) throw new OpenDotaError(404, `OpenDota team not found: ${query}`);
    if (matches.size > 1) throw new OpenDotaError(409, `Multiple OpenDota teams match "${query}"`);
    const matched = [...matches.values()][0];
    try {
      return await this.getTeam(matched.team_id);
    } catch (error) {
      if (error instanceof OpenDotaError && error.status === 404) return matched;
      throw error;
    }
  }

  private getTeams(): Promise<OpenDotaTeam[]> {
    if (!this.teamListRequest) {
      this.teamListRequest = this.getJson<OpenDotaTeam[]>("/teams").then((teams) => {
        if (!Array.isArray(teams)) throw new OpenDotaError(502, "OpenDota /teams returned an unexpected payload");
        return teams.filter((team) => Number.isInteger(team.team_id) && team.team_id > 0);
      });
    }
    return this.teamListRequest;
  }

  private getProPlayers(): Promise<OpenDotaProPlayer[]> {
    if (!this.proPlayerRequest) {
      this.proPlayerRequest = this.getJson<OpenDotaProPlayer[]>("/proPlayers").then((players) => {
        if (!Array.isArray(players)) throw new OpenDotaError(502, "OpenDota /proPlayers returned an unexpected payload");
        return players;
      });
    }
    return this.proPlayerRequest;
  }

  private getTeam(teamId: number): Promise<OpenDotaTeam> {
    return this.getJson<OpenDotaTeam>(`/teams/${teamId}`);
  }

  private async getCurrentPlayers(teamId: number): Promise<DotaRosterPlayer[]> {
    const players = await this.getJson<OpenDotaTeamPlayer[]>(`/teams/${teamId}/players`);
    if (!Array.isArray(players)) {
      throw new OpenDotaError(502, `OpenDota /teams/${teamId}/players returned an unexpected payload`);
    }

    return players
      .filter((player) => player.is_current_team_member === true && Number.isInteger(player.account_id))
      .map((player) => ({
        name: player.name?.trim() || "",
        account_id: player.account_id as number,
        games_played: player.games_played ?? 0,
        wins: player.wins ?? 0,
      }));
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    if (this.apiKey) url.searchParams.set("api_key", this.apiKey);

    let response: Response;
    try {
      response = await this.fetchImpl(url, { headers: { Accept: "application/json" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new OpenDotaError(0, `OpenDota request failed: ${message}`);
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new OpenDotaError(
        429,
        retryAfter
          ? `OpenDota rate limit exceeded. Retry after ${retryAfter}s`
          : "OpenDota rate limit exceeded",
      );
    }
    if (response.status === 404) throw new OpenDotaError(404, `OpenDota resource not found: ${path}`);
    if (!response.ok) throw new OpenDotaError(response.status, `OpenDota request failed (${response.status})`);

    return response.json() as Promise<T>;
  }
}

/** One-off lookup. Reuse OpenDotaRosters when resolving several teams. */
export function getDotaRoster(team: string | number, options?: OpenDotaOptions): Promise<DotaTeamRoster> {
  return new OpenDotaRosters(options).getRoster(team);
}
