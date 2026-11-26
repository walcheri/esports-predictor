import { toast } from "sonner";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthModal } from "./AuthModal";
import { User, LogOut, History, Settings } from "lucide-react";

export const UserMenu = () => {
  const { user, profile, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
    );
  }

  if (!user) {
    return (
      <>
        <Button
          onClick={() => setShowAuthModal(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Войти
        </Button>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  const initials =
    profile?.email?.substring(0, 2).toUpperCase() ||
    user.email?.substring(0, 2).toUpperCase() ||
    "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Открыть профиль"
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
        >
          <Avatar className="h-10 w-10 border-2 border-primary">
            <AvatarImage
              src={profile?.avatar_url || ""}
              alt={profile?.email || ""}
            />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card border-border" align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium text-sm text-foreground">
              {profile?.username || profile?.email || user.email}
            </p>
            {profile?.predictions_count !== undefined && (
              <p className="text-xs text-muted-foreground">
                {profile.predictions_count} прогнозов
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Профиль
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/profile?tab=history"
            className="flex items-center cursor-pointer"
          >
            <History className="mr-2 h-4 w-4" />
            История прогнозов
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/profile?tab=settings"
            className="flex items-center cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            Настройки
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() =>
            void signOut().catch(() =>
              toast.error("Не удалось выйти. Повторите попытку."),
            )
          }
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
