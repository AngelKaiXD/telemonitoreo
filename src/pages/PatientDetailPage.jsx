import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, Camera, CloudDownload, Edit, HeartPulse, ImageOff, Radio, Watch } from 'lucide-react'
import {
  fetchPatientById,
  fetchProteinuriaPhotoUrl,
  fetchProteinuriaTests,
  fetchVitalReadingsByPatient,
  updatePatient,
} from '../services/api'
import { toUserMessage } from '../services/errors'
import { classifyBloodPressure } from '../utils/bpClassifier'
import {
  booleanText,
  formatBoliviaDateTime,
  formatNumber,
  proteinuriaResultInfo,
  riskLevelInfo,
  sourceLabel,
} from '../utils/clinical'
import { EmptyState, ErrorBanner, Spinner } from '../components/ui/Feedback'
import ConfirmModal from '../components/ui/ConfirmModal'
import DownloadMenu from '../components/ui/DownloadMenu'
import Modal from '../components/ui/Modal'

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
  const [exportError, setExportError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [proteinuriaTests, setProteinuriaTests] = useState([])
  const [proteinuriaPhotoUrls, setProteinuriaPhotoUrls] = useState({})
  const [proteinuriaError, setProteinuriaError] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  async function archivePatient() {
    setArchiving(true)
    setError(null)
    try {
      await updatePatient(patient.id, { is_active: false })
      setPatient((prev) => (prev ? { ...prev, is_active: false } : prev))
      setConfirmArchiveOpen(false)
    } catch (archiveError) {
      setError(toUserMessage(archiveError, 'No se pudo archivar la paciente.'))
    } finally {
      setArchiving(false)
    }
  }

  async function reactivatePatient() {
    setArchiving(true)
    setError(null)
    try {
      await updatePatient(patient.id, { is_active: true })
      setPatient((prev) => (prev ? { ...prev, is_active: true } : prev))
    } catch (reactError) {
      setError(toUserMessage(reactError, 'No se pudo reactivar la paciente.'))
    } finally {
      setArchiving(false)
    }
  }

  async function runIndividualReport(kind) {
    if (generating || !patient) return
    setGenerating(true)
    setExportError(null)
    try {
      const report = await import('../services/reportService')
      if (kind === 'pdf') await report.generateIndividualPdf(patient, readings ?? [])
      else await report.generateIndividualExcel(patient, readings ?? [])
    } catch (reportError) {
      setExportError(toUserMessage(reportError, 'No se pudo generar el reporte.'))
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

  // Historial de proteinuria (solo lectura, Fase 31). Si la tabla aún no
  // existe o la RLS no permite leerla, no rompe la página: muestra un aviso.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setProteinuriaError(null)
      try {
        const tests = await fetchProteinuriaTests(id)
        if (cancelled) return
        setProteinuriaTests(tests)
        const urls = {}
        await Promise.all(
          tests.map(async (test) => {
            try {
              const url = await fetchProteinuriaPhotoUrl(test.photo_path)
              if (!cancelled) urls[test.id] = url
            } catch {
              // la foto no pudo firmarse; su miniatura muestra el marcador
            }
          }),
        )
        if (!cancelled) setProteinuriaPhotoUrls(urls)
      } catch (loadError) {
        if (!cancelled) {
          setProteinuriaTests([])
          setProteinuriaPhotoUrls({})
          setProteinuriaError(
            toUserMessage(
              loadError,
              'No se pudieron cargar las pruebas de proteinuria.',
            ),
          )
        }
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
          {patient.is_active === false ? (
            <button className="btn btn-outline" type="button" onClick={reactivatePatient} disabled={archiving}>
              <ArchiveRestore size={16} />
              Reactivar paciente
            </button>
          ) : (
            <button className="btn btn-outline" type="button" onClick={() => setConfirmArchiveOpen(true)}>
              <Archive size={16} />
              Archivar paciente
            </button>
          )}
          <DownloadMenu
            busy={generating}
            label="Reporte individual"
            onPdf={() => runIndividualReport('pdf')}
            onExcel={() => runIndividualReport('excel')}
          />
          <Link className="btn btn-primary" to={`/pacientes/${patient.id}/editar`}>
            <Edit size={16} />
            Editar paciente
          </Link>
        </div>
      </div>

      {patient.is_active === false && (
        <div className="info-banner">
          Paciente archivada: no aparece en las listas por defecto, pero su historial médico se
          conserva intacto.
        </div>
      )}

      {exportError && <ErrorBanner message={exportError} />}

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

      <div className="section">
        <h2 className="section-title">Pruebas de proteinuria</h2>
        {proteinuriaError ? (
          <p className="field-error">
            <span className="field-msg">{proteinuriaError}</span>
          </p>
        ) : proteinuriaTests.length === 0 ? (
          <p className="cell-sub">
            Sin pruebas de proteinuria registradas desde la app móvil.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha y hora (Bolivia)</th>
                  <th>Resultado</th>
                  <th>Foto</th>
                </tr>
              </thead>
              <tbody>
                {proteinuriaTests.map((test) => {
                  const info = proteinuriaResultInfo(test.result)
                  const url = proteinuriaPhotoUrls[test.id]
                  return (
                    <tr key={test.id}>
                      <td className="cell-sub">
                        {formatBoliviaDateTime(test.recorded_at)}
                      </td>
                      <td>
                        <div className="cell-main">
                          {info.label}
                          <span
                            className={`badge ${test.is_positive ? 'badge-danger' : 'badge-success'}`}
                            style={{ marginLeft: 8 }}
                          >
                            {test.is_positive ? 'Positivo' : 'Negativo'}
                          </span>
                        </div>
                        {info.description && (
                          <div className="cell-sub">{info.description}</div>
                        )}
                      </td>
                      <td>
                        {url ? (
                          <button
                            type="button"
                            className="proteinuria-thumb"
                            onClick={() =>
                              setLightbox({
                                url,
                                label: info.label,
                                recordedAt: test.recorded_at,
                              })
                            }
                            title="Ampliar foto de la tira"
                            aria-label="Ampliar foto de la tira"
                          >
                            <img
                              src={url}
                              alt={`Foto de proteinuria ${info.label}`}
                            />
                          </button>
                        ) : (
                          <span
                            className="proteinuria-thumb proteinuria-thumb-empty"
                            title="Foto no disponible"
                          >
                            <ImageOff size={20} />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmArchiveOpen}
        onClose={() => !archiving && setConfirmArchiveOpen(false)}
        onConfirm={archivePatient}
        confirmLabel="Archivar"
        loading={archiving}
        title="Archivar paciente"
        message={`¿Archivar a ${patient.full_name}? Dejará de aparecer en las listas por defecto, pero su historial médico se conserva intacto y podrás reactivarla desde el filtro "Ver archivadas".`}
      />

      <Modal
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
        title="Foto de la tira de proteinuria"
      >
        {lightbox && (
          <>
            <div style={{ textAlign: 'center' }}>
              <img
                src={lightbox.url}
                alt={`Foto de proteinuria ${lightbox.label}`}
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
            <p className="cell-sub" style={{ textAlign: 'center', marginTop: 10 }}>
              {lightbox.label} · {formatBoliviaDateTime(lightbox.recordedAt)}
            </p>
          </>
        )}
      </Modal>
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