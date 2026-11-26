import { buildRosterSection, replaceRosterSection } from "./rosterReport.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("replaces an invented roster chapter and keeps the rest of the report", () => {
  const report = `## 📊 Составы команд и ключевые игроки
**Yatoro** играет за Spirit Academy.

## ⚔️ История личных встреч
Счёт 2-0.

## 🏆 Финальный прогноз
**Spirit Academy — 54% | Inner Circle x Insanity — 46%**`;

  const section = buildRosterSection(
    "Spirit Academy",
    [{ name: "86", wins: 82, games_played: 223 }, { name: "Kiseki`" }],
    "Inner Circle x Insanity",
    [{ name: "Norma" }],
  );
  const next = replaceRosterSection(report, section);
  assert(!next.includes("Yatoro"), "invented roster must be removed");
  assert(next.includes("86 (82 побед из 223)"), "current player stays");
  assert(next.includes("Norma"), "second team stays");
  assert(next.includes("## ⚔️ История личных встреч"), "later chapters stay");
  assert(next.includes("54%"), "prediction stays");
});
