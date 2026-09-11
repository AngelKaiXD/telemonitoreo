import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="access-denied">
      <div className="access-denied-card">
        <FileQuestion size={48} />
        <h1>Página no encontrada</h1>
        <p>La dirección que buscas no existe o fue movida.</p>
        <Link className="btn btn-primary" to="/dashboard">
          Volver al panel
        </Link>
      </div>
    </div>
  )
}