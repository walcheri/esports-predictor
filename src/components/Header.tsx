import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { UserMenu } from "./UserMenu";

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-20 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
            <span className="text-background font-black">E</span>
          </div>
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Esports Predictor
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/matches"
            className="text-foreground hover:text-primary transition-colors font-medium"
          >
            Матчи
          </Link>
          <Link
            to="/profile?tab=history"
            className="text-muted-foreground hover:text-primary transition-colors font-medium"
          >
            История
          </Link>
          <UserMenu />
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-4">
          <UserMenu />
          <button
            className="text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-card border-b border-border">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link
              to="/matches"
              className="text-foreground hover:text-primary transition-colors font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Матчи
            </Link>
            <Link
              to="/profile?tab=history"
              className="text-muted-foreground hover:text-primary transition-colors font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              История
            </Link>
            <Link
              to="/profile"
              className="text-muted-foreground hover:text-primary transition-colors font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Профиль
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
