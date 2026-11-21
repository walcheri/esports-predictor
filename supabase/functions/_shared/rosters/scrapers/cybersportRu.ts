import type { Player } from "../types.ts";
import { buildHeaders, normalizeTeamKey, withTimeout } from "../utils.ts";
import { attr, parseHtml, textContent } from "../html.ts";

const ORIGIN = "https://www.cybersport.ru";

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const res = await withTimeout(
    fetch(url, { headers: buildHeaders(ORIGIN) }),
    timeoutMs,
    "cybersport_fetch_timeout",
  );
  if (!res.ok) throw new Error(`cybersport.ru fetch failed: ${res.status}`);
  return await res.text();
}

function extractLikelyTeamLink(doc: Document): string | null {
  // Best effort: find first link that looks like a team page.
  // cybersport.ru structure may differ; we try a few heuristics.
  const links = Array.from(doc.querySelectorAll("a"));
  for (const a of links) {
    const href = attr(a, "href") || "";
    if (!href) continue;
    if (href.includes("/teams/") || href.includes("/team/")) {
      return href.startsWith("http") ? href : ORIGIN + href;
    }
  }
  return null;
}

function extractPlayers(doc: Document): Player[] {
  const players: Player[] = [];
  const seen = new Set<string>();

  // Try common patterns: elements containing roster/players blocks
  const scopes: Element[] = [];
  const rosterLike = Array.from(doc.querySelectorAll("section, div")).filter((el) => {
    const t = textContent(el).toLowerCase();
    return t.includes("состав") || t.includes("roster") || t.includes("players");
  });
  scopes.push(...rosterLike.slice(0, 3));

  const useScopes = scopes.length ? scopes : [doc.body as unknown as Element].filter(Boolean);

  for (const scope of useScopes) {
    for (const a of Array.from(scope.querySelectorAll("a"))) {
      const name = textContent(a);
      if (!name) continue;
      if (name.length < 2) continue;
      // Avoid picking navigation text
      if (name.toLowerCase() === "состав") continue;
      const key = normalizeTeamKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ name, role: null, image: null });
      if (players.length >= 10) return players;
    }
  }

  return players;
}

export async function scrapeCybersportRoster(teamName: string): Promise<Player[]> {
  // Best effort search; cybersport.ru may block or change layout.
  const q = encodeURIComponent(teamName);
  const searchUrl = `${ORIGIN}/search?q=${q}`;
  const searchHtml = await fetchText(searchUrl);
  const searchDoc = parseHtml(searchHtml);
  if (!searchDoc) return [];

  const teamUrl = extractLikelyTeamLink(searchDoc);
  if (!teamUrl) return [];

  const teamHtml = await fetchText(teamUrl);
  const teamDoc = parseHtml(teamHtml);
  if (!teamDoc) return [];

  return extractPlayers(teamDoc);
}

