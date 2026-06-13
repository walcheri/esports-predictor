export type GameId = 'cs2' | 'dota2' | 'lol' | 'valorant'

export type MatchStatus = 'live' | 'upcoming' | 'finished'

export type MatchFormat = 'Bo1' | 'Bo3' | 'Bo5'

export interface Player {
  id?: number
  name?: string
  slug?: string
  imageUrl?: string | null
  role?: string | null
  nationality?: string | null
  active?: boolean
}

export interface Stream {
  language: string
  main: boolean
  official: boolean
  rawUrl: string
  embedUrl?: string | null
}

export interface GameSummary {
  id?: number
  position?: number
  status?: string
  map?: string
  winnerName?: string
  winnerId?: number
  length?: number
}

export interface Score {
  teamId?: number
  teamName?: string
  score: number
}

export interface Game {
  id: GameId
  name: string
  shortName: string
  color: string
  gradient: string
  matchCount: number
}

export interface Tournament {
  id: string
  name: string
  matchCount: number
}

export interface RecentMatch {
  opponent: string
  date: string
  result: 'win' | 'loss' | 'draw' | string
  score: string
}

export interface Team {
  id: string
  name: string
  logo: string
  logoUrl?: string | null
  country?: string | null
  players?: Player[]
  winRate?: number | null
  elo?: number | null
  rosterStability?: number | null
  recentForm?: number | null
  mapPoolStrength?: number | null
  matchesSampled?: number | null
  formHistory?: string[]
  recentMatches?: RecentMatch[]
}

export interface SavedPrediction {
  id: number
  matchId: string
  teamA: string
  teamB: string
  gameId: GameId
  tournament?: string | null
  predictedWinner?: string | null
  teamAProbability: number
  teamBProbability: number
  reportPreview?: string | null
  fullReport?: string | null
  createdAt: string
}

export interface Match {
  id: string
  gameId: GameId
  gameName?: string
  teamA: Team
  teamB: Team
  status: MatchStatus
  format: MatchFormat
  tournament: string
  isQualification: boolean
  scheduledAt: string
  startTime?: string
  mapPool?: string[]
  streams?: Stream[]
  games?: GameSummary[]
  results?: Score[]
  officialStreamUrl?: string | null
  liveUrl?: string | null
}

export interface FactorBreakdown {
  name: string
  teamA: number
  teamB: number
}

export interface RequestQuota {
  requestsLimit: number
  requestsUsed: number
  requestsRemaining: number
}

export interface PredictionResult {
  teamAProbability: number
  teamBProbability: number
  confidence: number
  factors: FactorBreakdown[]
  report: string
  keyArguments: string[]
  reportLocked?: boolean
  reportSource?: string
  quota?: RequestQuota
}

export interface User {
  email: string
  isPremium: boolean
  emailVerified?: boolean
  username?: string | null
  avatarUrl?: string | null
  predictionsCount?: number
  requestsLimit?: number
  requestsUsed?: number
  requestsRemaining?: number
  createdAt?: string | null
}

export interface RegisterPending {
  email: string
  message: string
  requiresVerification: boolean
  codeTtlSeconds: number
  devCode?: string | null
  emailSent?: boolean
  emailError?: string | null
}
