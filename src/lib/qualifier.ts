/** Логика определения квалификационных/TBD-команд — как в walcheri/esports-predictor */

export function isQualifierTeam(name: string | null | undefined): boolean {
  if (!name) return true
  const lower = name.toLowerCase().trim()
  return (
    lower === 'team 1' ||
    lower === 'team 2' ||
    lower === 'team a' ||
    lower === 'team b' ||
    lower === 'qualifier' ||
    lower === 'tbd' ||
    lower === 'tba' ||
    lower === 'to be determined' ||
    lower === 'to be announced' ||
    lower.startsWith('qualifier team') ||
    lower.includes('winner of') ||
    lower.includes('loser of')
  )
}

export function isQualifierMatch(match: {
  teamA: { name: string }
  teamB: { name: string }
}): boolean {
  return isQualifierTeam(match.teamA.name) || isQualifierTeam(match.teamB.name)
}

export function getQualifierDisplayName(
  name: string | null | undefined,
  position: 'A' | 'B'
): string {
  if (!name || isQualifierTeam(name)) {
    return `Qualifier Team ${position}`
  }
  return name
}
