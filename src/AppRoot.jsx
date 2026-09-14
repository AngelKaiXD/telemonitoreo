import { Navigate } from 'react-router-dom'
import { useAuth } from './context/useAuth'

export default function RootRedirect() {
  const { session, isLoading, isPasswordRecovery } = useAuth()
  if (isLoading) return null
  if (isPasswordRecovery) return <Navigate to="/recuperar" replace />
  return session ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}