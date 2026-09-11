import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Camera,
  CloudDownload,
  Edit,
  Radio,
  RefreshCw,
  Stethoscope,
  Users,
  Watch,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { fetchDoctors, fetchLatestMeasurements, fetchPatients, fetchAllVitalReadings } from '../services/api'
import { toUserMessage } from '../services/errors'
import { classifyBloodPressure } from '../utils/bpClassifier'
import { formatBoliviaDateTime, riskLevelInfo, sourceLabel } from '../utils/clinical'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'

const SOURCE_ICONS = {
  ble: Watch,
  bleDevice: Watch,
  manual: Edit,
  ocr: Camera,
  imported: CloudDownload,
}

function countReadingsBySource(readings) {
  const counts = { ble: 0, manual: 0, ocr: 0, imported: 0 }
  for (const reading of readings) {
    const source = reading.source
    if (source === 'ble' || source === 'bleDevice') counts.ble += 1
    else if (source === 'ocr') counts.ocr += 1
    else if (source === 'imported') counts.imported += 1
    else counts.manual += 1
  }
  return counts
}

export default function DashboardPage() {
  const { role } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      try {
        const [patients, readings, latest] = await Promise.all([
          fetchPatients(),
          fetchAllVitalReadings(),
          fetchLatestMeasurements(),
        ])
        const doctors = role === 'admin' ? await fetchDoctors() : null
        if (!cancelled) setData({ patients, readings, latest, doctors })
      } catch (loadError) {
        if (!cancelled) {
          setData(null)
          setError(
            toUserMessage(loadError, 'No se pudieron cargar los datos del panel.'),
          )
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [role, reloadKey])

  const stats = useMemo(() => {
    if (!data) return null
    const { patients, readings } = data
    const now = new Date()
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    let totalReadings = 0
    let last7Days = 0
    const latestByPatient = new Map()
    for (const reading of readings) {
      totalReadings += 1
      const time = new Date(reading.recorded_at)
      if (time >= cutoff) last7Days += 1
      const current = latestByPatient.get(reading.patient_id)
      if (!current || time > new Date(current.recorded_at)) {
        latestByPatient.set(reading.patient_id, reading)
      }
    }

    let outOfRange = 0
    for (const latest of latestByPatient.values()) {
      if (classifyBloodPressure(latest.systolic, latest.diastolic) !== 'Normal') {
        outOfRange += 1
      }
    }

    const bySource = countReadingsBySource(readings)
    const recentActivity = readings.slice(0, 8).map((reading) => ({
      ...reading,
      patientName:
        reading.patients?.full_name ?? 'Paciente sin nombre',
    }))

    return {
      totalPatients: patients.length,
      totalDoctors: data.doctors?.length ?? 0,
      totalReadings,
      ...bySource,
      outOfRange,
      last7Days,
      recentActivity,
      hasLatest: data.latest.length,
    }
  }, [data])

  if (error) {
    return (
      <div className="section">
        <ErrorBanner message={error} />
        <button className="btn btn-outline" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="section" style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Resumen general</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <Users size={22} />
          <div className="stat-value">{stats.totalPatients}</div>
          <div className="stat-label">Pacientes</div>
        </div>
        {role === 'admin' && (
          <div className="stat-card">
            <Stethoscope size={22} />
            <div className="stat-value">{stats.totalDoctors}</div>
            <div className="stat-label">Doctores</div>
          </div>
        )}
        <div className="stat-card">
          <Activity size={22} />
          <div className="stat-value">{stats.totalReadings}</div>
          <div className="stat-label">Mediciones</div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={22} />
          <div className="stat-value">{stats.outOfRange}</div>
          <div className="stat-label">Fuera de rango</div>
        </div>
        <div className="stat-card">
          <CalendarDays size={22} />
          <div className="stat-value">{stats.last7Days}</div>
          <div className="stat-label">Últimos 7 días</div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Mediciones por fuente</h2>
        <div className="card">
          <MetricRow
            icon={Watch}
            label="BLE"
            value={stats.ble}
          />
          <MetricRow icon={Edit} label="Manual" value={stats.manual} />
          <MetricRow icon={Camera} label="OCR (cámara)" value={stats.ocr} />
          {stats.imported > 0 && (
            <MetricRow icon={CloudDownload} label="Importadas" value={stats.imported} />
          )}
        </div>
        <p className="field-hint" style={{ marginTop: 8 }}>
          La métrica "fuera de rango" usa la clasificación JNC7/AHA, la misma
          que usa la app móvil (classifyBloodPressure).
        </p>
      </div>

      <div className="section">
        <h2 className="section-title">Actividad reciente</h2>
        {stats.recentActivity.length === 0 ? (
          <EmptyState
            title="Sin mediciones registradas"
            description="Cuando las pacientes registren mediciones desde la app móvil, aparecerán aquí."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Medición</th>
                  <th>Fuente</th>
                  <th>Clasificación</th>
                  <th>Fecha y hora (Bolivia)</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActivity.map((reading) => {
                  const risk = riskLevelInfo(reading.risk_level)
                  const SourceIcon =
                    SOURCE_ICONS[reading.source] ?? Radio
                  return (
                    <tr key={reading.id}>
                      <td>
                        <Link to={`/pacientes/${reading.patient_id}`}>
                          {reading.patientName}
                        </Link>
                      </td>
                      <td className="cell-main">
                        {reading.systolic}/{reading.diastolic} mmHg
                      </td>
                      <td>
                        <span className="badge badge-source">
                          <SourceIcon size={12} style={{ marginRight: 4 }} />
                          {sourceLabel(reading.source)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${risk.tone}`}>
                          {classifyBloodPressure(reading.systolic, reading.diastolic)}
                        </span>
                      </td>
                      <td className="cell-sub">
                        {formatBoliviaDateTime(reading.recorded_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricRow({ icon: Icon, label, value }) {
  return (
    <div className="metric-row">
      <Icon size={18} />
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  )
}