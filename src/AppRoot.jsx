import { Navigate } from 'react-router-dom'
import { useAuth } from './context/useAuth'

export default function RootRedirect() {
  const { session, isLoading } = useAuth()
  if (isLoading) return null
  return session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}