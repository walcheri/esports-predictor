import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Team } from '@/types'

function RosterColumn({ team }: { team: Team }) {
  const players = team.players ?? []
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-4">Состав {team.name}</h3>
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">Состав недоступен</p>
      ) : (
        <div className="space-y-3">
          {players.map((p) => (
            <div
              key={p.id ?? p.name}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              {p.imageUrl ? (
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                  {(p.name ?? '?')[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                {p.role && <p className="text-xs text-muted-foreground">{p.role}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function MatchRosters({
  teamA,
  teamB,
  isQualification,
}: {
  teamA: Team
  teamB: Team
  isQualification?: boolean
}) {
  const hasPlayers =
    (teamA.players?.length ?? 0) > 0 || (teamB.players?.length ?? 0) > 0

  if (!hasPlayers && isQualification) {
    return (
      <Card className="p-6">
        <CardHeader className="p-0 pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Составы
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <p className="text-sm text-muted-foreground text-center">
            Составы недоступны в квалификации — данные ограничены
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!hasPlayers) return null

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6">
        <RosterColumn team={teamA} />
        <RosterColumn team={teamB} />
      </div>
    </div>
  )
}
