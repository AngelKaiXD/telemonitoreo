import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { fetchVitalReadingsByPatient } from './api'
import { sourceLabel, sustainedHtnByReading, toUtcInstant } from '../utils/clinical'

// ─── Textos y encabezados (espejo exacto de lib/reports/report_service.dart) ──

const GENERAL_HEADERS = [
  'N.º',
  'Nombre',
  'Carnet de identidad',
  'Edad',
  'Semanas de gestación',
  'Talla (m)',
  'Peso (kg)',
  'IMC',
  'Estado civil',
  'Antecedente de hipertensión',
  'Antecedente de preeclampsia',
  'Embarazo gemelar o múltiple',
  'Nuliparidad',
  'Diabetes pregestacional',
  'Presión arterial sistólica (mmHg)',
  'Presión arterial diastólica (mmHg)',
  'Riesgo de preeclampsia',
]

const READING_HEADERS = [
  'Fecha',
  'Presion',
  'Pulso',
  'Glucosa',
  'Estres',
  'Act. fisica',
  'Sal',
  'Ctrl. prenatal',
  'Antecedente',
  'Riesgo',
  'Diagnostico',
  'Fuente',
  'Observaciones',
]

/**
 * Historial completo: una fila por medición, con el perfil de la paciente
 * repetido en cada fila. Estructura de referencia del usuario + columna
 * `Fecha` (recorded_at en hora Bolivia) para distinguir mediciones repetidas.
 */
const HISTORY_HEADERS = [
  'N.º',
  'Fecha',
  'Nombre',
  'Carnet de identidad',
  'Edad',
  'Semanas de gestación',
  'Talla (m)',
  'Peso (kg)',
  'IMC',
  'Estado civil',
  'Antecedente de hipertensión',
  'Antecedente de preeclampsia',
  'Embarazo gemelar o múltiple',
  'Nuliparidad',
  'Diabetes pregestacional',
  'Presión arterial sistólica (mmHg)',
  'Presión arterial diastólica (mmHg)',
  'Presión sostenida',
  'Riesgo de preeclampsia',
]

const RISK_TITLES = {
  none: 'SIN RIESGO APARENTE',
  mild: 'RIESGO LEVE - HIPERTENSION GESTACIONAL',
  moderate: 'RIESGO MODERADO - POSIBLE PREECLAMPSIA',
  high: 'RIESGO ALTO - POSIBLE ECLAMPSIA',
}

const GENERAL_TITLE = 'Reporte general de pacientes'
const INDIVIDUAL_TITLE = 'Reporte clinico por paciente'
const FULL_HISTORY_TITLE = 'Historial completo de pacientes'
const SUBTITLE = 'Sistema de telemonitorizacion medica'
const REPORT_NOTE =
  'Nota: reporte generado para seguimiento clinico. No reemplaza valoracion medica presencial ante signos de alarma.'

const BOLIVIA_OFFSET_HOURS = -4

function riskTitle(level) {
  return RISK_TITLES[level] ?? RISK_TITLES.none
}

// ─── Formateadores (mismo criterio que la app móvil) ─────────────────────────

/** Talla en metros: "1.55". Devuelve '-' si no es positiva. */
function heightInMeters(heightCm) {
  const cm = Number(heightCm)
  if (!Number.isFinite(cm) || cm <= 0) return '-'
  const meters = cm / 100
  let value = meters.toFixed(2).replace(/0+$/, '')
  if (value.endsWith('.')) value = `${value}0`
  return value
}

/** Evita decimales artificiales en valores enteros (70.0 -> "70"). */
function trimZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : '-'
}

/** IMC = peso / (talla en metros)², con un decimal (getter Patient.imc). */
function imcOf(patient) {
  const heightCm = Number(patient.height_cm)
  const weightKg = Number(patient.weight_kg)
  const heightM = heightCm / 100
  if (!Number.isFinite(heightM) || heightM <= 0) return '0.0'
  return (weightKg / (heightM * heightM)).toFixed(1)
}

function maritalStatus(isSingle) {
  return isSingle ? 'Soltera' : 'Casada/Unión libre'
}

function yesNo(value) {
  return value ? 'Sí' : 'No'
}

function glucoseText(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return Number.isInteger(number) ? number.toFixed(1) : String(number)
}

function bloodPressure(systolic, diastolic) {
  return `${systolic}/${diastolic} mmHg`
}

// ─── Fechas en hora de Bolivia (UTC-4 fijo) ─────────────────────────────────

/** Reloj de pared de Bolivia como fecha normalizada (leer con getUTC*). */
function boliviaWallClock(value) {
  const instant = toUtcInstant(value)
  if (!instant) return null
  return new Date(instant.getTime() + BOLIVIA_OFFSET_HOURS * 3600000)
}

