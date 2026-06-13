import { ExternalLink, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatMatchStartTime } from '@/lib/formatTime'
import { isQualifierMatch } from '@/lib/qualifier'
import type { Match } from '@/types'

function streamUrl(match: Match): string | null {
  if (match.officialStreamUrl) return match.officialStreamUrl
  const main = match.streams?.find((s) => s.main) ?? match.streams?.[0]
  return main?.rawUrl ?? match.liveUrl ?? null
}

export function MatchHeader({ match, gameName }: { match: Match; gameName: string }) {
  const startTime = match.startTime ?? formatMatchStartTime(match.scheduledAt)
  const watchUrl = streamUrl(match)

  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        {match.status === 'live' ? (
          <Badge variant="live">
            <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse mr-1.5" />
            Live
          </Badge>
        ) : (
          <Badge variant="upcoming">Upcoming</Badge>
        )}
        <span className="text-sm text-muted-foreground">{gameName}</span>
      </div>

      <div className="flex items-center justify-between gap-6 md:gap-10">
        <div className="flex-1 text-center min-w-0">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {match.teamA.logoUrl ? (
              <img
                src={match.teamA.logoUrl}
                alt={match.teamA.name}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <span className="text-3xl font-bold text-primary">{match.teamA.logo}</span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold truncate">{match.teamA.name}</h2>
        </div>

        <div className="text-center shrink-0">
          <div className="text-3xl md:text-4xl font-black text-muted-foreground mb-2">VS</div>
          <p className="text-sm text-muted-foreground whitespace-nowrap">{startTime}</p>
          <p className="text-xs text-muted-foreground mt-1">{match.format}</p>
        </div>

        <div className="flex-1 text-center min-w-0">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {match.teamB.logoUrl ? (
              <img
                src={match.teamB.logoUrl}
                alt={match.teamB.name}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <span className="text-3xl font-bold text-primary">{match.teamB.logo}</span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold truncate">{match.teamB.name}</h2>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
        <p className="text-muted-foreground text-center">{match.tournament}</p>
        {isQualifierMatch(match) && (
          <Badge variant="qualification">Квалификация</Badge>
        )}
        {watchUrl && (
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 rounded-lg hover:bg-red-600/30 transition-colors text-sm font-medium"
          >
            <TrendingUp className="h-4 w-4" />
            Смотреть стрим
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>
        )}
      </div>
    </Card>
  )
}
