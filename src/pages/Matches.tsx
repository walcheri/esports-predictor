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
  const tournamentParam = searchParams.get("tournament") || "all";
  
  const [game, setGame] = useState<string>(gameParam);
  const [tournament, setTournament] = useState<string>(tournamentParam);
  const [date, setDate] = useState<string>("week");
  const [status, setStatus] = useState<string>("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [matches, setMatches] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const matchesPerPage = 24;

  useEffect(() => {
    setGame(gameParam);
    setTournament(tournamentParam);
  }, [gameParam, tournamentParam]);

  const handleGameChange = (value: string) => {
    setGame(value);
    setTournament("all");
    setCurrentPage(1);
    const newParams: Record<string, string> = {};
    if (value !== "all") {
      newParams.game = value;
    }
    setSearchParams(newParams);
  };

  const handleTournamentChange = (value: string) => {
    setTournament(value);
    setCurrentPage(1);
    const newParams: Record<string, string> = {};
    if (game !== "all") {
      newParams.game = game;
    }
    if (value !== "all") {
      newParams.tournament = value;
    }
    setSearchParams(newParams);
  };

  useEffect(() => {
    fetchTournaments();
  }, [game]);

  useEffect(() => {
    fetchMatches();
  }, [game, date, status, tournament]);

  const fetchTournaments = async () => {
    if (!game || game === "all") {
      setTournaments([]);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('fetch-tournaments', {
        body: { game },
      });

      if (error) {
        console.error('Error fetching tournaments:', error);
        setTournaments([]);
      } else {
        setTournaments(data?.tournaments || []);
      }
    } catch (error) {
      console.error('Error:', error);
      setTournaments([]);
    }
  };

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-matches', {
        body: { 
          game, 
          date, 
          status,
          leagueId: tournament !== "all" ? tournament : null,
        },
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

  // Pagination logic
  const indexOfLastMatch = currentPage * matchesPerPage;
  const indexOfFirstMatch = indexOfLastMatch - matchesPerPage;
  const currentMatches = matches.slice(indexOfFirstMatch, indexOfLastMatch);
  const totalPages = Math.ceil(matches.length / matchesPerPage);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            {matches.length > 0 && `${matches.length} матчей найдено`}
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="pb-8 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <Select 
              value={tournament} 
              onValueChange={handleTournamentChange}
              disabled={game === "all" || tournaments.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={game === "all" ? "Выберите игру" : "Выберите турнир"} />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="all">Все турниры</SelectItem>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={date} onValueChange={setDate}>
              <SelectTrigger>
                <SelectValue placeholder="Дата" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">7 дней</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="tomorrow">Завтра</SelectItem>
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
      <section className="pb-8 px-4">
        <div className="container mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[200px] rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {currentMatches.map((match) => (
                  <MatchCard key={match.id} {...match} />
                ))}
              </div>

              {!isLoading && matches.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-xl text-muted-foreground">
                    Нет матчей по выбранным фильтрам
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-12">
                  <Button
                    variant="outline"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Назад
                  </Button>
                  
                  <div className="flex gap-2">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          onClick={() => paginate(pageNum)}
                          className="w-10 h-10 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Вперёд
                  </Button>
                </div>
              )}
            </>
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
