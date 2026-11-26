import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Gamepad2, Sword, Trophy, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const games = [
  {
    id: "cs2",
    name: "Counter-Strike 2",
    icon: Target,
    gradient: "from-primary/20 to-primary/5",
  },
  {
    id: "dota2",
    name: "Dota 2",
    icon: Sword,
    gradient: "from-red-500/20 to-red-500/5",
  },
  {
    id: "lol",
    name: "League of Legends",
    icon: Trophy,
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  {
    id: "valorant",
    name: "Valorant",
    icon: Gamepad2,
    gradient: "from-red-400/20 to-red-400/5",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const handleGameClick = (gameId: string) => {
    navigate(`/matches?game=${gameId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-7xl font-black">
            Исследуй матчи{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              по данным
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Проверяемые источники. Прогнозы только после проверки качества
            модели.
          </p>
        </div>
      </section>

      {/* Games Grid */}
      <section className="pb-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {games.map((game) => {
              const Icon = game.icon;
              return (
                <button
                  key={game.id}
                  onClick={() => handleGameClick(game.id)}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} p-8 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,255,170,0.3)] border-2 border-border hover:border-primary`}
                >
                  <div className="relative z-10 flex flex-col items-center space-y-4">
                    <div className="p-4 rounded-full bg-card/50 backdrop-blur-sm">
                      <Icon className="w-12 h-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {game.name}
                    </h3>
                    <div className="text-sm text-muted-foreground text-center space-y-1">
                      <p>Каталог и проверяемость данных</p>
                    </div>
                  </div>

                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-primary/5 transition-all duration-300" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 mt-16">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>Прогнозы носят развлекательный характер</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
