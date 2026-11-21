import type { Player } from "../types.ts";
import { buildHeaders, normalizeTeamKey, withTimeout } from "../utils.ts";
import { attr, parseHtml, textContent } from "../html.ts";

// Leaguepedia runs on Fandom (MediaWiki). We use API parse/search.
const ORIGIN = "https://lol.fandom.com";

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const res = await withTimeout(
    fetch(url, { headers: { ...buildHeaders(ORIGIN), accept: "application/json" } }),
    timeoutMs,
    "leaguepedia_fetch_timeout",
  );
  if (!res.ok) throw new Error(`Leaguepedia fetch failed: ${res.status}`);
  return await res.json();
}

function pickBestTitle(search: any, teamName: string): string | null {
  const results = search?.query?.search || [];
  if (!results.length) return null;
  const normalized = normalizeTeamKey(teamName);
  for (const r of results) {
    const title = r.title as string;
    if (normalizeTeamKey(title) === normalized) return title;
  }
  return results[0]?.title || null;
}

function extractRosterPlayersFromHtml(html: string): Player[] {
  const doc = parseHtml(html);
  if (!doc) return [];

  const players: Player[] = [];
  const seen = new Set<string>();

  // Try to find a section that looks like roster.
  // On many Fandom team pages, roster is in a table with class "wikitable" or "roster-card".
  const rosterCandidates: Element[] = [];
  for (const el of Array.from(doc.querySelectorAll("h2, h3"))) {
    const t = textContent(el).toLowerCase();
    if (t.includes("roster") || t.includes("active") || t.includes("players") || t.includes("lineup")) {
      // Next sibling tables/divs may contain roster
      const next = el.nextElementSibling;
      if (next) rosterCandidates.push(next);
    }
  }

  const scopes = rosterCandidates.length ? rosterCandidates : [doc.body as unknown as Element].filter(Boolean);

  for (const scope of scopes) {
    const anchors = Array.from(scope.querySelectorAll("a"));
    for (const a of anchors) {
      const href = attr(a, "href") || "";
      // Fandom internal links
      if (!href.startsWith("/wiki/")) continue;
      const name = textContent(a);
      if (!name) continue;
      if (name.length < 2) continue;
      const key = normalizeTeamKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ name, role: null, image: null });
      if (players.length >= 10) return players;
    }
  }

  return players;
}

export async function scrapeLeaguepediaLolRoster(teamName: string): Promise<Player[]> {
  const searchUrl =
    `${ORIGIN}/api.php?action=query&list=search&srsearch=${encodeURIComponent(teamName)}&format=json&utf8=1&srlimit=5`;
  const search = await fetchJson(searchUrl);
  const title = pickBestTitle(search, teamName);
  if (!title) return [];

  const parseUrl =
    `${ORIGIN}/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&utf8=1`;
  const parsed = await fetchJson(parseUrl);
  const html = parsed?.parse?.text || "";
  if (!html) return [];

  return extractRosterPlayersFromHtml(html);
}

