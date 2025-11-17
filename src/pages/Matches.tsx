import { useState } from "react";
import { Header } from "@/components/Header";
import { MatchCard } from "@/components/MatchCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// Mock data for demonstration
const mockMatches = [
  {
    id: "1",
    team1: { name: "Natus Vincere", logo: "" },
    team2: { name: "FaZe Clan", logo: "" },
    tournament: "IEM Katowice 2025",
    startTime: "Сегодня, 18:00",
    status: "upcoming" as const,
    game: "CS2",
  },
  {
    id: "2",
    team1: { name: "Team Spirit", logo: "" },
    team2: { name: "OG", logo: "" },
    tournament: "The International 2025",
    startTime: "Сегодня, 20:30",
    status: "live" as const,
    game: "Dota 2",
  },
  {
    id: "3",
    team1: { name: "T1", logo: "" },
    team2: { name: "Gen.G", logo: "" },
    tournament: "LCK Spring 2025",
    startTime: "Завтра, 14:00",
    status: "upcoming" as const,
    game: "LoL",
  },
  {
    id: "4",
    team1: { name: "Sentinels", logo: "" },
    team2: { name: "Cloud9", logo: "" },
    tournament: "VCT Americas",
    startTime: "Сегодня, 22:00",
    status: "upcoming" as const,
    game: "Valorant",
  },
];

export default function Matches() {
  const [game, setGame] = useState<string>("all");
  const [date, setDate] = useState<string>("today");
  const [status, setStatus] = useState<string>("all");
  const [isLoading] = useState(false);

  const filteredMatches = mockMatches.filter((match) => {
    if (game !== "all" && match.game !== game) return false;
    if (status !== "all" && match.status !== status) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4">
        <div className="container mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-black">
            Прогнозируй матчи{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              с ИИ
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Анализ статистики команд и ИИ-прогнозирование результатов киберспортивных матчей
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="pb-8 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={game} onValueChange={setGame}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите игру" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все игры</SelectItem>
                <SelectItem value="CS2">CS2</SelectItem>
                <SelectItem value="Dota 2">Dota 2</SelectItem>
                <SelectItem value="LoL">League of Legends</SelectItem>
                <SelectItem value="Valorant">Valorant</SelectItem>
              </SelectContent>
            </Select>

            <Select value={date} onValueChange={setDate}>
              <SelectTrigger>
                <SelectValue placeholder="Дата" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="tomorrow">Завтра</SelectItem>
                <SelectItem value="week">На этой неделе</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все матчи</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Matches Grid */}
      <section className="pb-16 px-4">
        <div className="container mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-[350px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredMatches.map((match) => (
                <MatchCard key={match.id} {...match} />
              ))}
            </div>
          )}

          {!isLoading && filteredMatches.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-muted-foreground">
                Нет матчей по выбранным фильтрам
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>Прогнозы носят развлекательный характер</p>
        </div>
      </footer>
    </div>
  );
}
