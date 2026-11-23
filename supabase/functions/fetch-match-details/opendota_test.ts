import { OpenDotaError, OpenDotaRosters } from "./opendota.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const teams = [
  { team_id: 2163, name: "Team Liquid", tag: "Liquid" },
  { team_id: 39, name: "Shopify Rebellion", tag: "SR" },
];

function players(teamId: number) {
  return [
    { account_id: 1, name: "Current", games_played: 10, wins: 7, is_current_team_member: true },
    { account_id: 2, name: "Former", games_played: 4, wins: 1, is_current_team_member: false },
    { account_id: 3, name: null, games_played: null, wins: null, is_current_team_member: true },
  ].map((player) => ({ ...player, team_id: teamId }));
}

Deno.test("resolves a team name and returns only current players", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    assert(!url.searchParams.has("api_key"), "must not send a key when none is configured");
    if (url.pathname === "/api/teams") return jsonResponse(teams);
    if (url.pathname === "/api/teams/2163/players") return jsonResponse(players(2163));
    return jsonResponse({ error: "missing" }, 404);
  };

  const roster = await new OpenDotaRosters({ apiKey: "", fetchImpl }).getRoster("  team liquid ");
  assert(roster.team_id === 2163 && roster.name === "Team Liquid" && roster.tag === "Liquid", "team identity");
  assert(roster.players.length === 2, "former members must be excluded");
  assert(
    roster.players[0].name === "Current" &&
      roster.players[0].account_id === 1 &&
      roster.players[0].games_played === 10 &&
      roster.players[0].wins === 7,
    "current player fields",
  );
  assert(roster.players[1].account_id === 3 && roster.players[1].games_played === 0 && roster.players[1].wins === 0, "missing stats default to 0");
  assert(calls.join(",") === "/api/teams,/api/teams/2163/players", "name lookup uses the team list, then the roster");
});

Deno.test("loads a roster by team_id without listing every team", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}?${url.searchParams}`);
    assert(url.searchParams.get("api_key") === "test-key", "api key must be sent as a query param");
    if (url.pathname === "/api/teams/39") return jsonResponse(teams[1]);
    if (url.pathname === "/api/teams/39/players") return jsonResponse(players(39));
    return jsonResponse({}, 404);
  };

  const roster = await new OpenDotaRosters({ apiKey: "test-key", fetchImpl }).getRoster(39);
  assert(roster.team_id === 39 && roster.players.length === 2, "roster by id");
  assert(!calls.some((call) => call.startsWith("/api/teams?")), "team list is not needed for an id");
});

Deno.test("matches a unique team tag", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/teams") return jsonResponse(teams);
    if (url.pathname === "/api/teams/2163/players") return jsonResponse([]);
    return jsonResponse({}, 404);
  };
  const roster = await new OpenDotaRosters({ apiKey: "", fetchImpl }).getRoster("Liquid");
  assert(roster.team_id === 2163 && roster.players.length === 0, "empty current roster is valid");
});

Deno.test("reports unknown teams, 404, and rate limits without retrying", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    calls++;
    const url = new URL(String(input));
    if (url.pathname === "/api/teams") return jsonResponse(teams);
    return jsonResponse({ error: "slow down" }, 429, { "Retry-After": "30" });
  };

  const client = new OpenDotaRosters({ apiKey: "", fetchImpl });
  try {
    await client.getRoster("Unknown Team");
    throw new Error("unknown team should fail");
  } catch (error) {
    assert(error instanceof OpenDotaError && error.status === 404, "unknown name is a 404");
  }
  assert(calls === 1, "a missing name must not request a roster");

  calls = 0;
  const limited: typeof fetch = async () => {
    calls++;
    return jsonResponse({}, 429, { "Retry-After": "30" });
  };
  try {
    await new OpenDotaRosters({ apiKey: "", fetchImpl: limited }).getRoster(2163);
    throw new Error("rate limit should fail");
  } catch (error) {
    assert(
      error instanceof OpenDotaError && error.status === 429 && error.message.includes("30"),
      "rate limit exposes Retry-After",
    );
  }
  assert(calls === 1, "rate limits are not retried");

  const missing: typeof fetch = async () => jsonResponse({}, 404);
  try {
    await new OpenDotaRosters({ apiKey: "", fetchImpl: missing }).getRoster(999);
    throw new Error("http 404 should fail");
  } catch (error) {
    assert(error instanceof OpenDotaError && error.status === 404, "http 404");
  }
});
