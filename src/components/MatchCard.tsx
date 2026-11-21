import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowRight, Circle, HelpCircle } from "lucide-react";

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
  isQualifier?: boolean;
}

// Helper to detect if team is a qualifier/unknown team
const isQualifierTeam = (name: string | null | undefined): boolean => {
  if (!name) return true;
  const lowerName = name.toLowerCase().trim();
  return (
    lowerName === "team 1" ||
    lowerName === "team 2" ||
    lowerName === "team a" ||
    lowerName === "team b" ||
    lowerName === "qualifier" ||
    lowerName === "tbd" ||
    lowerName === "tba" ||
    lowerName === "to be determined" ||
    lowerName === "to be announced" ||
    lowerName.startsWith("qualifier team") ||
    lowerName.includes("winner of") ||
    lowerName.includes("loser of")
  );
};

// Get display name for qualifier team
const getQualifierDisplayName = (name: string | null | undefined, position: "A" | "B"): string => {
  if (!name || isQualifierTeam(name)) {
    return `Qualifier Team ${position}`;
  }
  return name;
};

// Qualifier team placeholder component
const QualifierTeamLogo = ({ letter }: { letter: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50 cursor-help">
          <div className="relative">
            <HelpCircle className="w-8 h-8 text-muted-foreground/50" />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary/20 text-primary text-xs font-bold rounded-full flex items-center justify-center border border-primary/30">
              {letter}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="text-xs">Данные ограничены — это закрытый квалификатор</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const MatchCard = ({
  id,
  team1,
  team2,
  tournament,
  startTime,
  status,
  game,
  isQualifier: isQualifierProp,
}: MatchCardProps) => {
  const team1IsQualifier = isQualifierTeam(team1.name);
  const team2IsQualifier = isQualifierTeam(team2.name);
  const hasAnyQualifier = team1IsQualifier || team2IsQualifier || isQualifierProp;

  const team1DisplayName = getQualifierDisplayName(team1.name, "A");
  const team2DisplayName = getQualifierDisplayName(team2.name, "B");

  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-all duration-300 group">
      <div className="p-6 space-y-4">
        {/* Status and Game */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            {hasAnyQualifier && (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                Квалификация
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {game}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex flex-col items-center gap-2">
            {team1IsQualifier ? (
              <QualifierTeamLogo letter="A" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {team1.logo ? (
                  <img src={team1.logo} alt={team1.name} className="w-12 h-12 object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    {team1.name?.[0] || "?"}
                  </span>
                )}
              </div>
            )}
            <span className={`text-sm font-semibold text-center line-clamp-1 ${team1IsQualifier ? 'text-muted-foreground italic' : ''}`}>
              {team1DisplayName}
            </span>
          </div>

          <div className="text-2xl font-bold text-muted-foreground">VS</div>

          <div className="flex-1 flex flex-col items-center gap-2">
            {team2IsQualifier ? (
              <QualifierTeamLogo letter="B" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {team2.logo ? (
                  <img src={team2.logo} alt={team2.name} className="w-12 h-12 object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    {team2.name?.[0] || "?"}
                  </span>
                )}
              </div>
            )}
            <span className={`text-sm font-semibold text-center line-clamp-1 ${team2IsQualifier ? 'text-muted-foreground italic' : ''}`}>
              {team2DisplayName}
            </span>
          </div>
        </div>

        {/* Tournament and Time */}
        <div className="space-y-2 pt-2 border-t border-border">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground line-clamp-2 cursor-help hover:text-muted-foreground/80 transition-colors">
                  {tournament}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px]">
                <p className="text-xs">{tournament}</p>
                {hasAnyQualifier && (
                  <p className="text-xs text-yellow-400 mt-1">Закрытый квалификатор — участники определяются</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
