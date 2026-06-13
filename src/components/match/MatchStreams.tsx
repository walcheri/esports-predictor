import { ExternalLink, Radio } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Match } from '@/types'

export function MatchStreams({ match }: { match: Match }) {
  const streams = match.streams ?? []
  if (streams.length === 0 && !match.officialStreamUrl && !match.liveUrl) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Трансляции
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {match.officialStreamUrl && (
          <a
            href={match.officialStreamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Официальная трансляция
          </a>
        )}
        {match.liveUrl && (
          <a
            href={match.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            Live-страница
          </a>
        )}
        {streams.map((s, i) => (
          <a
            key={i}
            href={s.rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:border-primary/50 transition-all duration-300"
          >
            <span className="font-medium uppercase">{s.language}</span>
            <div className="flex items-center gap-2">
              {s.main && <Badge variant="default">Основная</Badge>}
              {s.official && <Badge variant="upcoming">Официальная</Badge>}
              <ExternalLink className="h-4 w-4 text-primary" />
            </div>
          </a>
        ))}
      </CardContent>
    </Card>
  )
}
