import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  HeartPulse,
  Ruler,
  Save,
  Scale,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
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

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-track" />
      </label>
    </div>
  )
}

/** Indicador calculado por el sistema: no es un campo editable. */
function Chip({ icon: Icon, label, helper, active = false }) {
  return (
    <div className={`form-chip${active ? ' form-chip-warning' : ''}`}>
      <Icon size={16} />
      <div className="form-chip-text">
        <strong>{label}</strong>
        <span className="form-chip-helper">{helper}</span>
      </div>
    </div>
  )
}

function FormSection({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="card form-section">
      <div className="form-section-head">
        <span className="form-section-icon">
          <Icon size={22} />
        </span>
        <div>
          <h3>{title}</h3>
          <span className="form-section-subtitle">{subtitle}</span>
        </div>
      </div>
      <div className="form-grid">{children}</div>
    </section>
  )
}

const EXTREME_AGE_THRESHOLDS = { maxTeen: 18, maxMaternal: 35 }

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
    clinical_history_number: '',
    age: '',
    birth_date: '',
    gestation_weeks: '',
    height_cm: '',
    weight_kg: '',
    altitude: '4000',
    phone: '',
    address: '',
    is_single: false,
    has_hypertension_history: false,
    has_chronic_hypertension: false,
    has_multiple_pregnancy: false,
    has_pregestational_diabetes: false,
    has_renal_disease: false,
    has_lupus: false,
    has_antiphospholipid_syndrome: false,
    is_nulliparous: false,
    has_abnormal_pregnancy_interval: false,
    has_preeclampsia_history: false,
    has_family_preeclampsia_history: false,
    has_assisted_reproduction: false,
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
          clinical_history_number: row.clinical_history_number ?? '',
          age: row.age != null ? String(row.age) : '',
          birth_date: row.birth_date ?? '',
          gestation_weeks:
            row.gestation_weeks != null ? String(row.gestation_weeks) : '',
          height_cm: row.height_cm != null ? String(row.height_cm) : '',
          weight_kg: row.weight_kg != null ? String(row.weight_kg) : '',
          altitude: row.altitude != null ? String(row.altitude) : '4000',
          phone: row.phone ?? '',
          address: row.address ?? '',
          is_single: Boolean(row.is_single),
          has_hypertension_history: Boolean(row.has_hypertension_history),
          has_chronic_hypertension: Boolean(row.has_chronic_hypertension),
          has_multiple_pregnancy: Boolean(row.has_multiple_pregnancy),
          has_pregestational_diabetes: Boolean(
            row.has_pregestational_diabetes,
          ),
          has_renal_disease: Boolean(row.has_renal_disease),
          has_lupus: Boolean(row.has_lupus),
          has_antiphospholipid_syndrome: Boolean(
            row.has_antiphospholipid_syndrome,
          ),
          is_nulliparous: Boolean(row.is_nulliparous),
          has_abnormal_pregnancy_interval: Boolean(
            row.has_abnormal_pregnancy_interval,
          ),
          has_preeclampsia_history: Boolean(row.has_preeclampsia_history),
          has_family_preeclampsia_history: Boolean(
            row.has_family_preeclampsia_history,
          ),
          has_assisted_reproduction: Boolean(row.has_assisted_reproduction),
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

  const ageNumber = Number(form.age)
  const extremeAge =
    form.age.trim() !== '' &&
    Number.isInteger(ageNumber) &&
    (ageNumber < EXTREME_AGE_THRESHOLDS.maxTeen ||
      ageNumber > EXTREME_AGE_THRESHOLDS.maxMaternal)
  const obese = imc != null && imc >= 30

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
        clinical_history_number: form.clinical_history_number.trim() || null,
        age: Number(form.age),
        birth_date: form.birth_date || null,
        gestation_weeks: Number(form.gestation_weeks),
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        altitude: Number(form.altitude),
        is_single: form.is_single,
        has_hypertension_history: form.has_hypertension_history,
        has_chronic_hypertension: form.has_chronic_hypertension,
        has_multiple_pregnancy: form.has_multiple_pregnancy,
        has_pregestational_diabetes: form.has_pregestational_diabetes,
        has_renal_disease: form.has_renal_disease,
        has_lupus: form.has_lupus,
        has_antiphospholipid_syndrome: form.has_antiphospholipid_syndrome,
        is_nulliparous: form.is_nulliparous,
        has_abnormal_pregnancy_interval: form.has_abnormal_pregnancy_interval,
        has_preeclampsia_history: form.has_preeclampsia_history,
        has_family_preeclampsia_history: form.has_family_preeclampsia_history,
        has_assisted_reproduction: form.has_assisted_reproduction,
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

      <form onSubmit={handleSubmit}>
        <FormSection
          icon={UserRound}
          title="Datos personales"
          subtitle="Identificación de la gestante"
        >
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
              <label htmlFor="clinical_history_number">
                N.º de historia clínica (opcional)
              </label>
              <input
                id="clinical_history_number"
                value={form.clinical_history_number}
                onChange={(e) =>
                  setField('clinical_history_number', e.target.value)
                }
              />
            </div>
          </div>

          <div className="form-row">
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
            <div className="field">
              <label htmlFor="birth_date">Fecha de nacimiento (opcional)</label>
              <input
                id="birth_date"
                type="date"
                value={form.birth_date}
                onChange={(e) => setField('birth_date', e.target.value)}
              />
            </div>
          </div>

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

          <ToggleRow
            label="Estado civil: soltera"
            checked={form.is_single}
            onChange={(checked) => setField('is_single', checked)}
          />
        </FormSection>

        <FormSection
          icon={Ruler}
          title="Parámetros antropométricos"
          subtitle="Peso y talla de la gestante"
        >
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

          <Chip
            icon={Scale}
            label={imc != null ? `IMC ${imc.toFixed(1)}` : 'IMC pendiente'}
            helper={
              imc == null
                ? 'Se calcula al registrar peso y talla'
                : obese
                  ? 'Obesidad (IMC ≥ 30)'
                  : 'Peso normal / sobrepeso'
            }
            active={obese}
          />
        </FormSection>

        <FormSection
          icon={HeartPulse}
          title="Parámetros clínicos"
          subtitle="Datos del embarazo actual"
        >
          <div className="form-row">
            <div className="field">
              <label htmlFor="gestation_weeks">Semanas de gestación</label>
              <input
                id="gestation_weeks"
                type="number"
                min="0"
                value={form.gestation_weeks}
                onChange={(e) =>
                  setField('gestation_weeks', e.target.value)
                }
              />
              {fieldErrors.gestation_weeks && (
                <span className="field-msg">
                  {fieldErrors.gestation_weeks}
                </span>
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
        </FormSection>

        <FormSection
          icon={TriangleAlert}
          title="Factores de riesgo alto"
          subtitle="Cualquier factor positivo clasifica como alto riesgo"
        >
          <ToggleRow
            label="Hipertensión en embarazo anterior"
            checked={form.has_hypertension_history}
            onChange={(checked) =>
              setField('has_hypertension_history', checked)
            }
          />
          <ToggleRow
            label="Hipertensión crónica preexistente"
            checked={form.has_chronic_hypertension}
            onChange={(checked) =>
              setField('has_chronic_hypertension', checked)
            }
          />
          <ToggleRow
            label="Embarazo múltiple"
            checked={form.has_multiple_pregnancy}
            onChange={(checked) =>
              setField('has_multiple_pregnancy', checked)
            }
          />
          <ToggleRow
            label="Diabetes"
            checked={form.has_pregestational_diabetes}
            onChange={(checked) =>
              setField('has_pregestational_diabetes', checked)
            }
          />
          <ToggleRow
            label="Enfermedad renal"
            checked={form.has_renal_disease}
            onChange={(checked) => setField('has_renal_disease', checked)}
          />
          <ToggleRow
            label="Lupus eritematoso sistémico"
            checked={form.has_lupus}
            onChange={(checked) => setField('has_lupus', checked)}
          />
          <ToggleRow
            label="Síndrome antifosfolípido"
            checked={form.has_antiphospholipid_syndrome}
            onChange={(checked) =>
              setField('has_antiphospholipid_syndrome', checked)
            }
          />
        </FormSection>

        <FormSection
          icon={Scale}
          title="Factores de riesgo moderado"
          subtitle="Marcados automáticamente cuando aplican"
        >
          <ToggleRow
            label="Nuliparidad (primer embarazo)"
            checked={form.is_nulliparous}
            onChange={(checked) => setField('is_nulliparous', checked)}
          />
          <Chip
            icon={TriangleAlert}
            label="Edad materna extrema"
            helper={
              form.age.trim() === ''
                ? 'Requiere edad'
                : extremeAge
                  ? `Presente (${form.age} años)`
                  : `No presente (${form.age} años)`
            }
            active={extremeAge}
          />
          <Chip
            icon={TriangleAlert}
            label="Obesidad (IMC ≥ 30)"
            helper={
              imc == null
                ? 'Requiere peso y talla'
                : obese
                  ? `Presente (IMC ${imc.toFixed(1)})`
                  : `No presente (IMC ${imc.toFixed(1)})`
            }
            active={obese}
          />
          <ToggleRow
            label="Intervalo intergenésico anormal"
            checked={form.has_abnormal_pregnancy_interval}
            onChange={(checked) =>
              setField('has_abnormal_pregnancy_interval', checked)
            }
          />
        </FormSection>

        <FormSection
          icon={ClipboardList}
          title="Otros factores de riesgo"
          subtitle="Antecedentes personales y familiares"
        >
          <ToggleRow
            label="Antecedente de preeclampsia / eclampsia"
            checked={form.has_preeclampsia_history}
            onChange={(checked) =>
              setField('has_preeclampsia_history', checked)
            }
          />
          <ToggleRow
            label="Antecedentes familiares de preeclampsia"
            checked={form.has_family_preeclampsia_history}
            onChange={(checked) =>
              setField('has_family_preeclampsia_history', checked)
            }
          />
          <ToggleRow
            label="Fecundación asistida (TRA)"
            checked={form.has_assisted_reproduction}
            onChange={(checked) =>
              setField('has_assisted_reproduction', checked)
            }
          />
        </FormSection>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
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