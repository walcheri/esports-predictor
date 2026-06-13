import { Navigate } from 'react-router-dom'

export function HistoryPage() {
  return <Navigate to="/profile?tab=history" replace />
}
