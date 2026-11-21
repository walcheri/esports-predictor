import type { Player } from "../types.ts";
import { buildHeaders, normalizeTeamKey, withTimeout } from "../utils.ts";
import { attr, parseHtml, textContent } from "../html.ts";

const ORIGIN = "https://www.vlr.gg";

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const res = await withTimeout(
    fetch(url, { headers: buildHeaders(ORIGIN) }),
    timeoutMs,
    "vlr_fetch_timeout",
  );
  if (!res.ok) throw new Error(`VLR fetch failed: ${res.status}`);
  return await res.text();
}

function extractTeamLinkFromSearch(doc: Document): string | null {
  // VLR search results include links like /team/<id>/<slug>
  const links = Array.from(doc.querySelectorAll('a[href^="/team/"]'));
  for (const a of links) {
    const href = attr(a, "href") || "";
    if (href.startsWith("/team/")) return ORIGIN + href;
  }
  return null;
}

function extractPlayersFromTeamPage(doc: Document): Player[] {
  const players: Player[] = [];
  const seen = new Set<string>();

  // Best effort selectors (VLR layout changes often):
  // - .wf-card.mod-team-roster
  // - .team-roster-item .team-roster-item-name
  const rosterCard =
    doc.querySelector(".wf-card.mod-team-roster") ||
    doc.querySelector(".team-roster") ||
    doc.querySelector(".team-roster-container");

  const scope = rosterCard ?? doc;

  const nameEls = Array.from(
    scope.querySelectorAll(".team-roster-item-name, .team-roster-item .text-of, a[href^=\"/player/\"]"),
  );

  for (const el of nameEls) {
    const name = textContent(el);
    if (!name) continue;
    const key = normalizeTeamKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({ name, role: null, image: null });
    if (players.length >= 10) break;
  }

  // Fallback: any /player/ link text
  if (players.length === 0) {
    for (const a of Array.from(scope.querySelectorAll('a[href^="/player/"]'))) {
      const name = textContent(a);
      if (!name) continue;
      const key = normalizeTeamKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ name, role: null, image: null });
      if (players.length >= 10) break;
    }
  }

  return players;
}

export async function scrapeVlrRoster(teamName: string): Promise<Player[]> {
  const term = encodeURIComponent(teamName);
  const searchUrl = `${ORIGIN}/search/?q=${term}`;
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

