import { failureMessage } from "@/lib/prediction";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-state";
import { catalogueSchema, type DisplayMatch } from "@/lib/catalogue";
export default function Matches() {
  const [params, setParams] = useSearchParams();
  const game = params.get("game") ?? "all";
  const { user } = useAuth();
  const [date, setDate] = useState("all"),
    [status, setStatus] = useState("upcoming"),
    [tournament, setTournament] = useState("all");
  const [matches, setMatches] = useState<DisplayMatch[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [reload, setReload] = useState(0);
  const userId = user?.id;
  const enabled = import.meta.env.VITE_PREDICTOR_EXTERNAL_ENABLED === "true";
  useEffect(() => {
    let active = true;
    setMatches([]);
    setTournament("all");
    setLoading(false);
    if (!enabled || !userId) {
      setMessage(
        !enabled
          ? "Внешние данные отключены до проверки источников."
          : "Войдите для доступа к каталогу.",
      );
      return;
    }
    setLoading(true);
    setMessage("");
    supabase.functions
      .invoke("fetch-matches", { body: { game, date, status } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const result = catalogueSchema.parse(data);
        setMatches(result.matches);
        setMessage(
          `Частичная выборка (до 100 матчей). Отклонено: ${result.rejected}; противоречий: ${result.conflicts}.`,
        );
      })
      .catch(async (error) => {
        const text = await failureMessage(error);
        if (active) setMessage(text);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [game, date, status, userId, enabled, reload]);
  const visible = matches.filter(
    (m) => tournament === "all" || m.tournamentId === tournament,
  );
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto pt-28 px-4 pb-12 space-y-6">
        <Link to="/" className="text-primary">
          ← Главная
        </Link>
        <h1 className="text-3xl font-bold">Матчи</h1>
        <div className="flex flex-wrap gap-4">
          <label>
            Дисциплина{" "}
            <select
              className="bg-card border rounded p-2"
              value={game}
              onChange={(e) => setParams({ game: e.target.value })}
            >
              {["all", "cs2", "dota2", "lol", "valorant"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Дата (UTC){" "}
            <select
              className="bg-card border rounded p-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            >
              {["all", "today", "tomorrow", "week"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Статус{" "}
            <select
              className="bg-card border rounded p-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["upcoming", "live", "all"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Турнир в выборке{" "}
            <select
              className="bg-card border rounded p-2"
              value={tournament}
              onChange={(e) => setTournament(e.target.value)}
            >
              <option value="all">Все</option>
              {[
                ...new Map(
                  matches
                    .filter((m) => m.tournamentId)
                    .map((m) => [m.tournamentId, m.tournament]),
                ).entries(),
              ].map(([id, name]) => (
                <option key={id} value={id}>
                  {name ?? id}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={loading || !enabled || !userId}
            onClick={() => setReload((n) => n + 1)}
          >
            Обновить
          </Button>
        </div>
        <p role="status">{loading ? "Загрузка…" : message}</p>
        {!loading && matches.length === 0 && (
          <p>
            В этой выборке нет подтверждённых матчей. Это не означает отсутствие
            матчей у поставщика.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {visible.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </main>
    </div>
  );
}
