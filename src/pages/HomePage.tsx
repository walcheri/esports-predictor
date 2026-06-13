import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Gamepad2, Swords, Target } from 'lucide-react'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { LoadingState } from '@/components/LoadingState'
import { ErrorState } from '@/components/ErrorState'
import { cn } from '@/lib/utils'
import type { Game, GameId } from '@/types'

const gameIcons: Record<GameId, typeof Crosshair> = {
  cs2: Crosshair,
  dota2: Swords,
  lol: Gamepad2,
  valorant: Target,
}

interface GameStats {
  today: number
  live: number
}

export function HomePage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Partial<Record<GameId, GameStats>>>({})

  const fetchGames = useCallback(() => api.getGames(), [])
  const { data: games, loading, error } = useApi(fetchGames, [])

  useEffect(() => {
    if (!games?.length) return

    let cancelled = false

    const loadStats = async () => {
      const updates: Partial<Record<GameId, GameStats>> = {}
      await Promise.all(
        games.map(async (game) => {
          try {
            const [todayRes, liveRes] = await Promise.all([
              api.getMatches({ gameId: game.id, date: 'today', perPage: 1 }),
              api.getMatches({ gameId: game.id, status: 'live', perPage: 1 }),
            ])
            updates[game.id] = {
              today: todayRes.total,
              live: liveRes.total,
            }
          } catch {
            updates[game.id] = { today: 0, live: 0 }
          }
        })
      )
      if (!cancelled) setStats(updates)
    }

    loadStats()
    const interval = setInterval(loadStats, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [games])

  if (loading) return <LoadingState text="Загрузка..." />
  if (error || !games) {
    return (
      <ErrorState message={error ?? 'Не удалось загрузить данные'} onRetry={() => window.location.reload()} />
    )
  }

  return (
    <main className="animate-fade-in">
      <section className="pt-32 pb-12 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            Прогнозируй матчи{' '}
            <span className="text-gradient-primary">с ИИ</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Выбери дисциплину и получи точный прогноз на основе статистики команд
          </p>
        </div>
      </section>

      <section className="pb-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {games.map((game: Game) => {
              const Icon = gameIcons[game.id]
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => navigate(`/matches?game=${game.id}`)}
                  className={cn(
                    'group relative flex flex-col items-center text-center rounded-2xl border-2 border-border p-5 sm:p-6',
                    'transition-all duration-300 hover:scale-[1.03] hover:border-transparent',
                    `bg-gradient-to-b ${game.gradient}`
                  )}
                  style={
                    {
                      '--game-color': game.color,
                    } as CSSProperties
                  }
                >
                  <div
                    className={cn(
                      'relative flex h-[72px] w-[72px] sm:h-20 sm:w-20 items-center justify-center rounded-2xl',
                      'border-2 transition-all duration-300',
                      'group-hover:scale-110 group-hover:shadow-[0_0_32px_color-mix(in_srgb,var(--game-color)_55%,transparent)]'
                    )}
                    style={{
                      background: `color-mix(in srgb, ${game.color} 22%, transparent)`,
                      borderColor: `color-mix(in srgb, ${game.color} 45%, transparent)`,
                      boxShadow: `0 8px 28px color-mix(in srgb, ${game.color} 35%, transparent)`,
                    }}
                  >
                    <Icon
                      className="h-9 w-9 sm:h-10 sm:w-10 transition-transform duration-300 group-hover:scale-105"
                      style={{ color: game.color }}
                      strokeWidth={2.25}
                    />
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${game.color} 30%, transparent), transparent 70%)`,
                      }}
                    />
                  </div>

                  <h2 className="mt-4 text-base sm:text-lg font-bold leading-tight">
                    {game.shortName}
                  </h2>

                  <div className="mt-3 space-y-0.5 text-xs sm:text-sm text-muted-foreground w-full">
                    {stats[game.id] ? (
                      <>
                        <p>
                          <span className="font-semibold" style={{ color: game.color }}>
                            {stats[game.id]!.today}
                          </span>{' '}
                          сегодня
                        </p>
                        <p>
                          <span className="font-semibold text-red-400">
                            {stats[game.id]!.live}
                          </span>{' '}
                          live
                        </p>
                      </>
                    ) : (
                      <p>Загрузка...</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => navigate('/matches')}
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              Смотреть все матчи →
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
