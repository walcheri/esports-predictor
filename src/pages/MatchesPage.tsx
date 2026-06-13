import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { MatchCard } from '@/components/MatchCard'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ErrorState'
import type { Match, Tournament } from '@/types'

const GAME_NAMES: Record<string, string> = {
  all: 'Все игры',
  cs2: 'Counter-Strike 2',
  dota2: 'Dota 2',
  lol: 'League of Legends',
  valorant: 'Valorant',
}

const MATCHES_PER_PAGE = 24

type StatusFilter = 'all' | 'live' | 'upcoming'
type DateFilter = 'all' | 'today' | 'tomorrow' | 'week'

export function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const gameParam = searchParams.get('game') || 'all'
  const tournamentParam = searchParams.get('tournament') || 'all'

  const [game, setGame] = useState(gameParam)
  const [tournament, setTournament] = useState(tournamentParam)
  const [date, setDate] = useState<DateFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('upcoming')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setGame(gameParam)
    setTournament(tournamentParam)
  }, [gameParam, tournamentParam])

  useEffect(() => {
    if (game === 'all') {
      setTournaments([])
      return
    }
    api
      .getTournaments(game)
      .then(setTournaments)
      .catch(() => setTournaments([]))
  }, [game])

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getMatches({
        gameId: game !== 'all' ? game : undefined,
        status: status === 'all' ? 'all' : status,
        tournament: tournament !== 'all' ? tournament : undefined,
        date: status === 'live' ? undefined : date !== 'all' ? date : undefined,
        page: currentPage,
        perPage: MATCHES_PER_PAGE,
      })
      setMatches(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить матчи')
      setMatches([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [game, tournament, date, status, currentPage])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const updateUrl = (nextGame: string, nextTournament: string) => {
    const params: Record<string, string> = {}
    if (nextGame !== 'all') params.game = nextGame
    if (nextTournament !== 'all') params.tournament = nextTournament
    setSearchParams(params)
  }

  const handleGameChange = (value: string) => {
    setGame(value)
    setTournament('all')
    setCurrentPage(1)
    updateUrl(value, 'all')
  }

  const handleTournamentChange = (value: string) => {
    setTournament(value)
    setCurrentPage(1)
    updateUrl(game, value)
  }

  const totalPages = Math.ceil(total / MATCHES_PER_PAGE)

  return (
    <main className="animate-fade-in">
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6 gap-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к выбору игры
          </Button>

          <h1 className="text-3xl md:text-4xl font-black mb-1">
            {GAME_NAMES[game] ?? 'Все игры'}
          </h1>
          {!loading && total > 0 && (
            <p className="text-muted-foreground mb-8">{total} матчей найдено</p>
          )}
          {(loading || total === 0) && <div className="mb-8" />}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Select
              label="Игра"
              value={game}
              onChange={(e) => handleGameChange(e.target.value)}
            >
              <option value="all">Все игры</option>
              <option value="cs2">Counter-Strike 2</option>
              <option value="dota2">Dota 2</option>
              <option value="lol">League of Legends</option>
              <option value="valorant">Valorant</option>
            </Select>

            {game !== 'all' && (
              <Select
                label="Турнир"
                value={tournament}
                onChange={(e) => handleTournamentChange(e.target.value)}
              >
                <option value="all">Все турниры</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}

            {status !== 'live' && (
              <Select
                label="Дата"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value as DateFilter)
                  setCurrentPage(1)
                }}
              >
                <option value="all">Все предстоящие</option>
                <option value="today">Сегодня</option>
                <option value="tomorrow">Завтра</option>
                <option value="week">7 дней</option>
              </Select>
            )}

            <Select
              label="Статус"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter)
                setCurrentPage(1)
              }}
            >
              <option value="all">Все матчи</option>
              <option value="live">Live</option>
              <option value="upcoming">Upcoming</option>
            </Select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={fetchMatches} />
          ) : matches.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border bg-card/50 space-y-2">
              <p className="text-lg font-medium">Нет матчей по выбранным фильтрам</p>
              <p className="text-sm text-muted-foreground">
                Попробуйте другую дату, статус или игру
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-10"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Вперёд
                  </Button>
                </div>
              )}
            </>
          )}

          <p className="mt-12 text-center text-xs text-muted-foreground">
            Прогнозы носят развлекательный характер
          </p>
        </div>
      </section>
    </main>
  )
}
