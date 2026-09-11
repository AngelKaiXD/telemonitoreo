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