import type { GameKey } from "./types.ts";

export function normalizeTeamKey(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function detectGameKey(gameName: string): GameKey {
  const g = (gameName || "").toLowerCase();
  if (g.includes("valorant")) return "valorant";
  if (g.includes("dota")) return "dota2";
  if (g.includes("league of legends") || g === "lol" || g.includes("leaguepedia")) return "lol";
  if (g.includes("counter-strike") || g.includes("cs2") || g.includes("cs:go") || g.includes("csgo")) return "cs2";
  return "unknown";
}

export function withTimeout<T>(p: Promise<T>, ms: number, label = "timeout"): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(label), ms);
  // Caller may pass fetch already bound to an AbortController; this helper is used for non-fetch promises too.
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, rej) =>
      ctrl.signal.addEventListener("abort", () => rej(new Error(label)), { once: true }),
    ),
  ]);
}

export function buildHeaders(origin: string): HeadersInit {
  return {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "referer": origin,
  };
}

