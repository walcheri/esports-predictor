import { useState } from "react";
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

// Mock data
const mockMatchData = {
  id: "1",
  team1: { name: "Natus Vincere", logo: "" },
  team2: { name: "FaZe Clan", logo: "" },
  tournament: "IEM Katowice 2025",
  game: "CS2",
  map: "de_dust2",
  status: "upcoming" as "live" | "upcoming",
  startTime: "Сегодня, 18:00",
};

const mockH2H = [
  { date: "15.01.25", tournament: "IEM Cologne", winner: "Natus Vincere", score: "16-12" },
  { date: "10.01.25", tournament: "BLAST Premier", winner: "FaZe Clan", score: "16-14" },
  { date: "05.01.25", tournament: "ESL Pro League", winner: "Natus Vincere", score: "16-9" },
  { date: "28.12.24", tournament: "IEM Katowice", winner: "FaZe Clan", score: "16-11" },
  { date: "20.12.24", tournament: "BLAST Premier", winner: "Natus Vincere", score: "16-7" },
];

const mockTeam1Recent = [
  { date: "18.01.25", opponent: "Vitality", result: "win", score: "16-10" },
  { date: "17.01.25", opponent: "G2", result: "win", score: "16-13" },
  { date: "15.01.25", opponent: "FaZe", result: "win", score: "16-12" },
  { date: "14.01.25", opponent: "Heroic", result: "loss", score: "14-16" },
  { date: "12.01.25", opponent: "MOUZ", result: "win", score: "16-8" },
];

const mockTeam2Recent = [
  { date: "18.01.25", opponent: "Astralis", result: "win", score: "16-11" },
  { date: "16.01.25", opponent: "Liquid", result: "win", score: "16-9" },
  { date: "15.01.25", opponent: "NaVi", result: "loss", score: "12-16" },
  { date: "13.01.25", opponent: "Spirit", result: "win", score: "16-14" },
  { date: "11.01.25", opponent: "Complexity", result: "loss", score: "13-16" },
];

export default function Match() {
  const { id } = useParams();
  const [isGenerating, setIsGenerating] = useState(false);
  const [prediction, setPrediction] = useState<{
    team1Probability: number;
    team2Probability: number;
    analysis: string;
  } | null>(null);

  const handleGeneratePrediction = async () => {
    setIsGenerating(true);
    // Simulate API call
    setTimeout(() => {
      setPrediction({
        team1Probability: 62,
        team2Probability: 38,
        analysis: `На основе анализа последних встреч и текущей формы команд, Natus Vincere имеют преимущество в предстоящем матче. 

Команда показывает стабильные результаты на карте de_dust2 с winrate 68% за последний месяц. В прямых встречах с FaZe Clan соотношение побед 6:4 в пользу NaVi.

FaZe Clan, несмотря на недавнюю победу над Astralis, демонстрируют менее стабильную игру на этой карте. Однако их агрессивный стиль игры может создать проблемы для защиты NaVi.

Ключевым фактором станет игра в середине раунда и контроль центральной части карты.`,
      });
      setIsGenerating(false);
    }, 3000);
  };

  const chartData = prediction
    ? [
        { name: mockMatchData.team1.name, value: prediction.team1Probability, color: "#00FFAA" },
        { name: mockMatchData.team2.name, value: prediction.team2Probability, color: "#404040" },
      ]
    : [];

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
              <Badge className={mockMatchData.status === "live" ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-primary/20 text-primary border-primary/50"}>
                {mockMatchData.status === "live" ? "Live" : "Upcoming"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {mockMatchData.game} • {mockMatchData.map}
              </span>
            </div>

            <div className="flex items-center justify-between gap-8">
              <div className="flex-1 text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-3xl md:text-4xl font-bold text-primary">
                    {mockMatchData.team1.name[0]}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold">{mockMatchData.team1.name}</h2>
              </div>

              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-muted-foreground mb-2">VS</div>
                <p className="text-sm text-muted-foreground">{mockMatchData.startTime}</p>
              </div>

              <div className="flex-1 text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-3xl md:text-4xl font-bold text-primary">
                    {mockMatchData.team2.name[0]}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold">{mockMatchData.team2.name}</h2>
              </div>
            </div>

            <p className="text-center mt-6 text-muted-foreground">{mockMatchData.tournament}</p>
          </Card>

          {/* Head-to-Head */}
          <Card className="p-6 mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Head-to-Head (Последние 10 встреч)
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Турнир</TableHead>
                    <TableHead>Победитель</TableHead>
                    <TableHead>Счет</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockH2H.map((match, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{match.date}</TableCell>
                      <TableCell className="text-muted-foreground">{match.tournament}</TableCell>
                      <TableCell className="font-semibold">{match.winner}</TableCell>
                      <TableCell>{match.score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Recent Matches */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">
                Последние матчи {mockMatchData.team1.name}
              </h3>
              <div className="space-y-3">
                {mockTeam1Recent.map((match, i) => (
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
                Последние матчи {mockMatchData.team2.name}
              </h3>
              <div className="space-y-3">
                {mockTeam2Recent.map((match, i) => (
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
