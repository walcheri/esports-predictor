import type {
  Game,
  GameId,
  GameSummary,
  Match,
  Player,
  PredictionResult,
  RegisterPending,
  Score,
  Stream,
  Team,
  User,
} from '@/types'

const API_URL = import.meta.env.VITE_API_URL ?? ''

let authToken: string | null = localStorage.getItem('esports-token')

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('esports-token', token)
  } else {
    localStorage.removeItem('esports-token')
  }
}

export function getAuthToken(): string | null {
  return authToken
}

function parseErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'object' && item && 'msg' in item) {
          return String((item as { msg: string }).msg)
        }
        return String(item)
      })
      .join('. ')
  }
  return 'Ошибка запроса'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(parseErrorDetail(err.detail) || res.statusText || 'Ошибка запроса')
  }

  return res.json()
}

function mapRegisterPending(raw: Record<string, unknown>): RegisterPending {
  const user = raw.user as Record<string, unknown> | undefined
  return {
    email: (raw.email as string) || (user?.email as string) || '',
    message: (raw.message as string) || 'На почту отправлен код подтверждения',
    requiresVerification: raw.requires_verification !== false,
    codeTtlSeconds: (raw.code_ttl_seconds as number) ?? 120,
    devCode: (raw.dev_code as string | null | undefined) ?? null,
    emailSent: raw.email_sent === true,
    emailError: (raw.email_error as string | null | undefined) ?? null,
  }
}

function mapPlayer(raw: Record<string, unknown>): Player {
  return {
    id: raw.id as number | undefined,
    name: raw.name as string | undefined,
    slug: raw.slug as string | undefined,
    imageUrl: (raw.image_url as string | null) ?? null,
    role: (raw.role as string | null) ?? null,
    nationality: (raw.nationality as string | null) ?? null,
    active: raw.active as boolean | undefined,
  }
}

function mapTeam(raw: Record<string, unknown>): Team {
  const players = (raw.players as Array<Record<string, unknown>> | undefined)?.map(
    mapPlayer
  )
  return {
    id: raw.id as string,
    name: raw.name as string,
    logo: raw.logo as string,
    logoUrl: (raw.logo_url as string | null) ?? null,
    country: (raw.country as string | null) ?? null,
    players,
    winRate: (raw.win_rate as number | null) ?? null,
    elo: (raw.elo as number | null) ?? null,
    rosterStability: (raw.roster_stability as number | null) ?? null,
    recentForm: (raw.recent_form as number | null) ?? null,
    mapPoolStrength: (raw.map_pool_strength as number | null) ?? null,
    matchesSampled: (raw.matches_sampled as number | null) ?? null,
    formHistory: (raw.form_history as string[] | undefined) ?? [],
    recentMatches: (
      (raw.recent_matches as Array<Record<string, unknown>> | undefined) ?? []
    ).map((m) => ({
      opponent: m.opponent as string,
      date: m.date as string,
      result: m.result as string,
      score: m.score as string,
    })),
  }
}

function mapStream(raw: Record<string, unknown>): Stream {
  return {
    language: raw.language as string,
    main: Boolean(raw.main),
    official: Boolean(raw.official),
    rawUrl: raw.raw_url as string,
    embedUrl: (raw.embed_url as string | null) ?? null,
  }
}

function mapGameSummary(raw: Record<string, unknown>): GameSummary {
  return {
    id: raw.id as number | undefined,
    position: raw.position as number | undefined,
    status: raw.status as string | undefined,
    map: raw.map as string | undefined,
    winnerName: raw.winner_name as string | undefined,
    winnerId: raw.winner_id as number | undefined,
    length: raw.length as number | undefined,
  }
}

function mapScore(raw: Record<string, unknown>): Score {
  return {
    teamId: raw.team_id as number | undefined,
    teamName: raw.team_name as string | undefined,
    score: (raw.score as number) ?? 0,
  }
}

function mapMatch(raw: Record<string, unknown>): Match {
  return {
    id: raw.id as string,
    gameId: raw.game_id as GameId,
    teamA: mapTeam(raw.team_a as Record<string, unknown>),
    teamB: mapTeam(raw.team_b as Record<string, unknown>),
    status: raw.status as Match['status'],
    format: raw.format as Match['format'],
    tournament: raw.tournament as string,
    isQualification: raw.is_qualification as boolean,
    scheduledAt: raw.scheduled_at as string,
    startTime: raw.start_time as string | undefined,
    gameName: raw.game_name as string | undefined,
    mapPool: (raw.map_pool as string[] | null) ?? undefined,
    streams: ((raw.streams as Array<Record<string, unknown>>) ?? []).map(mapStream),
    games: ((raw.games as Array<Record<string, unknown>>) ?? []).map(mapGameSummary),
    results: ((raw.results as Array<Record<string, unknown>>) ?? []).map(mapScore),
    officialStreamUrl: (raw.official_stream_url as string | null) ?? null,
    liveUrl: (raw.live_url as string | null) ?? null,
  }
}

function mapGame(raw: Record<string, unknown>): Game {
  return {
    id: raw.id as GameId,
    name: raw.name as string,
    shortName: raw.short_name as string,
    color: raw.color as string,
    gradient: raw.gradient as string,
    matchCount: raw.match_count as number,
  }
}

function mapQuota(raw: Record<string, unknown>) {
  return {
    requestsLimit: raw.requests_limit as number,
    requestsUsed: raw.requests_used as number,
    requestsRemaining: raw.requests_remaining as number,
  }
}

