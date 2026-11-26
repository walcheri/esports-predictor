import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { predictionSchema, failureMessage } from "@/lib/prediction";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-state";
import { supabase } from "@/integrations/supabase/client";
import {
  matchSchema,
  type DisplayMatch,
  displayTime,
  statusLabel,
} from "@/lib/catalogue";
export default function Match() {
  const { id } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState<DisplayMatch | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const userId = user?.id;
  const generation = useRef(0);
  const enabled = import.meta.env.VITE_PREDICTOR_EXTERNAL_ENABLED === "true";
  useEffect(() => {
    const current = ++generation.current;
    const invalidate = () => {
      if (generation.current === current) generation.current++;
    };
    let active = true;
    setMatch(null);
    setBusy(false);
    setMessage("");
    if (!enabled || !userId) {
      setMessage("Для каталога нужен вход и разрешённый источник данных.");
      return;
    }
    setMessage("Загрузка…");
    supabase.functions
      .invoke("fetch-match-details", { body: { matchId: id } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const parsed = matchSchema.parse(data?.match);
        if (parsed.id !== id) throw new Error("EVENT_ID_CONFLICT");
        setMatch(parsed);
        setMessage("");
      })
      .catch(async (error) => {
        const text = await failureMessage(error);
        if (active) setMessage(text);
      });
    return () => {
      active = false;
      invalidate();
    };
  }, [id, userId, enabled]);
  const explain = async () => {
    const current = generation.current;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-prediction",
        { body: { matchId: id } },
      );
      if (error) throw error;
      const result = predictionSchema.parse(data);
      if (current === generation.current)
        setMessage(
          result.status === "INSUFFICIENT_DATA"
            ? "Прогноз не сформирован: недостаточно подтверждённой истории и проверки модели."
            : "Источник отключён (PROVIDER_DISABLED).",
        );
    } catch (error) {
      const text = await failureMessage(error);
      if (current === generation.current) setMessage(text);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  // No LLM percentages and no client-authored prediction persistence.
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto pt-28 px-4 pb-12 space-y-6">
        <Link to="/matches" className="text-primary">
          ← Каталог
        </Link>
        <p role="status">{message}</p>
        {match && (
          <>
            <h1 className="text-3xl font-bold">
              {match.team1?.name ?? "Участник неизвестен"} —{" "}
              {match.team2?.name ?? "Участник неизвестен"}
            </h1>
            <p>
              {match.game.toUpperCase()} · {statusLabel[match.status]} ·{" "}
              {match.bestOf ? `BO${match.bestOf}` : "Формат неизвестен"}
            </p>
            <p>
              {match.tournament ?? "Турнир неизвестен"} ·{" "}
              {displayTime(match.startsAt)}
            </p>
            <Card className="p-6 space-y-3">
              <h2 className="text-xl font-bold">Проверяемость данных</h2>
              <p>
                Источник: {match.provenance.provider}, ID: {match.providerId}
              </p>
              <p>
                Получено: {displayTime(match.provenance.obtainedAt)}. Полнота:
                частичная.
              </p>
              <p>
                Победитель:{" "}
                {match.winnerId === match.team1?.id
                  ? match.team1?.name
                  : match.winnerId === match.team2?.id
                    ? match.team2?.name
                    : "не подтверждён"}
              </p>
            </Card>
            <div className="grid md:grid-cols-2 gap-4">
              {["Составы и рейтинги игроков", "Форма, карты и H2H"].map(
                (title) => (
                  <Card key={title} className="p-6">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <p>
                      Проверенная история пока не подключена. Численные
                      показатели не рассчитываются.
                    </p>
                  </Card>
                ),
              )}
            </div>
            <Card className="p-6 space-y-4">
              <h2 className="text-xl font-bold">Прогноз</h2>
              <p>
                INSUFFICIENT_DATA — недостаточно проверенных исторических
                данных. Модель ещё не прошла независимый исторический бэктест.
              </p>
              <Button disabled={busy} onClick={explain}>
                Почему нет вероятности?
              </Button>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
