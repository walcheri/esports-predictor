export interface RosterPlayer {
  name?: string;
  wins?: number;
  games_played?: number;
}

function playerLabel(player: RosterPlayer): string | null {
  const name = player.name?.trim();
  if (!name) return null;
  if (typeof player.games_played === "number") {
    return `${name} (${player.wins ?? 0} побед из ${player.games_played})`;
  }
  return name;
}

export function buildRosterSection(
  teamA: string,
  playersA: RosterPlayer[] | undefined,
  teamB: string,
  playersB: RosterPlayer[] | undefined,
): string {
  const line = (team: string, players: RosterPlayer[] | undefined) => {
    const labels = (players ?? []).map(playerLabel).filter((label): label is string => Boolean(label));
    if (labels.length === 0) {
      return `**${team}:** текущий состав в OpenDota не найден. Ники этой команды не выдумываются.`;
    }
    return `**${team}:** ${labels.join(", ")}`;
  };

  return [
    "## 📊 Составы команд и ключевые игроки",
    "📊 Составы взяты из OpenDota: только игроки с is_current_team_member.",
    line(teamA, playersA),
    line(teamB, playersB),
  ].join("\n\n");
}

/** Replace the model's roster chapter so a Dota report cannot keep another team's players. */
export function replaceRosterSection(report: string, section: string): string {
  const heading = report.match(/^#{1,3}\s*[^\n]*(состав|ростер|line-?up)/im);
  if (!heading || heading.index === undefined) {
    return `${section.trim()}\n\n${report.trim()}`;
  }

  const start = heading.index;
  const afterHeading = report.slice(start + heading[0].length);
  const nextHeading = afterHeading.search(/\n#{1,3}\s+\S/);
  const end = nextHeading === -1 ? report.length : start + heading[0].length + nextHeading;
  return `${report.slice(0, start)}${section.trim()}\n\n${report.slice(end).replace(/^\n+/, "")}`;
}
