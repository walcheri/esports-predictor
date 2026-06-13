import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Crosshair, Gamepad2, Swords, Target } from 'lucide-react'
import type { Game } from '@/types'
import { cn } from '@/lib/utils'

const gameIcons: Record<string, ReactNode> = {
  cs2: <Crosshair className="h-8 w-8" />,
  dota2: <Swords className="h-8 w-8" />,
  lol: <Gamepad2 className="h-8 w-8" />,
  valorant: <Target className="h-8 w-8" />,
}

interface GameCardProps {
  game: Game
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link to={`/matches?game=${game.id}`}>
      <div
        className={cn(
          'group relative overflow-hidden rounded-2xl border-2 border-border p-6 transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(0,255,170,0.3)]',
          `bg-gradient-to-br ${game.gradient}`
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">{game.shortName}</h3>
            <p className="text-sm text-muted-foreground mt-1">{game.name}</p>
            <p className="text-xs text-primary mt-3 font-medium">
              {game.matchCount} матчей
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card/50 backdrop-blur-sm text-primary">
            {gameIcons[game.id]}
          </div>
        </div>
      </div>
    </Link>
  )
}
