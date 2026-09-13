import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Pencil, Plus, Search, Stethoscope, Trash2 } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { countPatientsByDoctor, deleteDoctor, fetchDoctors } from '../services/api'
import { toUserMessage } from '../services/errors'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'
import Modal from '../components/ui/Modal'

export default function DoctorsPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState('counting')
  const [deleteCount, setDeleteCount] = useState(0)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  async function openDelete(doctor) {
    setDeleteTarget(doctor)
    setDeleteStatus('counting')
    setDeleteCount(0)
    setDeleteError(null)
    try {
      const n = await countPatientsByDoctor(doctor.id)
      setDeleteCount(n)
      setDeleteStatus(n > 0 ? 'blocked' : 'confirm')
    } catch (countError) {
      setDeleteError(toUserMessage(countError, 'No se pudo verificar las pacientes asignadas.'))
      setDeleteStatus('error')
    }
  }

  function closeDelete() {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
    setDeleteCount(0)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteDoctor(deleteTarget.id)
      setDoctors(await fetchDoctors())
      closeDelete()
    } catch (deleteErr) {
      if (deleteErr?.code === '23503') {
        setDeleteError(
          'No se pudo eliminar: el doctor tiene registros asociados (por ejemplo su cuenta de acceso en profiles).',
        )
      } else {
        setDeleteError(
          toUserMessage(deleteErr, 'No se pudo eliminar el doctor.'),
        )
      }
      setDeleteStatus('error')
    } finally {
      setDeleting(false)
    }
  }

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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <Link
                          className="btn btn-outline btn-sm"
                          to={`/doctores/${doctor.id}/editar`}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </Link>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => openDelete(doctor)}
                          title="Eliminar doctor"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={deleteTarget !== null} onClose={closeDelete} title="Eliminar doctor">
        {deleteStatus === 'counting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Spinner size={20} />
            <span>Verificando pacientes asignadas...</span>
          </div>
        )}

        {deleteStatus === 'blocked' && (
          <>
            <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 0 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, color: 'var(--danger)' }} />
              <span>
                Este doctor tiene <strong>{deleteCount}</strong>{' '}
                {deleteCount === 1 ? 'paciente asignada' : 'pacientes asignadas'}.{' '}
                Reasígnalas a otro doctor antes de eliminarlo.
              </span>
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={closeDelete}>
                Entendido
              </button>
            </div>
          </>
        )}

        {deleteStatus === 'confirm' && (
          <>
            <p>
              ¿Eliminar a <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> de la
              tabla de doctores? Su cuenta de acceso no se revoca con esta acción.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={closeDelete} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </>
        )}

        {deleteStatus === 'error' && (
          <>
            <p style={{ marginBottom: 0 }}>{deleteError}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={closeDelete}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}