function mapUser(raw: Record<string, unknown>): User {
  return {
    email: raw.email as string,
    isPremium: Boolean(raw.is_premium),
    emailVerified: Boolean(raw.email_verified),
    username: (raw.username as string | null) ?? null,
    avatarUrl: (raw.avatar_url as string | null) ?? null,
    predictionsCount: (raw.predictions_count as number | undefined) ?? 0,
    requestsLimit: (raw.requests_limit as number | undefined) ?? 1,
    requestsUsed: (raw.requests_used as number | undefined) ?? 0,
    requestsRemaining: (raw.requests_remaining as number | undefined) ?? 1,
    createdAt: (raw.created_at as string | null) ?? null,
  }
}

function mapPrediction(raw: Record<string, unknown>): PredictionResult {
  const factors = (raw.factors as Array<Record<string, unknown>>).map((f) => ({
    name: f.name as string,
    teamA: f.team_a as number,
    teamB: f.team_b as number,
  }))
  const quotaRaw = raw.quota as Record<string, unknown> | null | undefined
  return {
    teamAProbability: raw.team_a_probability as number,
    teamBProbability: raw.team_b_probability as number,
    confidence: raw.confidence as number,
    factors,
    keyArguments: raw.key_arguments as string[],
    report: (raw.report as string | null) ?? '',
    reportLocked: raw.report_locked as boolean,
    reportSource: raw.report_source as string | undefined,
    quota: quotaRaw ? mapQuota(quotaRaw) : undefined,
  }
}

export const api = {
  getGames: () =>
    request<Record<string, unknown>[]>('/api/games').then((list) => list.map(mapGame)),

  getGame: (id: string) =>
    request<Record<string, unknown>>(`/api/games/${id}`).then(mapGame),

  getTournaments: (gameId?: string) => {
    const qs = gameId ? `?game_id=${encodeURIComponent(gameId)}` : ''
    return request<Record<string, unknown>[]>(`/api/tournaments${qs}`).then((list) =>
      list.map((raw) => ({
        id: raw.id as string,
        name: raw.name as string,
        matchCount: raw.match_count as number,
      }))
    )
  },

  getMatches: (params?: {
    gameId?: string
    status?: string
    tournament?: string
    date?: string
    page?: number
    perPage?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.gameId) qs.set('game_id', params.gameId)
    if (params?.status) qs.set('status', params.status)
    if (params?.tournament) qs.set('tournament', params.tournament)
    if (params?.date) qs.set('date', params.date)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.perPage) qs.set('per_page', String(params.perPage))
    const query = qs.toString() ? `?${qs}` : ''
    return request<Record<string, unknown>>(`/api/matches${query}`).then((raw) => ({
      items: ((raw.items as Array<Record<string, unknown>>) ?? []).map(mapMatch),
      page: raw.page as number,
      perPage: raw.per_page as number,
      total: raw.total as number,
      hasMore: raw.has_more as boolean,
    }))
  },

  getMatch: (id: string) =>
    request<Record<string, unknown>>(`/api/matches/${id}`).then(mapMatch),

  getPrediction: (matchId: string) =>
    request<Record<string, unknown>>(`/api/matches/${matchId}/prediction`).then(
      mapPrediction
    ),

  getPredictionHistory: () =>
    request<Record<string, unknown>[]>('/api/profile/predictions').then((list) =>
      list.map((raw) => ({
        id: raw.id as number,
        matchId: raw.match_id as string,
        teamA: raw.team_a as string,
        teamB: raw.team_b as string,
        gameId: raw.game_id as GameId,
        tournament: (raw.tournament as string | null) ?? null,
        predictedWinner: (raw.predicted_winner as string | null) ?? null,
        teamAProbability: raw.team_a_probability as number,
        teamBProbability: raw.team_b_probability as number,
        reportPreview: (raw.report_preview as string | null) ?? null,
        fullReport: (raw.full_report as string | null) ?? null,
        createdAt: raw.created_at as string,
      }))
    ),

  joinPremiumWaitlist: (email: string) =>
    request<{ message: string }>('/api/premium/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  getHealth: () =>
    request<{
      status: string
      pandascore: boolean
      synced_matches: number
      live_matches: number
    }>('/api/health'),

  sync: () =>
    request<Record<string, unknown>>('/api/sync', { method: 'POST' }),

  register: (email: string, password: string, passwordConfirm: string) =>
    request<Record<string, unknown>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        password_confirm: passwordConfirm,
      }),
    }).then(mapRegisterPending),

  verifyEmail: (email: string, code: string) =>
    request<{ access_token: string; user: Record<string, unknown> }>(
      '/api/auth/verify-email',
      { method: 'POST', body: JSON.stringify({ email, code }) }
    ).then((res) => ({
      access_token: res.access_token,
      user: mapUser(res.user),
    })),

  resendVerification: (email: string) =>
    request<Record<string, unknown>>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }).then(mapRegisterPending),

  login: (email: string, password: string) =>
    request<{ access_token: string; user: Record<string, unknown> }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ).then((res) => ({
      access_token: res.access_token,
      user: mapUser(res.user),
    })),

  getMe: () => request<Record<string, unknown>>('/api/auth/me').then(mapUser),

  upgradePremium: () =>
    request<Record<string, unknown>>('/api/auth/premium', { method: 'POST' }).then(
      mapUser
    ),
}
