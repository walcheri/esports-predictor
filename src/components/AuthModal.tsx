import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'

const VERIFY_HINT =
  'Подтвердите email. Проверьте почту или запросите новый код.'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AuthStep = 'login' | 'register' | 'verify'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(true)
  const [emailError, setEmailError] = useState<string | null>(null)
  const { login, register, verifyEmail, resendVerification } = useAuth()

  useEffect(() => {
    if (!open) {
      setStep('login')
      setEmail('')
      setPassword('')
      setPasswordConfirm('')
      setCode('')
      setError('')
      setCountdown(0)
      setDevCode(null)
      setEmailSent(true)
      setEmailError(null)
    }
  }, [open])

  useEffect(() => {
    if (step !== 'verify' || countdown <= 0) return
    const timer = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step, countdown])

  const startVerification = (
    userEmail: string,
    ttl: number,
    codeFromDev?: string | null,
    sent?: boolean,
    error?: string | null
  ) => {
    setEmail(userEmail)
    setStep('verify')
    setCode('')
    setCountdown(ttl)
    setDevCode(codeFromDev ?? null)
    setEmailSent(sent === true)
    setEmailError(error ?? null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (step === 'login') {
        await login(email, password)
        onOpenChange(false)
      } else if (step === 'register') {
        if (password !== passwordConfirm) {
          setError('Пароли не совпадают')
          return
        }
        const pending = await register(email, password, passwordConfirm)
        startVerification(
          pending.email || email,
          pending.codeTtlSeconds,
          pending.devCode,
          pending.emailSent,
          pending.emailError ?? pending.message
        )
      } else {
        await verifyEmail(email, code.trim())
        onOpenChange(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка авторизации'
      if (step === 'login' && message.includes('Подтвердите email')) {
        startVerification(email, 120)
        setError('Сначала подтвердите email')
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setSubmitting(true)
    try {
      const pending = await resendVerification(email)
      setCountdown(pending.codeTtlSeconds)
      setDevCode(pending.devCode ?? null)
      setEmailSent(pending.emailSent === true)
      setEmailError(pending.emailError ?? null)
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код')
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    step === 'login'
      ? 'Вход в аккаунт'
      : step === 'register'
        ? 'Регистрация'
        : 'Подтверждение email'

  const description =
    step === 'login'
      ? 'Войдите, чтобы сохранять анализы и получать уведомления.'
      : step === 'register'
        ? 'Создайте аккаунт для доступа к расширенной аналитике.'
        : emailSent
          ? `Мы отправили код на ${email}. Код действует 2 минуты.`
          : `Не удалось отправить письмо на ${email}. Обратитесь к администратору или попробуйте позже.`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {step !== 'verify' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </>
          )}

          {step === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Подтверждение пароля</Label>
              <Input
                id="passwordConfirm"
                type="password"
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          {step === 'verify' && !emailSent && !devCode && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {emailError ?? 'Письмо с кодом не отправлено.'}
            </div>
          )}

          {step === 'verify' && devCode && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Письмо не отправилось — код для разработки:
              </p>
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-400">
                {devCode}
              </p>
            </div>
          )}

          {step === 'verify' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Код из письма</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  pattern="\d{6}"
                  className="text-center text-2xl tracking-[0.4em] font-mono"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center tabular-nums">
                {countdown > 0 ? (
                  <>Код действует ещё {formatCountdown(countdown)}</>
                ) : (
                  <span className="text-destructive">Срок действия кода истёк</span>
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={submitting}
                onClick={handleResend}
              >
                Отправить код повторно
              </Button>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? 'Загрузка...'
              : step === 'login'
                ? 'Войти'
                : step === 'register'
                  ? 'Зарегистрироваться'
                  : 'Подтвердить'}
          </Button>
        </form>

        {step !== 'verify' ? (
          <p className="text-center text-sm text-muted-foreground">
            {step === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => {
                setStep(step === 'login' ? 'register' : 'login')
                setError('')
              }}
            >
              {step === 'login' ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => {
                setStep('login')
                setError('')
              }}
            >
              Вернуться ко входу
            </button>
          </p>
        )}

        {step === 'verify' && (
          <p className="text-xs text-center text-muted-foreground">{VERIFY_HINT}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
