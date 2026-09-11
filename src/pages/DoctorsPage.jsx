import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search, Stethoscope } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { fetchDoctors } from '../services/api'
import { toUserMessage } from '../services/errors'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'

export default function DoctorsPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchDoctors()
        if (!cancelled) setDoctors(rows)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            toUserMessage(loadError, 'No se pudieron cargar los doctores.'),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return doctors
    return doctors.filter(
      (doctor) =>
        `${doctor.first_name} ${doctor.last_name}`.toLowerCase().includes(term) ||
        doctor.specialty?.toLowerCase().includes(term) ||
        doctor.hospital_name?.toLowerCase().includes(term),
    )
  }, [doctors, search])

  if (loading) {
    return (
      <div className="section" style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Doctores</h1>
        {isAdmin && (
          <Link className="btn btn-primary" to="/doctores/nuevo">
            <Plus size={16} />
            Registrar doctor
          </Link>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {!isAdmin && (
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Como Doctor puedes ver el listado de doctores, pero solo el Admin
          puede crearlos o editarlos.
        </p>
      )}

      <div className="field" style={{ maxWidth: 380, marginBottom: 16 }}>
        <label htmlFor="doctor-search">Buscar</label>
        <div style={{ position: 'relative' }}>
          <Search
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
            id="doctor-search"
            type="text"
            placeholder="Buscar por nombre, especialidad u hospital"
            value={search}
            style={{ paddingLeft: 32 }}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        doctors.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No hay doctores registrados"
            description={
              isAdmin
                ? 'Registra doctores para asignarles pacientes.'
                : 'Aún no hay doctores registrados en el sistema.'
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Ningún doctor coincide con la búsqueda."
          />
        )
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especialidad</th>
                <th>Hospital</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Licencia</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doctor) => (
                <tr key={doctor.id}>
                  <td className="cell-main">
                    {doctor.first_name} {doctor.last_name}
                  </td>
                  <td>{doctor.specialty}</td>
                  <td>{doctor.hospital_name}</td>
                  <td>{doctor.phone ?? '—'}</td>
                  <td>{doctor.email ?? '—'}</td>
                  <td>{doctor.license_number ?? '—'}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Link
                          className="btn btn-outline btn-sm"
                          to={`/doctores/${doctor.id}/editar`}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </Link>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}