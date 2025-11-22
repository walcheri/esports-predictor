import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const gameNames: Record<string, string> = {
  cs2: "Counter-Strike 2",
  dota2: "Dota 2",
  lol: "League of Legends",
  valorant: "Valorant",
  all: "Все игры",
};

export default function Matches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameParam = searchParams.get("game") || "all";
  
  const [game, setGame] = useState<string>(gameParam);
  const [date, setDate] = useState<string>("48h");
  const [status, setStatus] = useState<string>("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    setGame(gameParam);
  }, [gameParam]);

  const handleGameChange = (value: string) => {
    setGame(value);
    if (value === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ game: value });
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [game, date, status]);

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-matches', {
        body: { game, date, status },
      });

      if (error) {
        console.error('Error fetching matches:', error);
        toast.error('Не удалось загрузить матчи');
        setMatches([]);
      } else {
        setMatches(data?.matches || []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ошибка при загрузке матчей');
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Header with Back Button */}
      <section className="pt-32 pb-8 px-4">
        <div className="container mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к выбору игры
          </Button>
          <h1 className="text-3xl md:text-5xl font-black">
            {gameNames[game] || "Все игры"}
          </h1>
          <p className="text-muted-foreground mt-2">
            Предстоящие матчи и Live-игры
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="pb-8 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={game} onValueChange={handleGameChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите игру" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все игры</SelectItem>
                <SelectItem value="cs2">Counter-Strike 2</SelectItem>
                <SelectItem value="dota2">Dota 2</SelectItem>
                <SelectItem value="lol">League of Legends</SelectItem>
                <SelectItem value="valorant">Valorant</SelectItem>
              </SelectContent>
            </Select>

            <Select value={date} onValueChange={setDate}>
              <SelectTrigger>
                <SelectValue placeholder="Дата" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="48h">Ближайшие 48 часов</SelectItem>
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
              {matches.map((match) => (
                <MatchCard key={match.id} {...match} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {matches.map((match) => (
                <MatchCard key={match.id} {...match} />
              ))}
            </div>
          )}

          {!isLoading && matches.length === 0 && (
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
