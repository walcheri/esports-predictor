import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Match() {
  const { id } = useParams();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [prediction, setPrediction] = useState<{
    team1Probability: number;
    team2Probability: number;
    analysis: string;
  } | null>(null);

  useEffect(() => {
    fetchMatchDetails();
  }, [id]);

  const fetchMatchDetails = async () => {
    setIsLoadingMatch(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-match-details', {
        body: { matchId: id },
      });

      if (error) {
        console.error('Error fetching match details:', error);
        toast.error('Не удалось загрузить детали матча');
      } else {
        setMatchData(data);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ошибка при загрузке матча');
    } finally {
      setIsLoadingMatch(false);
    }
  };

  const handleGeneratePrediction = async () => {
    if (!matchData) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-prediction', {
        body: { matchData },
      });

      if (error) {
        console.error('Error generating prediction:', error);
        toast.error('Не удалось сгенерировать прогноз');
      } else {
        setPrediction(data);
        toast.success('Прогноз успешно сгенерирован!');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ошибка при генерации прогноза');
    } finally {
      setIsGenerating(false);
    }
  };

  const chartData = prediction
    ? [
        { name: matchData?.team1?.name || "Team 1", value: prediction.team1Probability, color: "#00FFAA" },
        { name: matchData?.team2?.name || "Team 2", value: prediction.team2Probability, color: "#404040" },
      ]
    : [];

  if (isLoadingMatch) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-96 mb-8" />
            <Skeleton className="h-64 mb-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 pb-16 px-4">
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="text-2xl font-bold mb-4">Матч не найден</h2>
            <Link to="/" className="text-primary hover:underline">
              Вернуться к списку матчей
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к матчам
          </Link>

          {/* Match Header */}
          <Card className="p-6 md:p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <Badge className={matchData.status === "live" ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-primary/20 text-primary border-primary/50"}>
                {matchData.status === "live" ? "Live" : "Upcoming"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {matchData.game}
              </span>
            </div>

            <div className="flex items-center justify-between gap-8">
              <div className="flex-1 text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {matchData.team1.logo ? (
                    <img src={matchData.team1.logo} alt={matchData.team1.name} className="w-16 h-16 object-contain" />
                  ) : (
                    <span className="text-3xl md:text-4xl font-bold text-primary">
                      {matchData.team1.name[0]}
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold">{matchData.team1.name}</h2>
              </div>

              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-muted-foreground mb-2">VS</div>
                <p className="text-sm text-muted-foreground">{matchData.startTime}</p>
              </div>

              <div className="flex-1 text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {matchData.team2.logo ? (
                    <img src={matchData.team2.logo} alt={matchData.team2.name} className="w-16 h-16 object-contain" />
                  ) : (
                    <span className="text-3xl md:text-4xl font-bold text-primary">
                      {matchData.team2.name[0]}
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold">{matchData.team2.name}</h2>
              </div>
            </div>

            <p className="text-center mt-6 text-muted-foreground">{matchData.tournament}</p>
          </Card>

          {/* Head-to-Head - Скрываем пока нет данных */}
          
          {/* Recent Matches */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">
                Последние матчи {matchData.team1.name}
              </h3>
              <div className="space-y-3">
                {matchData.team1Recent.map((match: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{match.opponent}</p>
                      <p className="text-xs text-muted-foreground">{match.date}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={match.result === "win" ? "default" : "destructive"}
                        className={
                          match.result === "win"
                            ? "bg-primary/20 text-primary border-primary/50"
                            : ""
                        }
                      >
                        {match.result === "win" ? "Победа" : "Поражение"}
                      </Badge>
                      <p className="text-sm mt-1">{match.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">
                Последние матчи {matchData.team2.name}
              </h3>
              <div className="space-y-3">
                {matchData.team2Recent.map((match: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{match.opponent}</p>
                      <p className="text-xs text-muted-foreground">{match.date}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={match.result === "win" ? "default" : "destructive"}
                        className={
                          match.result === "win"
                            ? "bg-primary/20 text-primary border-primary/50"
                            : ""
                        }
                      >
                        {match.result === "win" ? "Победа" : "Поражение"}
                      </Badge>
                      <p className="text-sm mt-1">{match.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Prediction Section */}
          <Card className="p-6 md:p-8">
            <h3 className="text-2xl font-bold mb-6 text-center">ИИ-прогноз</h3>

            {!prediction ? (
              <div className="text-center py-8">
                <Button
                  size="lg"
                  onClick={handleGeneratePrediction}
                  disabled={isGenerating}
                  className="px-8"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Генерация прогноза...
                    </>
                  ) : (
                    "Сгенерировать ИИ-прогноз"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Pie Chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Analysis Text */}
                <div className="prose prose-invert max-w-none">
                  <div className="bg-muted/50 rounded-lg p-6">
                    <h4 className="text-lg font-bold mb-4">Анализ матча</h4>
                    {prediction.analysis.split('\n\n').map((paragraph, i) => (
                      <p key={i} className="text-foreground mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>Прогнозы носят развлекательный характер</p>
        </div>
      </footer>
    </div>
  );
}
