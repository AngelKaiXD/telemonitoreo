import { classifyBloodPressure } from './bpClassifier'

/**
 * Mapa de fuentes de medición. La app móvil guarda 'bleDevice' en
 * vital_readings (nombre del enum ReadingSource) pero 'ble' en
 * latest_measurement; ambos representan la fuente BLE.
 */
const SOURCE_LABELS = {
  manual: 'Manual',
  ocr: 'OCR',
  imported: 'Importada',
  ble: 'BLE',
  bleDevice: 'BLE',
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? source ?? 'Manual'
}

const RISK_LEVELS = {
  none: { label: 'SIN RIESGO APARENTE', tone: 'success' },
  mild: { label: 'RIESGO LEVE', tone: 'warning' },
  moderate: { label: 'RIESGO MODERADO', tone: 'danger' },
  high: { label: 'RIESGO ALTO', tone: 'danger' },
}

export function riskLevelInfo(level) {
  const fallback = {
    label: String(level ?? 'none').toUpperCase(),
    tone: 'muted',
  }
  return RISK_LEVELS[level] ?? fallback
}

export function bloodPressureText(systolic, diastolic) {
  return `${systolic}/${diastolic}`
}

export function bpClassificationText(systolic, diastolic) {
  return classifyBloodPressure(systolic, diastolic)
}

const BOLIVIA_TZ = 'America/La_Paz'

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  timeZone: BOLIVIA_TZ,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Formatea un timestamp a fecha y hora de Bolivia (America/La_Paz, UTC-4). */
export function formatBoliviaDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

const dateOnlyFormatter = new Intl.DateTimeFormat('es-BO', {
  timeZone: BOLIVIA_TZ,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function formatBoliviaDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateOnlyFormatter.format(date)
}

export function formatNumber(value, digits = 1) {
  const number = Number(value)
  if (Number.isNaN(number)) return '—'
  return number.toFixed(digits)
}

export function formatBoolean(value) {
  return value ? 'Si' : 'No'
}

/** Muestra un booleano de forma legible en una fila informativa. */
export function booleanText(value) {
  return formatBoolean(value)
}