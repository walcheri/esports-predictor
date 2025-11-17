import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Circle } from "lucide-react";

interface MatchCardProps {
  id: string;
  team1: {
    name: string;
    logo: string;
  };
  team2: {
    name: string;
    logo: string;
  };
  tournament: string;
  startTime: string;
  status: "live" | "upcoming";
  game: string;
}

export const MatchCard = ({
  id,
  team1,
  team2,
  tournament,
  startTime,
  status,
  game,
}: MatchCardProps) => {
  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-all duration-300 group">
      <div className="p-6 space-y-4">
        {/* Status and Game */}
        <div className="flex items-center justify-between">
          <Badge
            variant={status === "live" ? "destructive" : "default"}
            className={
              status === "live"
                ? "bg-red-500/20 text-red-400 border-red-500/50"
                : "bg-primary/20 text-primary border-primary/50"
            }
          >
            {status === "live" && <Circle className="w-2 h-2 mr-1 fill-current animate-pulse" />}
            {status === "live" ? "Live" : "Upcoming"}
          </Badge>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {game}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {team1.logo ? (
                <img src={team1.logo} alt={team1.name} className="w-12 h-12 object-contain" />
              ) : (
                <span className="text-2xl font-bold text-primary">{team1.name[0]}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-center line-clamp-1">{team1.name}</span>
          </div>

          <div className="text-2xl font-bold text-muted-foreground">VS</div>

          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {team2.logo ? (
                <img src={team2.logo} alt={team2.name} className="w-12 h-12 object-contain" />
              ) : (
                <span className="text-2xl font-bold text-primary">{team2.name[0]}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-center line-clamp-1">{team2.name}</span>
          </div>
        </div>

        {/* Tournament and Time */}
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground line-clamp-1">{tournament}</p>
          <p className="text-sm font-medium">{startTime}</p>
        </div>

        {/* Action Button */}
        <Link to={`/match/${id}`} className="block">
          <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            Анализировать
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </Card>
  );
};
