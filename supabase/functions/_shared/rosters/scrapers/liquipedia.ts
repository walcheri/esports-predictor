import type { Player } from "../types.ts";
import { buildHeaders, normalizeTeamKey, withTimeout } from "../utils.ts";
import { attr, parseHtml, textContent } from "../html.ts";

const ORIGIN = "https://liquipedia.net";
const WIKI = "dota2";

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const res = await withTimeout(
    fetch(url, { headers: { ...buildHeaders(`${ORIGIN}/${WIKI}`), accept: "application/json" } }),
    timeoutMs,
    "liquipedia_fetch_timeout",
  );
  if (!res.ok) throw new Error(`Liquipedia fetch failed: ${res.status}`);
  return await res.json();
}

function pickBestTitle(search: any, teamName: string): string | null {
  const results = search?.query?.search || [];
  if (!results.length) return null;
  // Prefer exact-ish match.
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

  // Liquipedia often has an "Active Squad"/"Players" roster list in infobox or a roster table.
  const players: Player[] = [];
  const seen = new Set<string>();

  // Try roster tables first (wikitable with player links)
  const tables = Array.from(doc.querySelectorAll("table.wikitable"));
  for (const table of tables) {
    const caption = textContent(table.querySelector("caption"));
    const headerText = (caption || "").toLowerCase();
    if (headerText && !headerText.includes("roster") && !headerText.includes("players") && !headerText.includes("active")) {
      continue;
    }
    for (const a of Array.from(table.querySelectorAll("a"))) {
      const href = attr(a, "href") || "";
      if (!href.startsWith("/dota2/")) continue;
      const name = textContent(a);
      if (!name) continue;
      // Skip common nav links
      if (name.length < 2) continue;
      const key = normalizeTeamKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ name, role: null, image: null });
      if (players.length >= 10) return players;
    }
  }

  // Fallback: infobox "Players"/"Active Squad" list
  const infobox = doc.querySelector(".fo-nttax-infobox, .infobox, .infobox2");
  if (infobox) {
    const rows = Array.from(infobox.querySelectorAll("tr"));
    for (const tr of rows) {
      const th = tr.querySelector("th");
      const label = textContent(th).toLowerCase();
      if (!label.includes("players") && !label.includes("active squad") && !label.includes("active roster")) continue;
      const links = Array.from(tr.querySelectorAll("a"));
      for (const a of links) {
        const name = textContent(a);
        if (!name) continue;
        const key = normalizeTeamKey(name);
        if (seen.has(key)) continue;
        seen.add(key);
        players.push({ name, role: null, image: null });
        if (players.length >= 10) return players;
      }
    }
  }

  return players;
}

export async function scrapeLiquipediaDota2Roster(teamName: string): Promise<Player[]> {
  // Use MediaWiki API to get rendered HTML (more stable than scraping arbitrary pages).
  const searchUrl =
    `${ORIGIN}/${WIKI}/api.php?action=query&list=search&srsearch=${encodeURIComponent(teamName)}&format=json&utf8=1&srlimit=5`;
  const search = await fetchJson(searchUrl);
  const title = pickBestTitle(search, teamName);
  if (!title) return [];

  const parseUrl =
    `${ORIGIN}/${WIKI}/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&utf8=1`;
  const parsed = await fetchJson(parseUrl);
  const html = parsed?.parse?.text || "";
  if (!html) return [];

  return extractRosterPlayersFromHtml(html);
}

