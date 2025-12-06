import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { usePredictions, usePredictionStats } from "@/hooks/usePredictions";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { History, BarChart3, Settings, ExternalLink, LogOut, Loader2, CheckCircle, AlertTriangle, Mail } from "lucide-react";
import { PremiumButton } from "@/components/PremiumButton";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "@/hooks/use-toast";

const GAME_COLORS: Record<string, string> = {
  csgo: "#DE9B35",
  cs2: "#DE9B35",
  dota2: "#F04747",
  lol: "#1E96FF",
  valorant: "#FF4654",
  unknown: "#888888",
};

const GAME_NAMES: Record<string, string> = {
  csgo: "Counter-Strike 2",
  cs2: "Counter-Strike 2",
  dota2: "Dota 2",
  lol: "League of Legends",
  valorant: "Valorant",
};

export default function Profile() {
  const { user, profile, loading: authLoading, signOut, isEmailConfirmed, resendConfirmationEmail } = useAuth();
  const navigate = useNavigate();
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleResendConfirmation = async () => {
    setResendingEmail(true);
    try {
      const { error } = await resendConfirmationEmail();
      if (error) {
        toast({
          title: "Ошибка",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Письмо отправлено!",
          description: "Проверьте почту для подтверждения email",
        });
      }
    } finally {
      setResendingEmail(false);
    }
  };
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "history");
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const { data: predictions, isLoading: predictionsLoading } = usePredictions(ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const { data: stats, isLoading: statsLoading } = usePredictionStats();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["history", "stats", "settings"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = profile?.email?.substring(0, 2).toUpperCase() || user.email?.substring(0, 2).toUpperCase() || "U";

  // Prepare chart data
  const gameChartData = stats
    ? Object.entries(stats.gameStats).map(([game, count]) => ({
        name: GAME_NAMES[game] || game,
        value: count,
        color: GAME_COLORS[game] || GAME_COLORS.unknown,
      }))
    : [];

  const dailyChartData = stats
    ? Object.entries(stats.dailyPredictions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({
          date: format(new Date(date), "dd.MM", { locale: ru }),
          predictions: count,
        }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-28 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Email Verification Banner */}
          {!isEmailConfirmed && (
            <Card className="p-4 mb-6 bg-amber-500/10 border-amber-500/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-amber-500">Email не подтверждён</h3>
                    <p className="text-sm text-muted-foreground">
                      Подтвердите email для полного доступа к функциям
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                >
                  {resendingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  Отправить повторно
                </Button>
              </div>
            </Card>
          )}

          {/* Profile Header */}
          <Card className="p-6 mb-6 bg-card border-border">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-primary">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground">
                  {profile?.username || profile?.email || user.email}
                </h1>
                <p className="text-muted-foreground">
                  {stats?.total || 0} прогнозов сделано
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  С нами с {profile?.created_at ? format(new Date(profile.created_at), "d MMMM yyyy", { locale: ru }) : "недавно"}
                </p>
              </div>
              <div className="hidden md:block">
                <PremiumButton />
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-card border border-border mb-6">
              <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <History className="w-4 h-4" />
                История
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="w-4 h-4" />
                Статистика
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Settings className="w-4 h-4" />
                Настройки
              </TabsTrigger>
            </TabsList>

            {/* History Tab */}
            <TabsContent value="history">
              <Card className="p-6 bg-card border-border">
                <h2 className="text-xl font-bold mb-4">История прогнозов</h2>
                
                {predictionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : predictions && predictions.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-3 text-muted-foreground font-medium">Дата</th>
                            <th className="pb-3 text-muted-foreground font-medium">Матч</th>
                            <th className="pb-3 text-muted-foreground font-medium">Игра</th>
                            <th className="pb-3 text-muted-foreground font-medium">Прогноз</th>
                            <th className="pb-3 text-muted-foreground font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {predictions.map((prediction) => (
                            <tr
                              key={prediction.id}
                              className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                            >
                              <td className="py-4 text-sm text-muted-foreground">
                                {format(new Date(prediction.created_at), "dd.MM.yy HH:mm", { locale: ru })}
                              </td>
                              <td className="py-4">
                                <span className="font-medium">{prediction.team_a}</span>
                                <span className="text-muted-foreground mx-2">vs</span>
                                <span className="font-medium">{prediction.team_b}</span>
                              </td>
                              <td className="py-4">
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${GAME_COLORS[prediction.game] || GAME_COLORS.unknown}20`,
                                    color: GAME_COLORS[prediction.game] || GAME_COLORS.unknown,
                                  }}
                                >
                                  {GAME_NAMES[prediction.game] || prediction.game}
                                </span>
                              </td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-primary font-bold">{prediction.ai_probability_a}%</span>
                                  <span className="text-muted-foreground">-</span>
                                  <span className="text-muted-foreground">{prediction.ai_probability_b}%</span>
                                </div>
                              </td>
                              <td className="py-4">
                                <Link to={`/match/${prediction.match_id}`}>
                                  <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary/80">
                                    <ExternalLink className="w-4 h-4" />
                                    Открыть
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        Назад
                      </Button>
                      <span className="flex items-center px-4 text-sm text-muted-foreground">
                        Страница {page + 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={predictions.length < ITEMS_PER_PAGE}
                      >
                        Далее
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>У вас пока нет прогнозов</p>
                    <Link to="/matches">
                      <Button className="mt-4 bg-primary text-primary-foreground">
                        Сделать первый прогноз
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Total Stats */}
                <Card className="p-6 bg-card border-border">
                  <h3 className="text-lg font-bold mb-4">Общая статистика</h3>
                  {statsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  ) : (
                    <div className="text-center">
                      <div className="text-5xl font-bold text-primary mb-2">
                        {stats?.total || 0}
                      </div>
                      <p className="text-muted-foreground">прогнозов сделано</p>
                    </div>
                  )}
                </Card>

                {/* Game Distribution */}
                <Card className="p-6 bg-card border-border">
                  <h3 className="text-lg font-bold mb-4">По играм</h3>
                  {statsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  ) : gameChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={gameChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {gameChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Нет данных</p>
                  )}
                </Card>

                {/* Activity Chart */}
                <Card className="p-6 bg-card border-border md:col-span-2">
                  <h3 className="text-lg font-bold mb-4">Активность за 30 дней</h3>
                  {statsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  ) : dailyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="predictions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Нет данных за последние 30 дней</p>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Card className="p-6 bg-card border-border">
                <h2 className="text-xl font-bold mb-6">Настройки</h2>
                
                <div className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{profile?.email || user.email}</p>
                      <p className="text-sm text-muted-foreground">Аватар обновляется через Google</p>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div>
                      <label className="text-sm text-muted-foreground">Email</label>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.email}</p>
                        {isEmailConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary">
                            <CheckCircle className="w-3 h-3" />
                            Подтверждён
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-500">
                            <AlertTriangle className="w-3 h-3" />
                            Не подтверждён
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">ID пользователя</label>
                      <p className="font-mono text-sm text-muted-foreground">{user.id}</p>
                    </div>
                  </div>

                  {/* Premium Banner */}
                  <PremiumButton variant="profile" />

                  {/* Sign Out */}
                  <div className="pt-4 border-t border-border">
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={signOut}
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти из аккаунта
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
