import type { Team } from '@/types'
import { cn } from '@/lib/utils'

interface TeamLogoProps {
  team: Team
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-12 w-12 text-sm',
  md: 'h-16 w-16 text-lg',
  lg: 'h-20 w-20 md:h-24 md:w-24 text-2xl',
}

export function TeamLogo({ team, size = 'md', className }: TeamLogoProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-muted font-bold text-foreground overflow-hidden',
          sizes[size]
        )}
      >
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt={team.name}
            className="h-full w-full object-contain p-1"
            loading="lazy"
          />
        ) : (
          team.logo
        )}
      </div>
      <span
        className={cn(
          'font-semibold text-center truncate',
          size === 'lg' ? 'text-xl max-w-[140px]' : 'text-sm max-w-[100px]'
        )}
      >
        {team.name}
      </span>
    </div>
  )
}
