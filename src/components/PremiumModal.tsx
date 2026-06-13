import { useState } from 'react'
import { Check, Crown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

interface PremiumModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const features = [
  'Полные AI-отчёты по каждому матчу',
  'История всех прогнозов в профиле',
  'Расширенная статистика по картам',
  'Приоритетная генерация прогнозов',
  'Экспорт отчётов',
]

export function PremiumModal({ open, onOpenChange }: PremiumModalProps) {
  const { user, upgradeToPremium } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleWaitlist = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await api.joinPremiumWaitlist(email.trim())
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить в список')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      await upgradeToPremium()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка оформления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <Crown className="h-6 w-6 text-primary" />
            <DialogTitle>Esports Predictor Premium</DialogTitle>
          </div>
          <DialogDescription>
            Разблокируйте полный потенциал аналитической системы.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 my-4">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="text-center py-4 border border-primary/30 rounded-xl bg-primary/5">
          <p className="text-3xl font-black text-gradient-primary">990 ₽</p>
          <p className="text-sm text-muted-foreground">в месяц</p>
        </div>

        {user?.isPremium ? (
          <p className="text-center text-primary font-medium">
            У вас уже активна Premium-подписка
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Список ожидания — узнайте о запуске первым
              </p>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            {message && <p className="text-sm text-primary text-center">{message}</p>}
            <Button className="w-full" onClick={handleWaitlist} disabled={loading}>
              {loading ? 'Отправка...' : 'Хочу Premium первым!'}
            </Button>
            {user && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleUpgrade}
                disabled={loading}
              >
                <Crown className="h-4 w-4" />
                Оформить Premium (демо)
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
