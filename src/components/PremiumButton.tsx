import { useState } from "react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumModal } from "./PremiumModal";

interface PremiumButtonProps {
  variant?: "header" | "profile";
  className?: string;
}

export const PremiumButton = ({ variant = "header", className = "" }: PremiumButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (variant === "profile") {
    return (
      <>
        <div className={`p-4 rounded-xl bg-gradient-to-br from-card to-background border border-border ${className}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Текущий план: Free</p>
              <p className="text-sm text-muted-foreground">Скоро будет доступен Premium</p>
            </div>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            variant="outline"
            className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Crown className="w-4 h-4 mr-2" />
            Хочу Premium первым
          </Button>
        </div>
        <PremiumModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setModalOpen(true)}
        variant="ghost"
        className={`group relative text-primary hover:text-primary hover:bg-primary/10 ${className}`}
      >
        <Crown className="w-4 h-4 mr-1.5 transition-transform group-hover:scale-110" />
        <span className="font-medium">Premium</span>
        {/* Glow effect on hover */}
        <div className="absolute inset-0 rounded-md bg-primary/0 group-hover:bg-primary/5 transition-colors" />
        <div className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_rgba(0,255,170,0.3)]" />
      </Button>
      <PremiumModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
};
