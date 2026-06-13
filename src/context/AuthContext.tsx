import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import type { RegisterPending, RequestQuota, User } from '@/types'
import { api, getAuthToken, setAuthToken } from '@/lib/api'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    passwordConfirm: string
  ) => Promise<RegisterPending>
  verifyEmail: (email: string, code: string) => Promise<void>
  resendVerification: (email: string) => Promise<RegisterPending>
  logout: () => void
  upgradeToPremium: () => Promise<void>
  applyQuota: (quota: RequestQuota) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .getMe()
      .then(setUser)
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    setAuthToken(res.access_token)
    setUser(res.user)
  }, [])

  const register = useCallback(
    async (email: string, password: string, passwordConfirm: string) => {
      return api.register(email, password, passwordConfirm)
    },
    []
  )

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const res = await api.verifyEmail(email, code)
    setAuthToken(res.access_token)
    setUser(res.user)
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    return api.resendVerification(email)
  }, [])

  const logout = useCallback(() => {
    setAuthToken(null)
    setUser(null)
  }, [])

  const upgradeToPremium = useCallback(async () => {
    const updated = await api.upgradePremium()
    setUser(updated)
  }, [])

  const applyQuota = useCallback((quota: RequestQuota) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            requestsLimit: quota.requestsLimit,
            requestsUsed: quota.requestsUsed,
            requestsRemaining: quota.requestsRemaining,
          }
        : prev
    )
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyEmail,
        resendVerification,
        logout,
        upgradeToPremium,
        applyQuota,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
