import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RecentMatch, Team } from '@/types'

function FormBlocks({ team }: { team: Team }) {
  const history = team.formHistory ?? []
  if (history.length === 0) return null

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">{team.name}</p>
      <div className="flex gap-2">
        {history.map((code, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-16 rounded-lg flex items-center justify-center font-bold text-lg border-2',
              code === 'W' && 'bg-primary/20 text-primary border-primary/50',
              code === 'L' && 'bg-red-400/15 text-red-400 border-red-400/30',
              code === 'D' && 'bg-muted text-muted-foreground border-border'
            )}
          >
            {code}
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentMatchesColumn({ team }: { team: Team }) {
  const matches = team.recentMatches ?? []
  if (matches.length === 0) return null

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">Детали матчей {team.name}</h3>
      <div className="space-y-3">
        {matches.map((m, i) => (
          <RecentMatchRow key={i} match={m} />
        ))}
      </div>
    </Card>
  )
}

function RecentMatchRow({ match }: { match: RecentMatch }) {
  const isWin = match.result === 'win'
  const isDraw = match.result === 'draw'
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="min-w-0">
        <p className="font-medium truncate">{match.opponent}</p>
        <p className="text-xs text-muted-foreground">{match.date}</p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <Badge
          variant={isWin ? 'default' : 'outline'}
          className={cn(
            isWin && 'bg-primary/20 text-primary border-primary/50',
            !isWin && !isDraw && 'bg-red-400/15 text-red-400 border-red-400/30'
          )}
        >
          {isWin ? 'W' : isDraw ? 'D' : 'L'}
        </Badge>
        <p className="text-sm mt-1 tabular-nums">{match.score}</p>
      </div>
    </div>
  )
}

function MapWinrateChart({ teamA, teamB }: { teamA: Team; teamB: Team }) {
  const rateA = Math.round((teamA.mapPoolStrength ?? teamA.winRate ?? 0.5) * 100)
  const rateB = Math.round((teamB.mapPoolStrength ?? teamB.winRate ?? 0.5) * 100)
  const data = [
    { team: teamA.name, winrate: rateA },
    { team: teamB.name, winrate: rateB },
  ]

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">Сила на картах</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="team" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(v: number) => [`${v}%`, 'Winrate']}
            />
            <Bar dataKey="winrate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1 truncate">{teamA.name}</p>
          <p className="text-2xl font-bold text-primary">{rateA}%</p>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1 truncate">{teamB.name}</p>
          <p className="text-2xl font-bold text-primary">{rateB}%</p>
        </div>
      </div>
    </Card>
  )
}

export function MatchTeamStats({ teamA, teamB }: { teamA: Team; teamB: Team }) {
  const hasForm =
    (teamA.formHistory?.length ?? 0) > 0 || (teamB.formHistory?.length ?? 0) > 0
  const hasRecent =
    (teamA.recentMatches?.length ?? 0) > 0 || (teamB.recentMatches?.length ?? 0) > 0
  const hasMapStats =
    teamA.mapPoolStrength != null ||
    teamB.mapPoolStrength != null ||
    teamA.winRate != null ||
    teamB.winRate != null

  if (!hasForm && !hasRecent && !hasMapStats) return null

  return (
    <div className="space-y-6">
      {hasForm && (
        <Card className="p-6">
          <h3 className="text-lg font-bold mb-4">Форма команд (последние 5 матчей)</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <FormBlocks team={teamA} />
            <FormBlocks team={teamB} />
          </div>
        </Card>
      )}

      {hasMapStats && <MapWinrateChart teamA={teamA} teamB={teamB} />}

      {hasRecent && (
        <div className="grid md:grid-cols-2 gap-6">
          <RecentMatchesColumn team={teamA} />
          <RecentMatchesColumn team={teamB} />
        </div>
      )}
    </div>
  )
}
