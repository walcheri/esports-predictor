import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
});

const emailSchema = z.object({
  email: z.string().email("Введите корректный email"),
});

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = "login" | "register" | "forgot-password" | "check-email" | "verification-sent";

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [view, setView] = useState<ModalView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setView("login");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: "Ошибка",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (view === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Ошибка входа",
              description: "Неверный email или пароль",
              variant: "destructive",
            });
          } else if (error.message.includes("Email not confirmed")) {
            toast({
              title: "Email не подтверждён",
              description: "Проверьте почту и перейдите по ссылке для подтверждения",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Ошибка",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        toast({
          title: "Добро пожаловать!",
          description: "Вы успешно вошли в систему",
        });
        handleClose();
      } else if (view === "register") {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Ошибка регистрации",
              description: "Пользователь с таким email уже существует",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Ошибка",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        // Show verification sent screen
        setView("verification-sent");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      toast({
        title: "Ошибка",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: "Ошибка",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setView("check-email");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: "Ошибка",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    // Check Email Screen (Password Reset)
    if (view === "check-email") {
      return (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Проверьте почту</h3>
          <p className="text-muted-foreground mb-6">
            Мы отправили ссылку для сброса пароля на{" "}
            <span className="text-primary font-medium">{email}</span>
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setView("login")}
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к входу
          </Button>
        </div>
      );
    }

    // Verification Sent Screen (Registration)
    if (view === "verification-sent") {
      return (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">Подтвердите email</h3>
          <p className="text-muted-foreground mb-6">
            Мы отправили ссылку для подтверждения на{" "}
            <span className="text-primary font-medium">{email}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Перейдите по ссылке в письме, чтобы активировать аккаунт
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setView("login");
              setPassword("");
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к входу
          </Button>
        </div>
      );
    }

    // Forgot Password Form
    if (view === "forgot-password") {
      return (
        <div className="space-y-4 py-4">
          <div className="text-center mb-4">
            <p className="text-muted-foreground">
              Введите email, и мы отправим ссылку для сброса пароля
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary border-border"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Отправить ссылку"
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              onClick={() => setView("login")}
              disabled={loading}
            >
              <ArrowLeft className="w-3 h-3" />
              Вернуться к входу
            </button>
          </div>
        </div>
      );
    }

    // Login / Register Form
    return (
      <div className="space-y-4 py-4">
        {/* Google Sign In */}
        <Button
          variant="outline"
          className="w-full h-12 gap-2 border-border hover:bg-secondary"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Войти через Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">или</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Пароль</Label>
              {view === "login" && (
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setView("forgot-password")}
                  disabled={loading}
                >
                  Забыли пароль?
                </button>
              )}
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary border-border"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                {view === "login" ? "Войти" : "Зарегистрироваться"}
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setView(view === "login" ? "register" : "login")}
            disabled={loading}
          >
            {view === "login" ? "Нет аккаунта? Зарегистрируйтесь" : "Уже есть аккаунт? Войдите"}
          </button>
        </div>
      </div>
    );
  };

  const getTitle = () => {
    switch (view) {
      case "login":
        return "Вход";
      case "register":
        return "Регистрация";
      case "forgot-password":
        return "Восстановление пароля";
      case "check-email":
        return "Проверьте почту";
      case "verification-sent":
        return "Регистрация";
      default:
        return "Вход";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};
