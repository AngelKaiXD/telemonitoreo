import { ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function AccessDeniedPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="access-denied">
      <div className="access-denied-card">
        <ShieldAlert size={48} />
        <h1>Acceso restringido</h1>
        <p>
          Este panel web es exclusivo para personal médico y administrativo
          (Doctor o Admin). Si tu cuenta es de tipo Paciente, debes usar la app
          móvil para ver tus datos. No se muestra ninguna información en esta
          pantalla.
        </p>
        <button className="btn btn-primary" onClick={handleSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}