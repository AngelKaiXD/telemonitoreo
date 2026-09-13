import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, HeartPulse, KeyRound, Mail } from 'lucide-react'
import { supabase } from '../services/supabaseClient'
import { toUserMessage } from '../services/errors'
import { Spinner } from '../components/ui/Feedback'

function readRecoveryFromHash() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (params.get('type') === 'recovery' && access_token && refresh_token) {
    return { access_token, refresh_token }
  }
  return null
}

export default function RecoveryPage() {
  const [recovery] = useState(readRecoveryFromHash)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [updated, setUpdated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSend(event) {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un email válido.')
      return
    }
    setBusy(true)
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/recuperar`,
      })
      setSentTo(email.trim())
    } catch (sendError) {
      setError(toUserMessage(sendError, 'No se pudo enviar el enlace de recuperación.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdate(event) {
    event.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    try {
      await supabase.auth.setSession(recovery)
      await supabase.auth.updatePassword(password)
      await supabase.auth.signOut()
      setUpdated(true)
    } catch (updateError) {
      setError(
        toUserMessage(
          updateError,
          'No se pudo restablecer la contraseña. Solicita un enlace nuevo desde el login.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  let content = null

  if (updated) {
    content = (
      <>
        <CheckCircle2 size={40} />
        <h1>Contraseña actualizada</h1>
        <p className="login-subtitle">
          Tu contraseña se restableció correctamente. Ya puedes iniciar sesión con ella en la web
          y en la app móvil.
        </p>
        <Link className="btn btn-primary" to="/login">
          Ir a iniciar sesión
        </Link>
      </>
    )
  } else if (recovery) {
    content = (
      <>
        <KeyRound size={40} />
        <h1>Nueva contraseña</h1>
        <p className="login-subtitle">Define la nueva contraseña para tu cuenta.</p>
        {error && <div className="login-error">{error}</div>}
        <form className="form-grid" onSubmit={handleUpdate}>
          <div className="field">
            <label htmlFor="recovery-password">Nueva contraseña</label>
            <input
              id="recovery-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="recovery-confirm">Repite la contraseña</label>
            <input
              id="recovery-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
            {busy ? <Spinner size={18} /> : 'Guardar nueva contraseña'}
          </button>
        </form>
        <Link className="login-link" to="/login">
          Volver al inicio de sesión
        </Link>
      </>
    )
  } else if (sentTo) {
    content = (
      <>
        <Mail size={40} />
        <h1>Revisa tu correo</h1>
        <p className="login-subtitle">
          Te enviamos un enlace para restablecer tu contraseña a <strong>{sentTo}</strong>. Si no
          llega en unos minutos, revisa la carpeta de spam.
        </p>
        <Link className="btn btn-primary" to="/login">
          Volver al inicio de sesión
        </Link>
      </>
    )
  } else {
    content = (
      <>
        <Mail size={40} />
        <h1>Recuperar contraseña</h1>
        <p className="login-subtitle">
          Ingresa el email de tu cuenta y te enviaremos un enlace para restablecer la contraseña.
        </p>
        {error && <div className="login-error">{error}</div>}
        <form className="form-grid" onSubmit={handleSend}>
          <div className="field">
            <label htmlFor="recovery-email">Email</label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
            {busy ? <Spinner size={18} /> : 'Enviar enlace'}
          </button>
        </form>
        <Link className="login-link" to="/login">
          Volver al inicio de sesión
        </Link>
      </>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <HeartPulse size={48} />
        {content}
      </div>
    </div>
  )
}