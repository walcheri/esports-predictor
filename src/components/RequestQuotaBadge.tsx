import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types'

export function RequestQuotaBadge({ user }: { user: User }) {
  const remaining = user.requestsRemaining ?? 0
  const limit = user.requestsLimit ?? 1
  const exhausted = remaining <= 0

  return (
    <Badge
      variant="secondary"
      className={`gap-1 tabular-nums ${exhausted ? 'border-destructive/50 text-destructive' : ''}`}
      title={`Использовано ${user.requestsUsed ?? 0} из ${limit}`}
    >
      <Sparkles className="h-3 w-3" />
      {remaining} / {limit}
    </Badge>
  )
}
