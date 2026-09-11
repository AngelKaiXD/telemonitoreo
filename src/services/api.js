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
  'id, full_name, document_id, age, gestation_weeks, height_cm, weight_kg, altitude, has_hypertension_history, has_preeclampsia_history, is_single, has_multiple_pregnancy, is_nulliparous, has_pregestational_diabetes, phone, address, link_code, created_at'

export async function fetchPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLUMNS)
    .order('created_at', { ascending: false })
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

export async function createDoctor(row) {
  const { data, error } = await supabase
    .from('doctors')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data
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
 */
export async function fetchAllVitalReadings() {
  const { data, error } = await supabase
    .from('vital_readings')
    .select(
      `${READING_COLUMNS}, patients!inner(full_name)`,
    )
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return data ?? []
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