const twoDigits = (value) => String(value).padStart(2, '0')

/** Formato de reporte: "13/08/2026 14:35" (hora Bolivia). */
export function formatBoliviaReport(value) {
  const wall = boliviaWallClock(value)
  if (!wall) return '-'
  return (
    `${twoDigits(wall.getUTCDate())}/${twoDigits(wall.getUTCMonth() + 1)}/` +
    `${wall.getUTCFullYear()} ${twoDigits(wall.getUTCHours())}:${twoDigits(wall.getUTCMinutes())}`
  )
}

// ─── Filas de datos (mismas que la app móvil) ───────────────────────────────

function buildGeneralRows(patients, latestByPatient) {
  return patients.map((patient, index) => {
    const latest = latestByPatient[patient.id] ?? null
    return [
      `${index + 1}`,
      patient.full_name,
      patient.document_id,
      `${patient.age}`,
      `${patient.gestation_weeks}`,
      heightInMeters(patient.height_cm),
      trimZero(patient.weight_kg),
      imcOf(patient),
      maritalStatus(patient.is_single),
      yesNo(patient.has_hypertension_history),
      yesNo(patient.has_preeclampsia_history),
      yesNo(patient.has_multiple_pregnancy),
      yesNo(patient.is_nulliparous),
      yesNo(patient.has_pregestational_diabetes),
      latest ? `${latest.systolic}` : 'Sin datos',
      latest ? `${latest.diastolic}` : 'Sin datos',
      latest ? riskTitle(latest.risk_level) : 'Sin datos',
    ]
  })
}

function buildPatientInfoRows(patient) {
  const rows = [
    ['Nombre', patient.full_name],
    ['Documento', patient.document_id],
    ['Edad', `${patient.age}`],
    ['Semanas de gestacion', `${patient.gestation_weeks}`],
    ['Talla (m)', heightInMeters(patient.height_cm)],
    ['Peso (kg)', trimZero(patient.weight_kg)],
    ['IMC', imcOf(patient)],
    ['Estado civil', maritalStatus(patient.is_single)],
    ['Antecedente de hipertensión', yesNo(patient.has_hypertension_history)],
    ['Antecedente de preeclampsia', yesNo(patient.has_preeclampsia_history)],
    ['Embarazo gemelar o múltiple', yesNo(patient.has_multiple_pregnancy)],
    ['Nuliparidad', yesNo(patient.is_nulliparous)],
    ['Diabetes pregestacional', yesNo(patient.has_pregestational_diabetes)],
    ['Teléfono', patient.phone ?? '-'],
    ['Dirección', patient.address ?? '-'],
  ]
  return rows
}

function buildSummaryRows(readings) {
  if (!readings || readings.length === 0) return []
  const latest = readings[0]
  return [
    ['Total mediciones', `${readings.length}`],
    ['Ultima presion', bloodPressure(latest.systolic, latest.diastolic)],
    ['Pulso', `${latest.heart_rate} bpm`],
    ['Riesgo', riskTitle(latest.risk_level)],
    ['Diagnostico', latest.diagnosis],
  ]
}

function readingRow(reading) {
  return [
    formatBoliviaReport(reading.recorded_at),
    bloodPressure(reading.systolic, reading.diastolic),
    `${reading.heart_rate} bpm`,
    glucoseText(reading.glucose),
    `${reading.stress}`,
    `${reading.physical_activity}`,
    `${reading.salt_consumption}`,
    `${reading.prenatal_control}`,
    yesNo(Number(reading.has_background) === 1),
    riskTitle(reading.risk_level),
    reading.diagnosis,
    sourceLabel(reading.source),
    reading.observations ?? '-',
  ]
}

/** Perfil clínico repetido en cada fila del historial (mismo formato del reporte general). */
function profileColumns(patient) {
  return [
    patient.full_name,
    patient.document_id,
    `${patient.age}`,
    `${patient.gestation_weeks}`,
    heightInMeters(patient.height_cm),
    trimZero(patient.weight_kg),
    imcOf(patient),
    maritalStatus(patient.is_single),
    yesNo(patient.has_hypertension_history),
    yesNo(patient.has_preeclampsia_history),
    yesNo(patient.has_multiple_pregnancy),
    yesNo(patient.is_nulliparous),
    yesNo(patient.has_pregestational_diabetes),
  ]
}

/**
 * Agrupa todas las lecturas por paciente preservando el orden de entrada
 * (fetchAllVitalReadings ya las trae ordenadas por recorded_at descendente).
 */
