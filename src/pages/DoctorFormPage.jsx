import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MailCheck, Save, UserPlus } from 'lucide-react'
import {
  fetchDoctorById,
  inviteDoctor,
  updateDoctor,
} from '../services/api'
import { toUserMessage } from '../services/errors'
import { ErrorBanner, Spinner } from '../components/ui/Feedback'

function uuidv4() {
  return crypto.randomUUID()
}

export default function DoctorFormPage() {
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [createdEmail, setCreatedEmail] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    specialty: '',
    hospital_name: '',
    phone: '',
    email: '',
    license_number: '',
  })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const row = await fetchDoctorById(id)
        if (cancelled) return
        if (!row) {
          setError('El doctor no existe o no tienes permiso para verlo.')
          return
        }
        setForm({
          first_name: row.first_name ?? '',
          last_name: row.last_name ?? '',
          specialty: row.specialty ?? '',
          hospital_name: row.hospital_name ?? '',
          phone: row.phone ?? '',
          email: row.email ?? '',
          license_number: row.license_number ?? '',
        })
      } catch (loadError) {
        if (!cancelled) {
          setError(toUserMessage(loadError, 'No se pudo cargar el doctor.'))
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

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const errors = {}
    const required = ['first_name', 'last_name', 'specialty', 'hospital_name']
    if (!isEditing) required.push('email')
    for (const key of required) {
      if (!form[key].trim()) errors[key] = 'Campo requerido'
    }
    if (form.email.trim() && !form.email.includes('@')) {
      errors.email = 'Email inválido'
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
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        specialty: form.specialty.trim(),
        hospital_name: form.hospital_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        license_number: form.license_number.trim() || null,
      }
      if (isEditing) {
        await updateDoctor(id, shared)
        navigate('/doctores', { replace: true })
      } else {
        const doctor = await inviteDoctor({
          ...shared,
          id: uuidv4(),
          created_at: new Date().toISOString(),
        })
        setCreatedEmail(doctor?.email ?? shared.email)
      }
    } catch (saveError) {
      setError(toUserMessage(saveError, 'No se pudo guardar el doctor.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="section" style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
        <Spinner size={32} />
      </div>
    )
  }

  if (createdEmail) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="page-header">
          <h1>Registrar doctor</h1>
          <Link className="btn btn-outline" to="/doctores">
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
        <div className="card" style={{ textAlign: 'center', gap: 12 }}>
          <MailCheck size={40} style={{ color: 'var(--muted)' }} />
          <h2 style={{ margin: 0 }}>Invitación enviada</h2>
          <p>
            Se envió una invitación por correo a <strong>{createdEmail}</strong> para que configure
            su acceso. No se comparte ninguna contraseña: el doctor define la suya desde el correo
            que reciba.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setCreatedEmail(null)
                setForm({
                  first_name: '',
                  last_name: '',
                  specialty: '',
                  hospital_name: '',
                  phone: '',
                  email: '',
                  license_number: '',
                })
              }}
            >
              <UserPlus size={16} />
              Registrar otro doctor
            </button>
            <Link className="btn btn-primary" to="/doctores">
              Ver listado
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1>{isEditing ? 'Editar doctor' : 'Registrar doctor'}</h1>
        <Link className="btn btn-outline" to="/doctores">
          <ArrowLeft size={16} />
          Volver al listado
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-row">
            <div className="field">
              <label htmlFor="first_name">Nombres</label>
              <input
                id="first_name"
                value={form.first_name}
                onChange={(e) => setField('first_name', e.target.value)}
              />
              {fieldErrors.first_name && (
                <span className="field-msg">{fieldErrors.first_name}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="last_name">Apellidos</label>
              <input
                id="last_name"
                value={form.last_name}
                onChange={(e) => setField('last_name', e.target.value)}
              />
              {fieldErrors.last_name && (
                <span className="field-msg">{fieldErrors.last_name}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="specialty">Especialidad</label>
              <input
                id="specialty"
                value={form.specialty}
                onChange={(e) => setField('specialty', e.target.value)}
              />
              {fieldErrors.specialty && (
                <span className="field-msg">{fieldErrors.specialty}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="hospital_name">Nombre del hospital</label>
              <input
                id="hospital_name"
                value={form.hospital_name}
                onChange={(e) => setField('hospital_name', e.target.value)}
              />
              {fieldErrors.hospital_name && (
                <span className="field-msg">{fieldErrors.hospital_name}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="license_number">Cédula / Número de licencia (opcional)</label>
              <input
                id="license_number"
                value={form.license_number}
                onChange={(e) => setField('license_number', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Teléfono (opcional)</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">
              {isEditing ? 'Correo electrónico (opcional)' : 'Correo electrónico'}
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
            />
            {fieldErrors.email && (
              <span className="field-msg">{fieldErrors.email}</span>
            )}
            {!isEditing && !fieldErrors.email && (
              <span className="field-hint">
                Se enviará una invitación a este correo para que el doctor configure su acceso.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="btn btn-outline" type="button" onClick={() => navigate('/doctores')}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <Spinner size={16} /> : <Save size={16} />}
              {isEditing ? 'Actualizar doctor' : 'Enviar invitación'}
            </button>
          </div>
        </div>
      </form>

      {isEditing && (
        <p className="field-hint" style={{ marginTop: 12 }}>
          Nota: si la edición no se guarda, es probable que la base de datos aún
          no tenga la policy de actualización para doctores. Revisa las
          instrucciones del reporte de despliegue.
        </p>
      )}
    </div>
  )
}