import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Crown, Loader2, Lock, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { api } from '@/lib/api'
import { useApi } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RequestQuotaBadge } from '@/components/RequestQuotaBadge'
import { FactorBreakdownChart } from '@/components/charts/FactorBreakdownChart'
import { WinProbabilityChart } from '@/components/charts/WinProbabilityChart'
import { MatchStreams } from '@/components/match/MatchStreams'
import { isQualifierMatch } from '@/lib/qualifier'
import { MatchRosters } from '@/components/match/MatchRosters'
import { MatchGamesSummary } from '@/components/match/MatchGamesSummary'
import { MatchHeader } from '@/components/match/MatchHeader'
import { MatchTeamStats } from '@/components/match/MatchTeamStats'
import { ErrorState } from '@/components/ErrorState'
import type { PredictionResult } from '@/types'

interface MatchPageProps {
  onPremiumClick: () => void
  onAuthClick: () => void
}

export function MatchPage({ onPremiumClick, onAuthClick }: MatchPageProps) {
  const { matchId } = useParams<{ matchId: string }>()
  const { user, applyQuota } = useAuth()
  const [retryKey, setRetryKey] = useState(0)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [predictionError, setPredictionError] = useState<string | null>(null)

  const fetchMatch = useCallback(() => {
    if (!matchId) return Promise.reject(new Error('ID не указан'))
    return Promise.all([api.getMatch(matchId), api.getGames()]).then(([match, games]) => ({
      match,
      game: games.find((g) => g.id === match.gameId),
    }))
  }, [matchId, retryKey])

  const {
    data: matchData,
    loading: matchLoading,
    error: matchError,
  } = useApi(fetchMatch, [matchId, retryKey])

  const generatePrediction = async () => {
    if (!matchId || !user) return
    setGenerating(true)
    setPredictionError(null)
    try {
      const result = await api.getPrediction(matchId)
      setPrediction(result)
      if (result.quota) {
        applyQuota(result.quota)
      }
    } catch (err) {
      setPrediction(null)
      setPredictionError(err instanceof Error ? err.message : 'Не удалось сгенерировать прогноз')
    } finally {
      setGenerating(false)
    }
  }

  if (matchLoading) {
    return (
      <main className="pt-32 pb-16 px-4 animate-fade-in">
        <div className="container mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
      </main>
    )
  }

  if (matchError || !matchData?.match || !matchData.game) {
    return (
      <main className="pt-32 pb-16 px-4 animate-fade-in">
        <div className="container mx-auto text-center max-w-6xl">
          <h2 className="text-2xl font-bold mb-4">Матч не найден</h2>
          <ErrorState
            message={matchError ?? 'Матч не найден'}
            onRetry={() => setRetryKey((k) => k + 1)}
          />
          <Link to="/matches" className="mt-4 inline-block text-primary hover:underline">
            Вернуться к списку матчей
          </Link>
        </div>
      </main>
    )
  }

  const { match, game } = matchData
  const isPremium = user?.isPremium
  const reportLocked = prediction?.reportLocked ?? !isPremium
  const hasAi = prediction?.reportSource?.includes('llm')
  const quotaExhausted = user != null && (user.requestsRemaining ?? 0) <= 0

  return (
    <main className="animate-fade-in">
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <Link
            to="/matches"
            className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к матчам
          </Link>

          <div className="space-y-6 mb-8">
            <MatchHeader match={match} gameName={game.name} />
            <MatchRosters
              teamA={match.teamA}
              teamB={match.teamB}
              isQualification={isQualifierMatch(match)}
            />
            <MatchTeamStats teamA={match.teamA} teamB={match.teamB} />
            <MatchGamesSummary match={match} />
            <MatchStreams match={match} />
          </div>

          <Card className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <h3 className="text-2xl font-bold text-center sm:text-left">ИИ-прогноз</h3>
              {user && <RequestQuotaBadge user={user} />}
            </div>

            {!prediction ? (
              <div className="text-center py-6 space-y-4">
                {user ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Осталось{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {user.requestsRemaining ?? 0}
                      </span>{' '}
                      из{' '}
                      <span className="font-semibold text-foreground tabular-nums">
                        {user.requestsLimit ?? 1}
                      </span>{' '}
                      запросов
                      {user.isPremium ? ' (Premium)' : ' (бесплатно)'}
                    </p>
                    {quotaExhausted && (
                      <p className="text-sm text-destructive">
                        Лимит исчерпан. Повторный просмотр уже сгенерированных прогнозов не
                        тратит запросы.
                      </p>
                    )}
                    {predictionError && (
                      <p className="text-sm text-destructive">{predictionError}</p>
                    )}
                    <Button
                      size="lg"
                      onClick={generatePrediction}
                      disabled={generating}
                      className="px-8"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Генерация прогноза...
                        </>
                      ) : (
                        'Сгенерировать ИИ-прогноз'
                      )}
                    </Button>
                    {quotaExhausted && !user.isPremium && (
                      <div>
                        <Button variant="outline" onClick={onPremiumClick}>
                          <Crown className="h-4 w-4" />
                          Получить Premium — 20 запросов
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      Войдите, чтобы сгенерировать прогноз
                    </p>
                    <Button size="lg" onClick={onAuthClick} className="px-8">
                      Войти
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {hasAi && (
                  <div className="flex justify-center">
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI+
                    </Badge>
                  </div>
                )}

                <WinProbabilityChart
                  teamAName={match.teamA.name}
                  teamBName={match.teamB.name}
                  teamAProbability={prediction.teamAProbability}
                  teamBProbability={prediction.teamBProbability}
                  gameColor={game.color}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl border border-border bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">{match.teamA.name}</p>
                    <p className="text-3xl font-black text-primary">
                      {Math.round(prediction.teamAProbability * 100)}%
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl border border-border bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">{match.teamB.name}</p>
                    <p className="text-3xl font-black" style={{ color: game.color }}>
                      {Math.round(prediction.teamBProbability * 100)}%
                    </p>
                  </div>
                </div>

                {prediction.factors.length > 0 && (
                  <FactorBreakdownChart
                    factors={prediction.factors}
                    teamAName={match.teamA.name}
                    teamBName={match.teamB.name}
                    gameColor={game.color}
                  />
                )}

                {prediction.keyArguments.length > 0 && (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {prediction.keyArguments.map((arg, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary">→</span>
                        {arg}
                      </li>
                    ))}
                  </ul>
                )}

                <PredictionReport
                  prediction={prediction}
                  reportLocked={reportLocked}
                  onPremiumClick={onPremiumClick}
                />
              </div>
            )}
          </Card>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Прогнозы носят развлекательный характер
          </p>
        </div>
      </section>
    </main>
  )
}

function PredictionReport({
  prediction,
  reportLocked,
  onPremiumClick,
}: {
  prediction: PredictionResult
  reportLocked: boolean
  onPremiumClick: () => void
}) {
  if (!prediction.report?.trim()) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Подробный отчёт недоступен — недостаточно данных PandaScore.
      </p>
    )
  }

  if (!prediction.report) return null

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card to-background overflow-hidden">
      <div className="p-4 md:p-6 border-b border-primary/20 bg-primary/5">
        <h4 className="text-lg font-bold flex items-center gap-2">
          Подробный анализ матча
          {reportLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          Уверенность: {Math.round(prediction.confidence * 100)}%
        </p>
      </div>
      <div className="p-4 md:p-6 relative">
        {!reportLocked ? (
          <div className="premium-report prose prose-invert max-w-none">
            <ReactMarkdown>{prediction.report}</ReactMarkdown>
          </div>
        ) : (
          <div className="relative">
            <div className="premium-report blur-sm select-none pointer-events-none max-h-48 overflow-hidden prose prose-invert">
              <ReactMarkdown>{prediction.report}</ReactMarkdown>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
              <Lock className="h-8 w-8 text-primary mb-3" />
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-xs">
                Полный отчёт доступен с Premium
              </p>
              <Button onClick={onPremiumClick}>
                <Crown className="h-4 w-4" />
                Получить Premium
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
