import { Navigate, useParams } from 'react-router-dom'

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  return <Navigate to={`/matches?game=${gameId ?? 'all'}`} replace />
}
