import { useState } from "react";
import {
  Crown,
  Sparkles,
  Check,
  Zap,
  Users,
  BarChart3,
  Infinity as InfinityIcon,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-state";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const features = [
  {
    icon: BarChart3,
    text: "Исследуем проверяемую статистику и историю матчей",
  },
  {
    icon: Clock,
    text: "Уведомление о готовности: сроки, функции и цена пока не утверждены",
  },
];

export const PremiumModal = ({ open, onOpenChange }: PremiumModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      toast({
        title: "Ошибка",
        description: "Введите корректный email",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("join_waitlist", {
        p_email: normalizedEmail,
      });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Вы уже в списке!",
            description: "Мы сообщим вам о запуске Premium первым",
          });
          setIsSubmitted(true);
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Спасибо! 🎉",
          description: "Заявка сохранена. Подписка и оплата не оформляются.",
        });
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error("Waitlist error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить в список. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Скоро — Premium
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Intro text */}
          <p className="text-muted-foreground">
            Исследуем будущие возможности; перечисленное пока не доступно:
          </p>

          {/* Features list */}
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-foreground/90 pt-1">
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          <p>
            Premium пока не продаётся. Заявка не гарантирует запуск, цену,
            скидку или доступ к букмекерским данным.
          </p>
          {/* Email form */}
          {!isSubmitted ? (
            <div className="space-y-3">
              <Input
                type="email"
                maxLength={254}
                placeholder="Введите email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background border-border"
              />
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-background"
              >
                {isSubmitting ? (
                  "Отправляем..."
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Хочу Premium первым!
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-center">
              <Check className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="font-semibold text-foreground">Вы в списке!</p>
              <p className="text-sm text-muted-foreground">
                Мы сообщим о запуске первым
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
