import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Pencil, Plus, Search, UserRound } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  fetchDoctorAssignments,
  fetchLatestMeasurements,
  fetchPatients,
} from '../services/api'
import { toUserMessage } from '../services/errors'
import {
  formatBoliviaDateTime,
  formatNumber,
  sourceLabel,
} from '../utils/clinical'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'

export default function PatientsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'
  const [patients, setPatients] = useState([])
  const [latestByPatient, setLatestByPatient] = useState({})
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [patientRows, latestRows] = await Promise.all([
          fetchPatients(),
          fetchLatestMeasurements(),
        ])
        const map = {}
        for (const latest of latestRows) {
          map[latest.patient_id] = latest
        }
        const assignmentRows = isAdmin ? await fetchDoctorAssignments() : []
        if (!cancelled) {
          setPatients(patientRows)
          setLatestByPatient(map)
          setAssignments(assignmentRows)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            toUserMessage(loadError, 'No se pudieron cargar las pacientes.'),
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
  }, [isAdmin])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let rows = patients
    if (term) {
      rows = rows.filter(
        (patient) =>
          patient.full_name?.toLowerCase().includes(term) ||
          patient.document_id?.toLowerCase().includes(term),
      )
    }
    if (doctorFilter && isAdmin) {
      rows = rows.filter((patient) =>
        assignments.some(
          (a) =>
            a.patient_id === patient.id && a.doctor_id === doctorFilter,
        ),
      )
    }
    return rows
  }, [patients, search, doctorFilter, assignments, isAdmin])

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
        <h1>Pacientes</h1>
        <Link className="btn btn-primary" to="/pacientes/nuevo">
          <Plus size={16} />
          Registrar paciente
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="patient-search">Buscar</label>
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
              id="patient-search"
              type="text"
              placeholder="Buscar por nombre o documento"
              value={search}
              style={{ paddingLeft: 32 }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {isAdmin && (
          <div className="field" style={{ minWidth: 200 }}>
            <label htmlFor="doctor-filter">Doctor asignado</label>
            <select
              id="doctor-filter"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {[...new Map(assignments.map((a) => [a.doctor_id, a])).values()].map(
                (assignment) => {
                  const name =
                    assignment.doctors?.first_name && assignment.doctors?.last_name
                      ? `${assignment.doctors.first_name} ${assignment.doctors.last_name}`
                      : 'Doctor'
                  return (
                    <option key={assignment.doctor_id} value={assignment.doctor_id}>
                      {name}
                    </option>
                  )
                },
              )}
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        patients.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No hay pacientes"
            description="Registra pacientes para iniciar el seguimiento clínico desde este panel."
            actionLabel="Registrar paciente"
            onAction={() => navigate('/pacientes/nuevo')}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Ninguna paciente coincide con la búsqueda o el filtro actual."
          />
        )
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>CI / Documento</th>
                <th>Edad</th>
                <th>Gestación</th>
                <th>IMC</th>
                <th>Última medición</th>
                {isAdmin && <th>Doctor asignado</th>}
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((patient) => {
                const latest = latestByPatient[patient.id]
                const imc =
                  patient.height_cm && patient.weight_kg
                    ? patient.weight_kg / Math.pow(patient.height_cm / 100, 2)
                    : null
                const assignedDoctors = isAdmin
                  ? assignments
                      .filter((a) => a.patient_id === patient.id)
                      .map((a) => {
                        const d = a.doctors
                        return d?.first_name && d?.last_name
                          ? `${d.first_name} ${d.last_name}`
                          : 'Sin nombre'
                      })
                  : []
                return (
                  <tr key={patient.id}>
                    <td>
                      <Link to={`/pacientes/${patient.id}`}>
                        {patient.full_name}
                      </Link>
                    </td>
                    <td className="cell-sub">{patient.document_id}</td>
                    <td>{patient.age}</td>
                    <td>{patient.gestation_weeks} semanas</td>
                    <td>{imc ? formatNumber(imc) : '—'}</td>
                    <td>
                      {latest ? (
                        <>
                          <span className="cell-main">
                            {latest.systolic}/{latest.diastolic} mmHg
                          </span>{' '}
                          <span className="cell-sub">
                            {sourceLabel(latest.source)} ·{' '}
                            {formatBoliviaDateTime(latest.recorded_at)}
                          </span>
                        </>
                      ) : (
                        <span className="cell-sub">Sin medición reciente</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        {assignedDoctors.length > 0
                          ? assignedDoctors.join(', ')
                          : <span className="cell-sub">Sin asignar</span>}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Link className="btn btn-outline btn-sm" to={`/pacientes/${patient.id}`} title="Ver detalle">
                          <Eye size={14} />
                        </Link>
                        <Link className="btn btn-outline btn-sm" to={`/pacientes/${patient.id}/editar`} title="Editar">
                          <Pencil size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}