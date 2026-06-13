import { Swords, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { GameSummary, Match } from '@/types'

function gameStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    finished: 'Завершена',
    running: 'Идёт',
    not_started: 'Ожидание',
    not_played: 'Не сыграна',
  }
  return labels[status ?? ''] ?? status ?? '—'
}

function gameStatusVariant(status?: string): 'live' | 'upcoming' | 'outline' {
  if (status === 'running') return 'live'
  if (status === 'finished') return 'upcoming'
  return 'outline'
}

function GameColumn({
  game,
  teamAId,
  teamBId,
}: {
  game: GameSummary
  teamAId: string
  teamBId: string
}) {
  const psA = teamAId.replace('ps-', '')
  const psB = teamBId.replace('ps-', '')
  const winnerSide =
    game.winnerId != null
      ? String(game.winnerId) === psA
        ? 'A'
        : String(game.winnerId) === psB
          ? 'B'
          : null
      : null

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center rounded-xl border border-border/80 p-4 min-h-[160px]',
        'transition-all duration-300 hover:border-primary/40',
        game.status === 'running' &&
          'border-red-400/40 bg-red-400/5 shadow-[0_0_20px_rgba(248,113,113,0.08)]'
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Игра {game.position}
      </span>

      {game.map && <p className="text-base font-black leading-tight mb-3 px-1">{game.map}</p>}

      <Badge variant={gameStatusVariant(game.status)} className="mb-4">
        {gameStatusLabel(game.status)}
      </Badge>

      <div className="mt-auto w-full space-y-1">
        {winnerSide && game.winnerName ? (
          <p
            className={cn(
              'text-xs font-semibold truncate',
              winnerSide === 'A' ? 'text-primary' : 'text-foreground'
            )}
          >
            {game.winnerName}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function MatchGamesSummary({ match }: { match: Match }) {
  const games = [...(match.games ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  )
  const results = match.results ?? []

  const scoreA =
    results.find(
      (r) =>
        r.teamName === match.teamA.name ||
        String(r.teamId) === match.teamA.id.replace('ps-', '')
    )?.score ?? results[0]?.score ?? 0
  const scoreB =
    results.find(
      (r) =>
        r.teamName === match.teamB.name ||
        String(r.teamId) === match.teamB.id.replace('ps-', '')
    )?.score ?? results[1]?.score ?? 0
  const hasSeriesScore = results.length >= 2

  if (!hasSeriesScore && games.length === 0) {
    return null
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-card/80">
        <CardTitle className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          Сводка по играм
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {hasSeriesScore && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-8 border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
            <div className="text-right">
              <p className="text-sm text-muted-foreground truncate">{match.teamA.name}</p>
              <p className="text-4xl md:text-5xl font-black text-primary tabular-nums">
                {scoreA}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 px-4">
              <Trophy className="h-5 w-5 text-muted-foreground/60" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {match.format}
              </span>
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground truncate">{match.teamB.name}</p>
              <p className="text-4xl md:text-5xl font-black tabular-nums">{scoreB}</p>
            </div>
          </div>
        )}

        {games.length > 0 && (
          <div className="px-6 py-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Карты и игры
            </h3>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${games.length}, minmax(0, 1fr))`,
              }}
            >
              {games.map((g) => (
                <GameColumn
                  key={g.id ?? g.position}
                  game={g}
                  teamAId={match.teamA.id}
                  teamBId={match.teamB.id}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
