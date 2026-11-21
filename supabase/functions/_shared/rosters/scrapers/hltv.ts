import type { Player } from "../types.ts";
import { buildHeaders, normalizeTeamKey, withTimeout } from "../utils.ts";
import { attr, parseHtml, textContent } from "../html.ts";

const ORIGIN = "https://www.hltv.org";

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const res = await withTimeout(
    fetch(url, { headers: buildHeaders(ORIGIN) }),
    timeoutMs,
    "hltv_fetch_timeout",
  );
  if (!res.ok) throw new Error(`HLTV fetch failed: ${res.status}`);
  return await res.text();
}

function extractTeamLinkFromSearch(doc: Document): string | null {
  // HLTV search page contains links like /team/xxxx/name
  const links = Array.from(doc.querySelectorAll("a"));
  for (const a of links) {
    const href = attr(a, "href") || "";
    if (href.startsWith("/team/")) return ORIGIN + href;
  }
  return null;
}

function extractPlayersFromTeamPage(doc: Document): Player[] {
  // Best effort: roster cards contain player nickname.
  const players: Player[] = [];

  // Common patterns observed across HLTV skins:
  // - .teamRoster .players .player
  // - a[href^="/player/"] inside roster section
  const rosterSection =
    doc.querySelector(".teamRoster") ||
    doc.querySelector(".playersHolder") ||
    doc.querySelector(".colCon .players");

  const scope = rosterSection ?? doc;
  const anchors = Array.from(scope.querySelectorAll('a[href^="/player/"]'));
  const seen = new Set<string>();
  for (const a of anchors) {
    const name = textContent(a);
    if (!name) continue;
    const key = normalizeTeamKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({ name, role: null, image: null });
    if (players.length >= 10) break;
  }

  return players;
}

export async function scrapeHltvRoster(teamName: string): Promise<Player[]> {
  // Note: HLTV may block scrapers (Cloudflare). This is best-effort and should be cached heavily.
  const term = encodeURIComponent(teamName);
  const searchUrl = `${ORIGIN}/search?term=${term}`;
  const searchHtml = await fetchText(searchUrl);
  const searchDoc = parseHtml(searchHtml);
  if (!searchDoc) return [];

  const teamUrl = extractTeamLinkFromSearch(searchDoc);
  if (!teamUrl) return [];

  const teamHtml = await fetchText(teamUrl);
  const teamDoc = parseHtml(teamHtml);
  if (!teamDoc) return [];

  return extractPlayersFromTeamPage(teamDoc);
}

