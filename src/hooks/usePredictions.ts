import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-state";

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  team_a: string;
  team_b: string;
  game: string;
  tournament: string | null;
  predicted_winner: string | null;
  ai_probability_a: string | null;
  ai_probability_b: string | null;
  report_preview: string | null;
  full_report: string | null;
  created_at: string;
}

export const usePredictions = (limit = 20, offset = 0) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["predictions", user?.id, limit, offset],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data as Prediction[];
    },
    enabled: !!user,
  });
};

export const usePredictionStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["prediction-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const predictions = data as Prediction[];

      // Calculate stats by game
      const gameStats: Record<string, number> = {};
      predictions.forEach((p) => {
        const game = p.game || "unknown";
        gameStats[game] = (gameStats[game] || 0) + 1;
      });

      // Calculate predictions by date (last 30 days)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const dailyPredictions: Record<string, number> = {};
      predictions.forEach((p) => {
        const date = new Date(p.created_at);
        if (date >= last30Days) {
          const dateKey = date.toISOString().split("T")[0];
          dailyPredictions[dateKey] = (dailyPredictions[dateKey] || 0) + 1;
        }
      });

      return {
        total: predictions.length,
        gameStats,
        dailyPredictions,
        recentPredictions: predictions.slice(0, 5),
      };
    },
    enabled: !!user,
  });
};
