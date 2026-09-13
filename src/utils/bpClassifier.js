/**
 * Clasificación estándar de presión arterial (JNC7/AHA).
 * Espejo exacto de lib/services/bp_classifier.dart de la app móvil.
 * Cuando sistólica y diastólica caen en categorías distintas, la clasificación
 * final es la más severa de las dos.
 */
export function classifyBloodPressure(systolic, diastolic) {
  const sysStage = systolicStage(systolic)
  const diaStage = diastolicStage(diastolic)
  const stage = Math.max(sysStage, diaStage)

  switch (stage) {
    case 3:
      return 'Hipertension Etapa 2'
    case 2:
      return 'Hipertension Etapa 1'
    case 1:
      return 'Prehipertension'
    default:
      return 'Normal'
  }
}

function systolicStage(systolic) {
  if (systolic >= 160) return 3
  if (systolic >= 140) return 2
  if (systolic >= 120) return 1
  return 0
}

function diastolicStage(diastolic) {
  if (diastolic >= 100) return 3
  if (diastolic >= 90) return 2
  if (diastolic >= 80) return 1
  return 0
}

/**
 * Zona JNC7/AHA en nivel 0..3 usando los mismos cortes de [classifyBloodPressure]
 * (sistólica >=120/140/160, diastólica >=80/90/100; el mayor de ambas gana).
 * Reutilizado por la barra de distribución de PA para que el color coincida
 * siempre con la clasificación del resto de la app.
 */
export function bpZone(systolic, diastolic) {
  return Math.max(systolicStage(systolic), diastolicStage(diastolic))
}