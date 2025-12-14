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
import { ArrowLeft, Loader2, TrendingUp, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cell, Pie, PieChart, ResponsiveContainer, Legend, Bar, BarChart, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { useSavePrediction } from "@/hooks/usePredictions";

export default function Match() {
  const { id } = useParams();
  const { user } = useAuth();
  const savePrediction = useSavePrediction();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  const [predictionSaved, setPredictionSaved] = useState(false);
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
    setPredictionSaved(false);
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
        
        // Auto-save prediction if user is logged in
        if (user && id) {
          try {
            await savePrediction.mutateAsync({
              match_id: id,
              team_a: matchData.team1?.name || "Team 1",
              team_b: matchData.team2?.name || "Team 2",
              game: matchData.game || "unknown",
              tournament: matchData.tournament || null,
              predicted_winner: data.team1Probability > data.team2Probability 
                ? matchData.team1?.name 
                : matchData.team2?.name,
              ai_probability_a: String(data.team1Probability),
              ai_probability_b: String(data.team2Probability),
              report_preview: data.analysis?.substring(0, 200) || null,
              full_report: data.analysis || null,
            });
            setPredictionSaved(true);
            toast.success('Прогноз сохранён в профиле!', {
              icon: <Save className="w-4 h-4" />,
            });
          } catch (saveError) {
            console.error('Error saving prediction:', saveError);
            // Don't show error - saving is optional
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ошибка при генерации прогноза');
    } finally {
      setIsGenerating(false);
    }
  };

  // Determine winner/loser colors based on probability
  const chartData = prediction
    ? [
        { 
          name: matchData?.team1?.name || "Team 1", 
          value: prediction.team1Probability, 
          color: prediction.team1Probability >= prediction.team2Probability ? "#00FFAA" : "#FF4D6B" 
        },
        { 
          name: matchData?.team2?.name || "Team 2", 
          value: prediction.team2Probability, 
          color: prediction.team2Probability > prediction.team1Probability ? "#00FFAA" : "#FF4D6B" 
        },
      ]
    : [];

  // Custom tooltip for dark theme
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-foreground font-medium">{`${payload[0].name}: ${payload[0].value}%`}</p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-foreground font-medium">{label}</p>
          <p className="text-primary">{`Winrate: ${payload[0].value}%`}</p>
        </div>
      );
    }
    return null;
  };

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

            <div className="flex items-center justify-center gap-4 mt-6">
              <p className="text-muted-foreground">{matchData.tournament}</p>
              {matchData.streamUrl && (
                <a 
                  href={matchData.streamUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/50 rounded-lg hover:bg-red-600/30 transition-colors"
                >
                  <TrendingUp className="h-4 w-4" />
                  Смотреть стрим
                </a>
              )}
            </div>
          </Card>

          {/* Team Lineups */}
          {matchData.team1.players?.length > 0 || matchData.team2.players?.length > 0 ? (
            <div className="mb-8">
              {/* GRID Badge */}
              {matchData.rostersSource === 'grid' && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Badge className="bg-primary/20 text-primary border-primary/50">
                    🎮 Официальные данные GRID
                  </Badge>
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4">Состав {matchData.team1.name}</h3>
                  <div className="space-y-3">
                    {matchData.team1.players?.length > 0 ? (
                      matchData.team1.players.map((player: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          {player.image && (
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                              <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">{player.role}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Состав недоступен</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4">Состав {matchData.team2.name}</h3>
                  <div className="space-y-3">
                    {matchData.team2.players?.length > 0 ? (
                      matchData.team2.players.map((player: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          {player.image && (
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                              <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">{player.role}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Состав недоступен</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="p-6 mb-8">
              <p className="text-sm text-muted-foreground text-center">
                Составы недоступны в квалификации — данные ограничены
              </p>
            </Card>
          )}

          {/* Head-to-Head */}
          {matchData.headToHead?.matches?.length > 0 && (
            <Card className="p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Head-to-Head (последние 6 месяцев)</h3>
                <Badge variant="outline" className="text-lg">
                  {matchData.headToHead.team1Wins} - {matchData.headToHead.team2Wins}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Победитель</TableHead>
                    <TableHead>Счёт</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchData.headToHead.matches.map((match: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{match.date}</TableCell>
                      <TableCell className="font-medium">{match.winner}</TableCell>
                      <TableCell>{match.score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Map Winrates */}
          {matchData.mapWinrates && (
            <Card className="p-6 mb-8">
              <h3 className="text-lg font-bold mb-4">Winrate на текущей карте (последние 3 месяца)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { team: matchData.team1.name, winrate: matchData.mapWinrates.team1 },
                    { team: matchData.team2.name, winrate: matchData.mapWinrates.team2 },
                  ]}>
                    <XAxis dataKey="team" stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="winrate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{matchData.team1.name}</p>
                  <p className="text-2xl font-bold text-primary">{matchData.mapWinrates.team1}%</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{matchData.team2.name}</p>
                  <p className="text-2xl font-bold text-primary">{matchData.mapWinrates.team2}%</p>
                </div>
              </div>
            </Card>
          )}
          
          {/* Form Chart */}
          <Card className="p-6 mb-8">
            <h3 className="text-lg font-bold mb-4">Форма команд (последние 5 матчей)</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-muted-foreground mb-3">{matchData.team1.name}</p>
                <div className="flex gap-2">
                  {matchData.team1Recent.map((match: any, i: number) => (
                    <div
                      key={i}
                      className={`flex-1 h-16 rounded-lg flex items-center justify-center font-bold text-lg ${
                        match.result === "win"
                          ? "bg-primary/20 text-primary border-2 border-primary/50"
                          : "bg-destructive/20 text-destructive border-2 border-destructive/50"
                      }`}
                    >
                      {match.result === "win" ? "W" : "L"}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-3">{matchData.team2.name}</p>
                <div className="flex gap-2">
                  {matchData.team2Recent.map((match: any, i: number) => (
                    <div
                      key={i}
                      className={`flex-1 h-16 rounded-lg flex items-center justify-center font-bold text-lg ${
                        match.result === "win"
                          ? "bg-primary/20 text-primary border-2 border-primary/50"
                          : "bg-destructive/20 text-destructive border-2 border-destructive/50"
                      }`}
                    >
                      {match.result === "win" ? "W" : "L"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Matches Details */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">
                Детали матчей {matchData.team1.name}
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
                        {match.result === "win" ? "W" : "L"}
                      </Badge>
                      <p className="text-sm mt-1">{match.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">
                Детали матчей {matchData.team2.name}
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
                        {match.result === "win" ? "W" : "L"}
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
                        labelLine={true}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={110}
                        innerRadius={60}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="hsl(var(--border))"
                        strokeWidth={2}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend 
                        formatter={(value) => <span className="text-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Analysis Text */}
                <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-b from-card to-background overflow-hidden shadow-[0_0_30px_hsla(162,100%,50%,0.1)]">
                  <div className="p-4 md:p-6 border-b border-primary/20 bg-primary/5">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Подробный анализ матча
                    </h4>
                  </div>
                  <ScrollArea className="h-[70vh]">
                    <div className="p-6 md:p-8 premium-report">
                      <ReactMarkdown>{prediction.analysis}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                  
                  <div className="p-6 md:p-8 border-t border-border">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-primary/10 rounded-lg p-4 border border-primary/30">
                        <p className="text-sm text-muted-foreground mb-1">Вероятность победы</p>
                        <p className="text-2xl font-bold text-primary">{matchData.team1.name}</p>
                        <p className="text-4xl font-black text-primary mt-2">{prediction.team1Probability}%</p>
                      </div>
                      <div className="bg-muted rounded-lg p-4 border border-border">
                        <p className="text-sm text-muted-foreground mb-1">Вероятность победы</p>
                        <p className="text-2xl font-bold">{matchData.team2.name}</p>
                        <p className="text-4xl font-black mt-2">{prediction.team2Probability}%</p>
                      </div>
                    </div>
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
