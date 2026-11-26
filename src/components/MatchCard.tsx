import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type DisplayMatch, displayTime, statusLabel } from "@/lib/catalogue";
export const MatchCard = ({ match: m }: { match: DisplayMatch }) => (
  <Card className="p-6 space-y-4 hover:border-primary/50">
    <div className="flex justify-between gap-2">
      <Badge>{statusLabel[m.status]}</Badge>
      <span>{m.game.toUpperCase()}</span>
    </div>
    <h2 className="text-xl font-bold break-words">
      {m.team1?.name ?? "Участник не подтверждён"} —{" "}
      {m.team2?.name ?? "Участник не подтверждён"}
    </h2>
    <p>
      {m.tournament ?? "Турнир не подтверждён"} ·{" "}
      {m.bestOf ? `BO${m.bestOf}` : "Формат не подтверждён"}
    </p>
    <p className="text-sm text-muted-foreground">{displayTime(m.startsAt)}</p>
    <Link
      className="text-primary underline"
      to={`/match/${encodeURIComponent(m.id)}`}
    >
      Данные матча →
    </Link>
  </Card>
);
