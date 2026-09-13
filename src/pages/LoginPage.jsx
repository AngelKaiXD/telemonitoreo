import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, HeartPulse, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { toUserMessage } from '../services/errors'
import { Spinner } from '../components/ui/Feedback'

export default function LoginPage() {
  const { session, signIn, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (isLoading) return null
  if (session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un email válido.')
      return
    }
    if (!password) {
      setError('Ingresa tu contraseña.')
      return
    }
    setBusy(true)
    try {
      await signIn(email, password)
      const from = location.state?.from?.pathname
      navigate(from && from !== '/acceso-denegado' ? from : '/dashboard', {
        replace: true,
      })
    } catch (signInError) {
      setError(toUserMessage(signInError, 'No se pudo iniciar sesión.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <HeartPulse size={48} />
        <h1>Telemonitorización médica</h1>
        <p className="login-subtitle">Inicia sesión para continuar</p>
        {error && <div className="login-error">{error}</div>}
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                style={{ paddingLeft: 32 }}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted)',
                }}
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                style={{ paddingLeft: 32, paddingRight: 36 }}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="topbar-logout"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
            {busy ? <Spinner size={18} /> : 'Iniciar sesión'}
          </button>
        </form>
        <div className="login-links">
          <Link className="login-link" to="/recuperar">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  )
}