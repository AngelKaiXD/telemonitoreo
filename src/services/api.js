import { supabase } from './supabaseClient'

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getCurrentProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, patient_id, doctor_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

// ── Patients ─────────────────────────────────────────────────────────────────

const PATIENT_COLUMNS =
  'id, full_name, document_id, age, gestation_weeks, height_cm, weight_kg, altitude, has_hypertension_history, has_preeclampsia_history, is_single, has_multiple_pregnancy, is_nulliparous, has_pregestational_diabetes, has_chronic_hypertension, has_renal_disease, has_lupus, has_antiphospholipid_syndrome, has_abnormal_pregnancy_interval, has_family_preeclampsia_history, has_assisted_reproduction, clinical_history_number, birth_date, phone, address, link_code, is_active, created_at'

/**
 * Pacientes visibles para el rol autenticado. Por defecto excluye las
 * archivadas (`is_active = true`); con `includeArchived` devuelve todas.
 */
export async function fetchPatients({ includeArchived = false } = {}) {
  let query = supabase.from('patients').select(PATIENT_COLUMNS)
  if (!includeArchived) query = query.eq('is_active', true)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchPatientById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createPatient(row) {
  const { data, error } = await supabase
    .from('patients')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(id, patch) {
  const { data, error } = await supabase
    .from('patients')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Doctor-Patient assignments ───────────────────────────────────────────────

export async function assignPatientToDoctor(doctorId, patientId) {
  const { error } = await supabase
    .from('doctor_patients')
    .upsert(
      { doctor_id: doctorId, patient_id: patientId },
      { onConflict: 'doctor_id,patient_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

/**
 * Asignaciones paciente-doctor visibles para el rol autenticado (la RLS solo
 * expone las que corresponden: el Admin ve todas, el Doctor las propias).
 */
export async function fetchDoctorAssignments() {
  const { data, error } = await supabase
    .from('doctor_patients')
    .select('doctor_id, patient_id, doctors(first_name, last_name)')
  if (error) throw error
  return data ?? []
}

// ── Doctors ──────────────────────────────────────────────────────────────────

export async function fetchDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select(
      'id, first_name, last_name, specialty, hospital_name, phone, email, license_number, created_at',
    )
    .order('first_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchDoctorById(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('doctors')
    .select(
      'id, first_name, last_name, specialty, hospital_name, phone, email, license_number, created_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Crea la cuenta de acceso de un doctor y su fila enlazada, delegando a la
 * Vercel Function `/api/invite-doctor` (la service_role key nunca vive en el
 * navegador). Envía el access_token de la sesión actual para que el backend
 * verifique que el llamador es un administrador.
 */
export async function inviteDoctor(doctor, redirectTo = undefined) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const res = await fetch('/api/invite-doctor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ ...doctor, redirectTo }),
  })
  let payload = {}
  try {
    payload = await res.json()
  } catch {
    /* respuesta no-JSON (p. ej. dev server sin la función) */
  }
  if (!res.ok) {
    throw new Error(payload?.error || `No se pudo invitar al doctor (HTTP ${res.status}).`)
  }
  return payload.doctor
}

export async function updateDoctor(id, patch) {
  const { data, error } = await supabase
    .from('doctors')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Pacientes asignadas a un doctor en `doctor_patients` (el Admin ve todas por RLS). */
export async function countPatientsByDoctor(doctorId) {
  const { count, error } = await supabase
    .from('doctor_patients')
    .select('patient_id', { count: 'exact', head: true })
    .eq('doctor_id', doctorId)
  if (error) throw error
  return count ?? 0
}

export async function deleteDoctor(id) {
  const { error } = await supabase.from('doctors').delete().eq('id', id)
  if (error) throw error
}

// ── Vital readings ───────────────────────────────────────────────────────────

const READING_COLUMNS =
  'id, patient_id, recorded_at, systolic, diastolic, heart_rate, glucose, stress, physical_activity, salt_consumption, prenatal_control, has_background, altitude, risk_level, diagnosis, observations, source'

/**
 * Lecturas de vital_readings con nombre de paciente embebido.
 * La RLS administra la visibilidad; el embed patients(full_name) falla si la
 * paciente no es visible, pero en el contexto Doctor/Admin siempre lo es.
 */
export async function fetchVitalReadingsByPatient(patientId, { limit } = {}) {
  let query = supabase
    .from('vital_readings')
    .select(READING_COLUMNS)
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Todas las lecturas visibles para el rol autenticado (doctor solo las de
 * sus pacientes; admin las de todos). Usado para el dashboard y filtros.
 * Incluye nombre de paciente via embed.
 *
 * Se pagina con `.range()` porque Supabase trunca en silencio cada respuesta
 * a 1000 filas (db-max-rows): sin paginar, solo se veían las 1000 lecturas
 * más recientes y las pacientes con lecturas más antiguas no aparecían en
 * agregados como la barra de Distribución PA ("Sin medición reciente").
 */
export async function fetchAllVitalReadings() {
  const PAGE_SIZE = 1000
  const all = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('vital_readings')
      .select(`${READING_COLUMNS}, patients!inner(full_name)`)
      .order('recorded_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

/**
 * Última medición de cada paciente visible, con nombre de paciente embebido.
 * Usado para el dashboard (fuera de rango, actividad reciente).
 */
export async function fetchLatestMeasurements() {
  const { data, error } = await supabase
    .from('latest_measurement')
    .select('patient_id, systolic, diastolic, pulse, source, recorded_at, patients!inner(full_name)')
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Proteinuria ───────────────────────────────────────────────────────────────

const PROTEINURIA_COLUMNS =
  'id, patient_id, recorded_at, photo_path, result, is_positive, recorded_by'

/**
 * Pruebas de proteinuria de una paciente (más recientes primero). Solo lectura:
 * la captura se hace exclusivamente desde la app móvil (Fase 30).
 */
export async function fetchProteinuriaTests(patientId) {
  if (!patientId) return []
  const { data, error } = await supabase
    .from('proteinuria_tests')
    .select(PROTEINURIA_COLUMNS)
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * URL firmada temporal de una foto en el bucket privado `proteinuria-photos`
 * (no se expone el bucket como público). Con 300 s de vigencia basta para la
 * vista de detalle; las miniaturas se cargan al abrir la página.
 */
export async function fetchProteinuriaPhotoUrl(
  photoPath,
  expiresInSeconds = 300,
) {
  const { data, error } = await supabase.storage
    .from('proteinuria-photos')
    .createSignedUrl(photoPath, expiresInSeconds)
  if (error) throw error
  return data?.signedUrl ?? null
}