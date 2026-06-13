import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Crown, LogOut, User } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/LoadingState'
import type { SavedPrediction } from '@/types'

const GAME_LABELS: Record<string, string> = {
  cs2: 'CS2',
  dota2: 'Dota 2',
  lol: 'LoL',
  valorant: 'Valorant',
}

const COLORS = ['#00FFAA', '#FF4D6B', '#1E96FF', '#DE9B35']

export function ProfilePage({ onPremiumClick }: { onPremiumClick: () => void }) {
  const { user, logout, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'history'
  const [predictions, setPredictions] = useState<SavedPrediction[]>([])
  const [loading, setLoading] = useState(true)

  const loadPredictions = useCallback(() => {
    setLoading(true)
    api
      .getPredictionHistory()
      .then(setPredictions)
      .catch(() => setPredictions([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user) loadPredictions()
  }, [user, loadPredictions])

  const gameStats = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of predictions) {
      counts[p.gameId] = (counts[p.gameId] ?? 0) + 1
    }
    return Object.entries(counts).map(([id, value]) => ({
      name: GAME_LABELS[id] ?? id,
      value,
    }))
  }, [predictions])

  const activityStats = useMemo(() => {
    const days: Record<string, number> = {}
    for (const p of predictions) {
      const day = p.createdAt.slice(0, 10)
      days[day] = (days[day] ?? 0) + 1
    }
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({ date: date.slice(5), count }))
  }, [predictions])

  if (authLoading) return <LoadingState />
  if (!user) return <Navigate to="/" replace />

  const setTab = (next: string) => setSearchParams({ tab: next })

  return (
    <main className="animate-fade-in">
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{user.email}</h1>
                  <p className="text-sm text-muted-foreground">
                    {user.predictionsCount ?? predictions.length} прогнозов
                    {user.isPremium && (
                      <Badge className="ml-2 gap-1" variant="default">
                        <Crown className="h-3 w-3" />
                        Premium
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 tabular-nums">
                    Запросов: {user.requestsRemaining ?? 0} из {user.requestsLimit ?? 1} осталось
                  </p>
                </div>
              </div>
              {!user.isPremium && (
                <Button variant="outline" onClick={onPremiumClick}>
                  <Crown className="h-4 w-4" />
                  Premium
                </Button>
              )}
            </div>
          </Card>

          <div className="flex gap-2 mb-6 border-b border-border pb-2">
            {(['history', 'stats', 'settings'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tab === t
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'history' ? 'История' : t === 'stats' ? 'Статистика' : 'Настройки'}
              </button>
            ))}
          </div>

          {tab === 'history' && (
            <Card className="overflow-hidden">
              {loading ? (
                <div className="p-8">
                  <LoadingState text="Загрузка истории..." />
                </div>
              ) : predictions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>История пуста — сгенерируйте прогноз на странице матча</p>
                  <Link to="/matches" className="text-primary hover:underline mt-2 inline-block">
                    К матчам
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                        <th className="px-4 py-3">Дата</th>
                        <th className="px-4 py-3">Матч</th>
                        <th className="px-4 py-3">Игра</th>
                        <th className="px-4 py-3">AI</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p) => (
                        <tr key={p.id} className="border-b border-border/60 hover:bg-muted/20">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">
                            {p.createdAt.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {p.teamA} vs {p.teamB}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{GAME_LABELS[p.gameId] ?? p.gameId}</Badge>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {Math.round(p.teamAProbability * 100)}% —{' '}
                            {Math.round(p.teamBProbability * 100)}%
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/match/${p.matchId}`}>
                              <Button variant="ghost" size="sm">
                                Открыть
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'stats' && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <p className="text-sm text-muted-foreground mb-1">Всего прогнозов</p>
                <p className="text-4xl font-black text-primary">{predictions.length}</p>
              </Card>
              {gameStats.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-bold mb-4">По играм</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={gameStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                          {gameStats.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
              {activityStats.length > 0 && (
                <Card className="p-6 md:col-span-2">
                  <h3 className="font-bold mb-4">Активность</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityStats}>
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <Card className="p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Подписка</p>
                <p className="font-medium">{user.isPremium ? 'Premium' : 'Бесплатная'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Лимит запросов</p>
                <p className="font-medium tabular-nums">
                  {user.requestsRemaining ?? 0} / {user.requestsLimit ?? 1} осталось
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    (использовано {user.requestsUsed ?? 0})
                  </span>
                </p>
              </div>
              <Button variant="outline" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Выйти
              </Button>
            </Card>
          )}
        </div>
      </section>
    </main>
  )
}
