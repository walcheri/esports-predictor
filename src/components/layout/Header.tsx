import { Link } from 'react-router-dom'
import { Crown, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { RequestQuotaBadge } from '@/components/RequestQuotaBadge'

interface HeaderProps {
  onAuthClick: () => void
  onPremiumClick: () => void
}

export function Header({ onAuthClick, onPremiumClick }: HeaderProps) {
  const { user, logout } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-full items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <span className="text-sm font-black text-primary-foreground">E</span>
          </div>
          <span className="text-lg font-bold text-gradient-primary">
            Esports Predictor
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="font-medium text-muted-foreground transition-all duration-300 hover:text-primary"
          >
            Главная
          </Link>
          <Link
            to="/matches"
            className="font-medium text-muted-foreground transition-all duration-300 hover:text-primary"
          >
            Матчи
          </Link>
          <Link
            to="/profile?tab=history"
            className="font-medium text-muted-foreground transition-all duration-300 hover:text-primary"
          >
            История
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPremiumClick}
            className="group hover:glow-primary"
          >
            <Crown className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Premium</span>
          </Button>

          {user ? (
            <div className="flex items-center gap-2">
              <RequestQuotaBadge user={user} />
              <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {user.email}
                {user.isPremium && (
                  <Crown className="h-3 w-3 text-primary" />
                )}
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onAuthClick}>
              Войти
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