function groupReadingsByPatient(allReadings) {
  const byPatient = {}
  for (const reading of allReadings ?? []) {
    const list = byPatient[reading.patient_id] ?? []
    list.push(reading)
    byPatient[reading.patient_id] = list
  }
  return byPatient
}

/**
 * Historial completo: una fila por medición (perfil repetido). Las pacientes
 * sin mediciones aparecen igual con 'Sin datos' en Fecha/presión/riesgo.
 */
function buildHistoryRows(patients, byPatient) {
  const rows = []
  let counter = 0
  for (const patient of patients) {
    const readings = byPatient[patient.id] ?? []
    const sustainedById = sustainedHtnByReading(readings)
    const profile = profileColumns(patient)
    if (readings.length === 0) {
      counter += 1
      rows.push([
        `${counter}`,
        'Sin datos',
        ...profile,
        'Sin datos',
        'Sin datos',
        'No',
        'Sin datos',
      ])
    } else {
      for (const reading of readings) {
        counter += 1
        rows.push([
          `${counter}`,
          formatBoliviaReport(reading.recorded_at),
          ...profile,
          `${reading.systolic}`,
          `${reading.diastolic}`,
          yesNo(sustainedById.get(reading.id) === true),
          riskTitle(reading.risk_level),
        ])
      }
    }
  }
  return rows
}

function buildHistoryAoa(patients, byPatient) {
  return [
    [FULL_HISTORY_TITLE],
    [SUBTITLE],
    [generatedText()],
    [],
    HISTORY_HEADERS,
    ...buildHistoryRows(patients, byPatient),
  ]
}

// ─── Datos compartidos ───────────────────────────────────────────────────────

/**
 * Última lectura completa (con risk_level) de cada paciente visible según RLS.
 * La app móvil usa la primera lectura del listado como "última presión".
 */
async function loadLatestPerPatient(patients) {
  const entries = await Promise.all(
    patients.map(async (patient) => {
      const rows = await fetchVitalReadingsByPatient(patient.id, { limit: 1 })
      return [patient.id, rows[0] ?? null]
    }),
  )
  return Object.fromEntries(entries)
}

function safeName(value) {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'paciente'
  )
}

function fileDate() {
  const now = new Date()
  return `${now.getFullYear()}-${twoDigits(now.getMonth() + 1)}-${twoDigits(now.getDate())}`
}

function generatedText() {
  return `Generado: ${formatBoliviaReport(new Date())}`
}

// ─── PDF (jspdf + jspdf-autotable) ──────────────────────────────────────────

function pdfHeader(doc, title, x, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(title, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(SUBTITLE, x, y + 6)
  doc.text(generatedText(), x, y + 11)
}

function pdfSectionTitle(doc, text, x, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(text, x, y)
  return y + 5
}

function pdfTable(doc, { head, body, startY, margins }) {
  autoTable(doc, {
    ...(head ? { head } : { head: [] }),
    body,
    startY,
    margin: margins,
    theme: 'grid',
    headStyles: {
      fillColor: [234, 247, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
    },
    styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
  })
  return doc.lastAutoTable.finalY
}

function pdfNote(doc, x, y) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(REPORT_NOTE, x, y)
}

function finalYWithNote(doc, finalY, x, marginTop) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (finalY > pageHeight - 18) {
    doc.addPage()
    pdfNote(doc, x, marginTop + 10)
  } else {
    pdfNote(doc, x, finalY + 6)
  }
}

// ─── Excel (SheetJS) ─────────────────────────────────────────────────────────

function buildGeneralAoa(patients, latestByPatient) {
  return [
    [GENERAL_TITLE],
    [SUBTITLE],
    [generatedText()],
    [],
    ['Resumen general'],
    GENERAL_HEADERS,
    ...buildGeneralRows(patients, latestByPatient),
  ]
}

function buildIndividualAoa(patient, readings) {
  const summary = buildSummaryRows(readings)
  const aoa = [
    [INDIVIDUAL_TITLE],
    [SUBTITLE],
    [generatedText()],
    [],
    ['Datos de paciente'],
    ...buildPatientInfoRows(patient),
    [],
    ['Resumen de mediciones'],
    ...(summary.length === 0 ? [['Sin mediciones registradas.']] : summary),
    [],
    ['Historial clinico'],
  ]
  if (readings.length === 0) {
    aoa.push(['Sin historial clinico.'])
  } else {
    aoa.push(READING_HEADERS)
    for (const reading of readings) aoa.push(readingRow(reading))
  }
  return aoa
}

