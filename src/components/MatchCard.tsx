import { Link } from 'react-router-dom'
import { ArrowRight, Circle, HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getQualifierDisplayName,
  isQualifierMatch,
  isQualifierTeam,
} from '@/lib/qualifier'
import { formatMatchStartTime } from '@/lib/formatTime'
import type { Match } from '@/types'

const GAME_SHORT: Record<string, string> = {
  cs2: 'CS2',
  dota2: 'Dota 2',
  lol: 'LoL',
  valorant: 'Valorant',
}

function QualifierTeamLogo({ letter }: { letter: string }) {
  return (
    <div
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50 shrink-0"
      title="Участник ещё не определён"
    >
      <div className="relative">
        <HelpCircle className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground/50" />
        <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center border border-primary/30">
          {letter}
        </span>
      </div>
    </div>
  )
}

function TeamBlock({
  name,
  logoUrl,
  isQualifier,
  position,
}: {
  name: string
  logoUrl?: string | null
  isQualifier: boolean
  position: 'A' | 'B'
}) {
  const displayName = getQualifierDisplayName(name, position)

  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
      {isQualifier ? (
        <QualifierTeamLogo letter={position} />
      ) : (
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              className="w-11 h-11 sm:w-12 sm:h-12 object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-xl sm:text-2xl font-bold text-muted-foreground">
              {name?.[0] || '?'}
            </span>
          )}
        </div>
      )}
      <span
        className={`text-xs sm:text-sm font-semibold text-center line-clamp-2 w-full leading-tight px-0.5 ${
          isQualifier ? 'text-muted-foreground italic' : ''
        }`}
        title={displayName}
      >
        {displayName}
      </span>
    </div>
  )
}

export function MatchCard({ match }: MatchCardProps) {
  const teamAQualifier = isQualifierTeam(match.teamA.name)
  const teamBQualifier = isQualifierTeam(match.teamB.name)
  const isQualifier = isQualifierMatch(match)

  const gameLabel =
    GAME_SHORT[match.gameId] ?? match.gameName ?? match.gameId
  const startTime =
    match.startTime ?? formatMatchStartTime(match.scheduledAt)

  return (
    <Card className="overflow-hidden hover:border-primary/50 hover:shadow-[0_0_30px_rgba(0,255,170,0.15)] transition-all duration-300 group flex flex-col">
      <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {match.status === 'live' ? (
              <Badge variant="live" className="shrink-0">
                <Circle className="w-2 h-2 fill-current animate-pulse" />
                Live
              </Badge>
            ) : (
              <Badge variant="upcoming" className="shrink-0">
                Upcoming
              </Badge>
            )}
            {isQualifier && (
              <Badge variant="qualification" className="shrink-0">
                Квалификация
              </Badge>
            )}
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider shrink-0 pt-0.5">
            {gameLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <TeamBlock
            name={match.teamA.name}
            logoUrl={match.teamA.logoUrl}
            isQualifier={teamAQualifier}
            position="A"
          />
          <span className="text-lg sm:text-xl font-bold text-muted-foreground shrink-0 px-0.5">
            VS
          </span>
          <TeamBlock
            name={match.teamB.name}
            logoUrl={match.teamB.logoUrl}
            isQualifier={teamBQualifier}
            position="B"
          />
        </div>

        <div className="space-y-1 pt-3 border-t border-border mt-auto">
          <p
            className="text-xs text-muted-foreground line-clamp-2 leading-snug"
            title={match.tournament}
          >
            {match.tournament}
          </p>
          <p className="text-sm font-medium tabular-nums">{startTime}</p>
        </div>

        <Link to={`/match/${match.id}`} className="block">
          <Button
            size="sm"
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
          >
            Анализировать
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </Card>
  )
}

interface MatchCardProps {
  match: Match
}
