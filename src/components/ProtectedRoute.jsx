import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { FullPageLoader } from './ui/Feedback'

/**
 * Exige sesión válida. Sin sesión redirige al login (conservando la ruta a la
 * que se intentaba entrar). Una sesión de recuperación de contraseña siempre se
 * resuelve en /recuperar, antes de evaluar el rol. Con sesión pero rol no
 * médico/admin, muestra una pantalla de acceso denegado sin revelar ningún dato.
 */
export default function ProtectedRoute() {
  const { session, role, isLoading, isPasswordRecovery } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FullPageLoader />
  }

  if (isPasswordRecovery) {
    return <Navigate to="/recuperar" replace />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (role !== 'doctor' && role !== 'admin') {
    return <Navigate to="/acceso-denegado" replace />
  }

  return <Outlet />
}