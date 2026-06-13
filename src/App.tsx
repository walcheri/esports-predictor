import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AuthModal } from '@/components/AuthModal'
import { PremiumModal } from '@/components/PremiumModal'
import { HomePage } from '@/pages/HomePage'
import { MatchesPage } from '@/pages/MatchesPage'
import { GamePage } from '@/pages/GamePage'
import { MatchPage } from '@/pages/MatchPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { HistoryPage } from '@/pages/HistoryPage'

function AppContent() {
  const [authOpen, setAuthOpen] = useState(false)
  const [premiumOpen, setPremiumOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onAuthClick={() => setAuthOpen(true)}
        onPremiumClick={() => setPremiumOpen(true)}
      />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route
            path="/profile"
            element={<ProfilePage onPremiumClick={() => setPremiumOpen(true)} />}
          />
          <Route
            path="/match/:matchId"
            element={
              <MatchPage
                onPremiumClick={() => setPremiumOpen(true)}
                onAuthClick={() => setAuthOpen(true)}
              />
            }
          />
        </Routes>
      </div>
      <Footer />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <PremiumModal open={premiumOpen} onOpenChange={setPremiumOpen} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
