import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, CloudDownload, Edit, HeartPulse, Radio, Watch } from 'lucide-react'
import { fetchPatientById, fetchVitalReadingsByPatient } from '../services/api'
import { toUserMessage } from '../services/errors'
import { classifyBloodPressure } from '../utils/bpClassifier'
import {
  booleanText,
  formatBoliviaDateTime,
  formatNumber,
  riskLevelInfo,
  sourceLabel,
} from '../utils/clinical'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'

const SOURCE_ICONS = {
  ble: Watch,
  bleDevice: Watch,
  manual: HeartPulse,
  ocr: Camera,
  imported: CloudDownload,
}

export default function PatientDetailPage() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [readings, setReadings] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [row, readingRows] = await Promise.all([
          fetchPatientById(id),
          fetchVitalReadingsByPatient(id),
        ])
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          return
        }
        setPatient(row)
        setReadings(readingRows)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            toUserMessage(loadError, 'No se pudieron cargar los datos de la paciente.'),
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
  }, [id])

  if (loading) {
    return (
      <div className="section" style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
        <Spinner size={32} />
      </div>
    )
  }

  if (notFound) {
    return (
      <EmptyState
        title="Paciente no encontrada"
        description="La paciente no existe o no tienes permiso para verla."
      >
        <Link className="btn btn-outline" to="/pacientes" style={{ marginTop: 16 }}>
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
      </EmptyState>
    )
  }

  if (error) return <ErrorBanner message={error} />
  if (!patient) return null

  const imc =
    patient.height_cm && patient.weight_kg
      ? patient.weight_kg / Math.pow(patient.height_cm / 100, 2)
      : null
  const latest = readings && readings.length > 0 ? readings[0] : null

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <h1>{patient.full_name}</h1>
        <div className="page-header-right">
          <Link className="btn btn-outline" to="/pacientes">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
          <Link className="btn btn-primary" to={`/pacientes/${patient.id}/editar`}>
            <Edit size={16} />
            Editar paciente
          </Link>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Datos del paciente</h2>
        <div className="card">
          <InfoRow label="CI / Documento" value={patient.document_id} />
          <InfoRow label="Edad" value={`${patient.age} años`} />
          <InfoRow label="Semanas de gestación" value={`${patient.gestation_weeks} semanas`} />
          <InfoRow label="Talla" value={`${formatNumber(patient.height_cm, 0)} cm`} />
          <InfoRow label="Peso" value={`${formatNumber(patient.weight_kg, 1)} kg`} />
          <InfoRow label="IMC" value={imc ? formatNumber(imc) : '—'} />
          <InfoRow label="Altitud" value={`${patient.altitude} msnm`} />
          <InfoRow
            label="Estado civil"
            value={patient.is_single ? 'Soltera' : 'Casada / Conviviente'}
          />
          <InfoRow
            label="Antecedente de hipertensión"
            value={booleanText(patient.has_hypertension_history)}
          />
          <InfoRow
            label="Antecedente de preeclampsia"
            value={booleanText(patient.has_preeclampsia_history)}
          />
          <InfoRow
            label="Embarazo gemelar o múltiple"
            value={booleanText(patient.has_multiple_pregnancy)}
          />
          <InfoRow label="Nuliparidad" value={booleanText(patient.is_nulliparous)} />
          <InfoRow
            label="Diabetes pregestacional"
            value={booleanText(patient.has_pregestational_diabetes)}
          />
          <InfoRow label="Teléfono" value={patient.phone ?? '—'} />
          <InfoRow label="Dirección" value={patient.address ?? '—'} />
        </div>
      </div>

      {latest && (
        <div className="section">
          <h2 className="section-title">Última medición</h2>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <HeartPulse size={18} color="var(--primary-dark)" />
              <strong>Presión arterial</strong>
              <span className="badge badge-danger">
                {riskLevelInfo(latest.risk_level).label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 900 }}>
                {latest.systolic}/{latest.diastolic}
              </span>
              <span>mmHg</span>
              <span style={{ marginLeft: 'auto', fontSize: 24, fontWeight: 800 }}>
                {latest.heart_rate}
              </span>
              <span>bpm</span>
            </div>
            <p style={{ margin: '8px 0 4px' }}>{latest.diagnosis}</p>
            <p className="cell-sub">
              Clasificación PA:{' '}
              {classifyBloodPressure(latest.systolic, latest.diastolic)} · Fuente:{' '}
              {sourceLabel(latest.source)} ·{' '}
              {formatBoliviaDateTime(latest.recorded_at)}
            </p>
            {latest.observations && <p className="cell-sub">{latest.observations}</p>}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Historial clínico completo</h2>
        {!readings || readings.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="Sin mediciones"
            description="La paciente aún no tiene mediciones registradas desde la app móvil."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha y hora (Bolivia)</th>
                  <th>Medición</th>
                  <th>Pulso</th>
                  <th>Fuente</th>
                  <th>Clasificación</th>
                  <th>Riesgo</th>
                  <th>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => {
                  const risk = riskLevelInfo(reading.risk_level)
                  const SourceIcon =
                    SOURCE_ICONS[reading.source] ?? Radio
                  return (
                    <tr key={reading.id}>
                      <td className="cell-sub">
                        {formatBoliviaDateTime(reading.recorded_at)}
                      </td>
                      <td className="cell-main">
                        {reading.systolic}/{reading.diastolic} mmHg
                      </td>
                      <td>{reading.heart_rate} bpm</td>
                      <td>
                        <span className="badge badge-source">
                          <SourceIcon size={12} style={{ marginRight: 4 }} />
                          {sourceLabel(reading.source)}
                        </span>
                      </td>
                      <td>
                        {classifyBloodPressure(reading.systolic, reading.diastolic)}
                      </td>
                      <td>
                        <span className={`badge badge-${risk.tone}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="cell-sub" style={{ maxWidth: 320 }}>
                        {reading.diagnosis}
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

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}