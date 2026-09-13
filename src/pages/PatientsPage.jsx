import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, Eye, Pencil, Plus, Search, UserRound } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  fetchAllVitalReadings,
  fetchDoctorAssignments,
  fetchLatestMeasurements,
  fetchPatients,
  updatePatient,
} from '../services/api'
import { toUserMessage } from '../services/errors'
import {
  formatBoliviaDateTime,
  formatNumber,
  sourceLabel,
} from '../utils/clinical'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'
import ConfirmModal from '../components/ui/ConfirmModal'
import DownloadMenu from '../components/ui/DownloadMenu'
import BpGaugeBar from '../components/ui/BpGaugeBar'

export default function PatientsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'
  const [patients, setPatients] = useState([])
  const [latestByPatient, setLatestByPatient] = useState({})
  const [averagesByPatient, setAveragesByPatient] = useState({})
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  async function runGeneralReport(kind) {
    if (generating) return
    setGenerating(true)
    setError(null)
    try {
      const report = await import('../services/reportService')
      if (kind === 'pdf') await report.generateGeneralPdf(filtered)
      else await report.generateGeneralExcel(filtered)
    } catch (reportError) {
      setError(toUserMessage(reportError, 'No se pudo generar el reporte.'))
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [patientRows, latestRows, readingRows] = await Promise.all([
          fetchPatients({ includeArchived: showArchived }),
          fetchLatestMeasurements(),
          fetchAllVitalReadings(),
        ])
        const map = {}
        for (const latest of latestRows) {
          map[latest.patient_id] = latest
        }
        const averages = {}
        for (const reading of readingRows) {
          const entry = averages[reading.patient_id] ?? {
            sysSum: 0,
            diaSum: 0,
            count: 0,
          }
          entry.sysSum += Number(reading.systolic)
          entry.diaSum += Number(reading.diastolic)
          entry.count += 1
          averages[reading.patient_id] = entry
        }
        for (const key of Object.keys(averages)) {
          const entry = averages[key]
          averages[key] = {
            systolic: Math.round(entry.sysSum / entry.count),
            diastolic: Math.round(entry.diaSum / entry.count),
          }
        }
        const assignmentRows = isAdmin ? await fetchDoctorAssignments() : []
        if (!cancelled) {
          setPatients(patientRows)
          setLatestByPatient(map)
          setAveragesByPatient(averages)
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
  }, [isAdmin, showArchived])

  async function confirmArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    setError(null)
    try {
      await updatePatient(archiveTarget.id, { is_active: false })
      setPatients((rows) => rows.filter((row) => row.id !== archiveTarget.id))
      setArchiveTarget(null)
    } catch (archiveError) {
      setError(toUserMessage(archiveError, 'No se pudo archivar la paciente.'))
    } finally {
      setArchiving(false)
    }
  }

  async function reactivatePatient(patient) {
    setBusyId(patient.id)
    setError(null)
    try {
      await updatePatient(patient.id, { is_active: true })
      setPatients((rows) => rows.filter((row) => row.id !== patient.id))
    } catch (reactError) {
      setError(toUserMessage(reactError, 'No se pudo reactivar la paciente.'))
    } finally {
      setBusyId(null)
    }
  }

  const filtered = (() => {
    const term = search.trim().toLowerCase()
    let rows = patients
    if (showArchived) rows = rows.filter((patient) => patient.is_active === false)
    else rows = rows.filter((patient) => patient.is_active !== false)
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
  })()

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DownloadMenu
            busy={generating}
            disabled={filtered.length === 0}
            label="Reporte general"
            onPdf={() => runGeneralReport('pdf')}
            onExcel={() => runGeneralReport('excel')}
          />
          <Link className="btn btn-primary" to="/pacientes/nuevo">
            <Plus size={16} />
            Registrar paciente
          </Link>
        </div>
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
        <div style={{ alignSelf: 'flex-end', marginBottom: 2 }}>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {showArchived ? 'Ver activas' : 'Ver archivadas'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        patients.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={showArchived ? 'No hay pacientes archivadas' : 'No hay pacientes'}
            description={
              showArchived
                ? 'Las pacientes archivadas aparecerán aquí para consultarlas o reactivarlas.'
                : 'Registra pacientes para iniciar el seguimiento clínico desde este panel.'
            }
            actionLabel={showArchived ? undefined : 'Registrar paciente'}
            onAction={() => navigate('/pacientes/nuevo')}
          />
        ) : (
          <EmptyState
            icon={Search}
            title={showArchived ? 'No hay pacientes archivadas' : 'Sin resultados'}
            description={
              showArchived
                ? 'Ninguna paciente archivada coincide con la búsqueda o el filtro.'
                : 'Ninguna paciente coincide con la búsqueda o el filtro actual.'
            }
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
                <th>Distribución PA</th>
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
                    <td>
                      {averagesByPatient[patient.id] ? (
                        <BpGaugeBar
                          systolic={averagesByPatient[patient.id].systolic}
                          diastolic={averagesByPatient[patient.id].diastolic}
                        />
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
                        {showArchived ? (
                          <button
                            className="btn btn-outline btn-sm"
                            type="button"
                            onClick={() => reactivatePatient(patient)}
                            disabled={busyId === patient.id}
                            title="Reactivar paciente"
                          >
                            <ArchiveRestore size={14} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline btn-sm"
                            type="button"
                            onClick={() => setArchiveTarget(patient)}
                            title="Archivar paciente"
                          >
                            <Archive size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={archiveTarget !== null}
        onClose={() => !archiving && setArchiveTarget(null)}
        onConfirm={confirmArchive}
        confirmLabel="Archivar"
        loading={archiving}
        title="Archivar paciente"
        message={
          archiveTarget
            ? `¿Archivar a ${archiveTarget.full_name}? Dejará de aparecer en las listas por defecto, pero su historial médico se conserva intacto y podrás reactivarla desde "Ver archivadas".`
            : '¿Deseas archivar esta paciente?'
        }
      />
    </div>
  )
}