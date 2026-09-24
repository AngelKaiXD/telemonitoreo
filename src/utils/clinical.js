import { classifyBloodPressure } from './bpClassifier'
import modelConfig from '../../model/model_config.json'

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

const PROTEINURIA_RESULTS = {
  negativo: { label: 'Negativo', description: 'Sin proteinas detectables' },
  trazas: { label: 'Trazas', description: 'Rastro minimo (proteina apenas visible)' },
  '1+': { label: '1+', description: 'Proteinuria leve' },
  '2+': { label: '2+', description: 'Proteinuria moderada' },
  '3+': { label: '3+', description: 'Proteinuria importante' },
  '4+': { label: '4+', description: 'Proteinuria severa' },
}

/**
 * Etiqueta y descripción de un resultado de proteinuria (mismo catálogo de la
 * app móvil, Fase 30). El resultado en sí lo define el Doctor desde la móvil;
 * aquí solo se muestra.
 */
export function proteinuriaResultInfo(value) {
  const fallback = { label: String(value ?? '—'), description: '' }
  return PROTEINURIA_RESULTS[value] ?? fallback
}

// ─── Presión sostenida (cálculo compartido web/reportes) ────────────────────

/**
 * Obtiene el instante real en UTC igual que parseStoredTimestamp de la app:
 * un timestamp sin offset se asume como hora de pared Bolivia pre-fix y se
 * corrige sumando 4 horas; con offset/Z se respeta tal cual.
 */
export function toUtcInstant(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime())
  }
  if (typeof value === 'string' && value.length > 0) {
    const hasOffset = /(?:Z|z|[+-]\d{2}:?\d{2})$/.test(value)
    if (hasOffset) {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? null : date
    }
    const date = new Date(`${value}Z`)
    if (Number.isNaN(date.getTime())) return null
    return new Date(date.getTime() + 4 * 3600000)
  }
  return null
}

/**
 * "Presión sostenida" por lectura, con la MISMA regla de train_model.py:
 * la medición y su inmediatamente anterior (de la misma paciente) están ambas
 * en rango de HTN y el gap es >= sustained_hours_threshold. Se ordena por
 * fecha (ascendente) y se marca la lectura posterior de cada par; la primera
 * lectura de la paciente (sin previa) es siempre 'No'.
 * Umbrales citados de model/model_config.json (no se reescriben aquí).
 */
export function sustainedHtnByReading(readings) {
  const { sustained_hours_threshold, htn_systolic, htn_diastolic } = modelConfig
  const instantMs = (value) => {
    const instant = toUtcInstant(value)
    return instant ? instant.getTime() : null
  }
  const inHtnRange = (reading) =>
    Number(reading.systolic) >= htn_systolic || Number(reading.diastolic) >= htn_diastolic

  const sorted = [...(readings ?? [])].sort(
    (a, b) => (instantMs(a.recorded_at) ?? 0) - (instantMs(b.recorded_at) ?? 0),
  )
  const sustained = new Map()
  for (let i = 0; i < sorted.length; i += 1) {
    const reading = sorted[i]
    if (!reading.id) continue
    if (i === 0) {
      sustained.set(reading.id, false)
      continue
    }
    const prev = sorted[i - 1]
    const currMs = instantMs(reading.recorded_at)
    const prevMs = instantMs(prev.recorded_at)
    const gapHours =
      currMs !== null && prevMs !== null ? (currMs - prevMs) / 3600000 : null
    sustained.set(
      reading.id,
      inHtnRange(prev) &&
        inHtnRange(reading) &&
        gapHours !== null &&
        gapHours >= sustained_hours_threshold,
    )
  }
  return sustained
}