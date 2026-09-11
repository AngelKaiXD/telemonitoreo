import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, Save } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  assignPatientToDoctor,
  createPatient,
  fetchPatientById,
  updatePatient,
} from '../services/api'
import { toUserMessage } from '../services/errors'
import { generateLinkCode } from '../utils/linkCode'
import { ErrorBanner, Spinner } from '../components/ui/Feedback'
import Modal from '../components/ui/Modal'

function uuidv4() {
  return crypto.randomUUID()
}

const TOGGLE_FIELDS = [
  { key: 'has_hypertension_history', label: 'Antecedente de hipertensión' },
  { key: 'has_preeclampsia_history', label: 'Antecedente de preeclampsia' },
  { key: 'is_single', label: 'Estado civil: soltera' },
  { key: 'has_multiple_pregnancy', label: 'Embarazo gemelar o múltiple' },
  { key: 'is_nulliparous', label: 'Primigravidez / nuliparidad' },
  { key: 'has_pregestational_diabetes', label: 'Diabetes pregestacional' },
]

export default function PatientFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [linkCodeModal, setLinkCodeModal] = useState(null)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    document_id: '',
    age: '',
    gestation_weeks: '',
    height_cm: '',
    weight_kg: '',
    altitude: '4000',
    phone: '',
    address: '',
    has_hypertension_history: false,
    has_preeclampsia_history: false,
    is_single: false,
    has_multiple_pregnancy: false,
    is_nulliparous: false,
    has_pregestational_diabetes: false,
  })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const row = await fetchPatientById(id)
        if (cancelled) return
        if (!row) {
          setError('La paciente no existe o no tienes permiso para verla.')
          return
        }
        setForm({
          full_name: row.full_name ?? '',
          document_id: row.document_id ?? '',
          age: row.age != null ? String(row.age) : '',
          gestation_weeks:
            row.gestation_weeks != null ? String(row.gestation_weeks) : '',
          height_cm: row.height_cm != null ? String(row.height_cm) : '',
          weight_kg: row.weight_kg != null ? String(row.weight_kg) : '',
          altitude: row.altitude != null ? String(row.altitude) : '4000',
          phone: row.phone ?? '',
          address: row.address ?? '',
          has_hypertension_history: Boolean(row.has_hypertension_history),
          has_preeclampsia_history: Boolean(row.has_preeclampsia_history),
          is_single: Boolean(row.is_single),
          has_multiple_pregnancy: Boolean(row.has_multiple_pregnancy),
          is_nulliparous: Boolean(row.is_nulliparous),
          has_pregestational_diabetes: Boolean(
            row.has_pregestational_diabetes,
          ),
        })
      } catch (loadError) {
        if (!cancelled) {
          setError(
            toUserMessage(loadError, 'No se pudo cargar la paciente.'),
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

  const imc = useMemo(() => {
    const height = Number(form.height_cm)
    const weight = Number(form.weight_kg)
    if (!height || !weight || height <= 0) return null
    return weight / Math.pow(height / 100, 2)
  }, [form.height_cm, form.weight_kg])

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const errors = {}
    if (!form.full_name.trim()) errors.full_name = 'Campo requerido'
    if (!form.document_id.trim()) errors.document_id = 'Campo requerido'
    const integers = ['age', 'gestation_weeks', 'altitude']
    const decimals = ['height_cm', 'weight_kg']
    for (const key of integers) {
      const value = Number(form[key])
      if (!form[key].trim() || !Number.isInteger(value)) {
        errors[key] = 'Campo requerido, número entero'
      }
    }
    for (const key of decimals) {
      const value = Number(form[key])
      if (!form[key].trim() || !Number.isFinite(value)) {
        errors[key] = 'Campo requerido, número válido'
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (!validate()) return
    setSaving(true)
    try {
      const shared = {
        full_name: form.full_name.trim(),
        document_id: form.document_id.trim(),
        age: Number(form.age),
        gestation_weeks: Number(form.gestation_weeks),
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        altitude: Number(form.altitude),
        has_hypertension_history: form.has_hypertension_history,
        has_preeclampsia_history: form.has_preeclampsia_history,
        is_single: form.is_single,
        has_multiple_pregnancy: form.has_multiple_pregnancy,
        is_nulliparous: form.is_nulliparous,
        has_pregestational_diabetes: form.has_pregestational_diabetes,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      }

      if (isEditing) {
        await updatePatient(id, shared)
        navigate(`/pacientes/${id}`, { replace: true })
        return
      }

      const linkCode = generateLinkCode()
      const row = {
        ...shared,
        id: uuidv4(),
        link_code: linkCode,
        created_at: new Date().toISOString(),
      }
      const created = await createPatient(row)

      if (profile?.doctor_id) {
        try {
          await assignPatientToDoctor(profile.doctor_id, created.id)
        } catch {
          // La paciente ya quedó creada; la asignación se intenta de nuevo
          // desde la app móvil o el panel. No se bloquea la creación.
        }
      }

      setLinkCodeModal(linkCode)
    } catch (saveError) {
      setError(
        toUserMessage(saveError, 'No se pudo guardar la paciente.'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function copyCode() {
    if (!linkCodeModal) return
    try {
      await navigator.clipboard.writeText(linkCodeModal)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (loading) {
    return (
      <div className="section" style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header">
        <h1>{isEditing ? 'Editar paciente' : 'Registrar paciente'}</h1>
        <Link
          className="btn btn-outline"
          to={isEditing ? `/pacientes/${id}` : '/pacientes'}
        >
          <ArrowLeft size={16} />
          {isEditing ? 'Volver al detalle' : 'Volver al listado'}
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="full_name">Nombre completo</label>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)}
            />
            {fieldErrors.full_name && (
              <span className="field-msg">{fieldErrors.full_name}</span>
            )}
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="document_id">Documento / CI</label>
              <input
                id="document_id"
                value={form.document_id}
                onChange={(e) => setField('document_id', e.target.value)}
              />
              {fieldErrors.document_id && (
                <span className="field-msg">{fieldErrors.document_id}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="age">Edad</label>
              <input
                id="age"
                type="number"
                min="0"
                value={form.age}
                onChange={(e) => setField('age', e.target.value)}
              />
              {fieldErrors.age && (
                <span className="field-msg">{fieldErrors.age}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="gestation_weeks">Semanas de gestación</label>
              <input
                id="gestation_weeks"
                type="number"
                min="0"
                value={form.gestation_weeks}
                onChange={(e) => setField('gestation_weeks', e.target.value)}
              />
              {fieldErrors.gestation_weeks && (
                <span className="field-msg">{fieldErrors.gestation_weeks}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="altitude">Altitud (msnm)</label>
              <input
                id="altitude"
                type="number"
                value={form.altitude}
                onChange={(e) => setField('altitude', e.target.value)}
              />
              {fieldErrors.altitude && (
                <span className="field-msg">{fieldErrors.altitude}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="height_cm">Talla (cm)</label>
              <input
                id="height_cm"
                type="number"
                step="0.1"
                min="0"
                value={form.height_cm}
                onChange={(e) => setField('height_cm', e.target.value)}
              />
              {fieldErrors.height_cm && (
                <span className="field-msg">{fieldErrors.height_cm}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="weight_kg">Peso (kg)</label>
              <input
                id="weight_kg"
                type="number"
                step="0.1"
                min="0"
                value={form.weight_kg}
                onChange={(e) => setField('weight_kg', e.target.value)}
              />
              {fieldErrors.weight_kg && (
                <span className="field-msg">{fieldErrors.weight_kg}</span>
              )}
            </div>
          </div>

          {imc != null && (
            <p className="field-hint" style={{ margin: 0 }}>
              IMC calculado: {imc.toFixed(1)}
            </p>
          )}

          <div className="form-row">
            <div className="field">
              <label htmlFor="phone">Teléfono (opcional)</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="address">Dirección (opcional)</label>
              <input
                id="address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </div>
          </div>

          <div className="card" style={{ marginTop: 8 }}>
            <div className="card-header">
              <h3>Antecedentes y condiciones</h3>
            </div>
            {TOGGLE_FIELDS.map(({ key, label }) => (
              <div className="toggle-row" key={key}>
                <span className="toggle-label">{label}</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setField(key, e.target.checked)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() =>
                navigate(isEditing ? `/pacientes/${id}` : '/pacientes')
              }
            >
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <Spinner size={16} /> : <Save size={16} />}
              {isEditing ? 'Actualizar paciente' : 'Guardar paciente'}
            </button>
          </div>
        </div>
      </form>

      <Modal
        open={linkCodeModal !== null}
        onClose={() => navigate('/pacientes', { replace: true })}
        title="Código de vinculación"
      >
        <p>
          Entrega este código a la paciente en persona. No se envía por ningún
          canal automático. La paciente lo usará desde la app móvil para
          vincular su perfil.
        </p>
        <div
          style={{
            textAlign: 'center',
            padding: '16px',
            background: 'var(--surface-alt)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: 8,
              color: 'var(--primary-dark)',
            }}
          >
            {linkCodeModal}
          </span>
        </div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={copyCode}>
            <Copy size={16} />
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/pacientes', { replace: true })}
          >
            Listo
          </button>
        </div>
      </Modal>
    </div>
  )
}