function writeWorkbook(sheetName, aoa, widths, filename) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = widths.map((width) => ({ wch: width }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

// ─── API pública ─────────────────────────────────────────────────────────────

/** Reporte general (PDF, A4 horizontal) sobre la lista pasada (ya filtrada por RLS/rol). */
export async function generateGeneralPdf(patients) {
  const latestByPatient = await loadLatestPerPatient(patients)
  const margins = { left: 24, right: 24, top: 20, bottom: 18 }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdfHeader(doc, GENERAL_TITLE, 24, 18)
  const sectionY = pdfSectionTitle(doc, 'Resumen general', 24, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(`Total de pacientes: ${patients.length}`, 24, sectionY)
  const finalY = pdfTable(doc, {
    head: [GENERAL_HEADERS],
    body: buildGeneralRows(patients, latestByPatient),
    startY: sectionY + 6,
    margins,
  })
  finalYWithNote(doc, finalY, 24, 20)
  doc.save(`reporte_general_${fileDate()}.pdf`)
}

/** Reporte general (Excel) sobre la lista pasada (ya filtrada por RLS/rol). */
export async function generateGeneralExcel(patients) {
  const latestByPatient = await loadLatestPerPatient(patients)
  writeWorkbook(
    'Reporte general',
    buildGeneralAoa(patients, latestByPatient),
    Array(GENERAL_HEADERS.length).fill(15),
    `reporte_general_${fileDate()}.xlsx`,
  )
}

/** Reporte individual de una paciente (PDF, A4 vertical). */
export async function generateIndividualPdf(patient, readings) {
  const safeReadings = readings ?? []
  const margins = { left: 28, right: 28, top: 20, bottom: 18 }
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  pdfHeader(doc, INDIVIDUAL_TITLE, 28, 20)

  let y = pdfSectionTitle(doc, 'Datos de paciente', 28, 40)
  y = pdfTable(doc, {
    body: buildPatientInfoRows(patient),
    startY: y,
    margins,
  }) + 8

  y = pdfSectionTitle(doc, 'Resumen de mediciones', 28, y)
  if (safeReadings.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Sin mediciones registradas.', 28, y + 4)
    y += 10
  } else {
    y = pdfTable(doc, {
      body: buildSummaryRows(safeReadings),
      startY: y,
      margins,
    }) + 8
  }

  y = pdfSectionTitle(doc, 'Historial clinico', 28, y)
  if (safeReadings.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Sin historial clinico.', 28, y + 4)
    y += 10
  } else {
    y = pdfTable(doc, {
      head: [READING_HEADERS],
      body: safeReadings.map(readingRow),
      startY: y,
      margins,
    }) + 8
  }

  pdfNote(doc, 28, y)
  doc.save(`reporte_${safeName(patient.full_name)}_${fileDate()}.pdf`)
}

/** Reporte individual de una paciente (Excel). */
export async function generateIndividualExcel(patient, readings) {
  const safeReadings = readings ?? []
  writeWorkbook(
    'Reporte clinico',
    buildIndividualAoa(patient, safeReadings),
    [16, 20, 10, 12, 20, 12, 14, 13, 14, 13, 13, 13, 40],
    `reporte_${safeName(patient.full_name)}_${fileDate()}.xlsx`,
  )
}

/**
 * Historial completo (PDF, A4 horizontal): todas las pacientes con todas sus
 * mediciones, una fila por medición y perfil repetido. Las pacientes sin
 * lecturas conservan una fila con sus datos de perfil.
 */
export async function generateFullHistoryPdf(patients, allReadings) {
  const byPatient = groupReadingsByPatient(allReadings)
  const totalReadings = Object.values(byPatient).reduce((sum, list) => sum + list.length, 0)
  const margins = { left: 24, right: 24, top: 20, bottom: 18 }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  pdfHeader(doc, FULL_HISTORY_TITLE, 24, 18)
  const sectionY = pdfSectionTitle(doc, 'Historial completo', 24, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(
    `Total de pacientes: ${patients.length} · Total de mediciones: ${totalReadings}`,
    24,
    sectionY,
  )
  const finalY = pdfTable(doc, {
    head: [HISTORY_HEADERS],
    body: buildHistoryRows(patients, byPatient),
    startY: sectionY + 6,
    margins,
  })
  finalYWithNote(doc, finalY, 24, 20)
  doc.save(`historial_completo_${fileDate()}.pdf`)
}

/** Historial completo (Excel) sobre la lista pasada (ya filtrada por RLS/rol). */
export async function generateFullHistoryExcel(patients, allReadings) {
  const byPatient = groupReadingsByPatient(allReadings)
  writeWorkbook(
    'Historial completo',
    buildHistoryAoa(patients, byPatient),
    Array(HISTORY_HEADERS.length).fill(15),
    `historial_completo_${fileDate()}.xlsx`,
  )
}