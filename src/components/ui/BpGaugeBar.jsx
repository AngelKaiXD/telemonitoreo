import { bpZone } from '../../utils/bpClassifier'

const MIN = 60
const MAX = 160
const TICKS = [60, 80, 100, 120, 140, 160]

function position(value) {
  const clamped = Math.min(MAX, Math.max(MIN, Number(value) || MIN))
  return ((clamped - MIN) / (MAX - MIN)) * 100
}

function markerLeft(value) {
  // La etiqueta centrada no se saldría de la escala en los extremos
  return `${Math.min(92, Math.max(8, position(value)))}%`
}

/**
 * Barra de distribución de PA: gradiente verde→amarillo→rojo según los mismos
 * umbrales de bpClassifier.js y escala fija 60-160. Dos marcadores en la
 * posición de cada lectura: triángulo en tinta apuntando hacia abajo con la
 * sistólica arriba de la barra y triángulo turquesa apuntando hacia arriba con
 * la diastólica abajo, para que las etiquetas no se encimen cuando los valores
 * están cerca. La zona de color (verde/amarillo/rojo) se deriva de la
 * clasificación JNC7/AHA con ambas lecturas.
 */
export default function BpGaugeBar({ systolic, diastolic }) {
  const zone = Math.min(bpZone(Number(systolic), Number(diastolic)), 2)

  return (
    <div
      className="bp-gauge"
      role="img"
      aria-label={`Distribución PA: sistólica ${systolic}, diastólica ${diastolic} mmHg, ${zone === 0 ? 'normal' : zone === 1 ? 'en vigilancia' : 'en rango de hipertensión'}`}
    >
      <div className="bp-gauge-markers">
        <div className="bp-gauge-marker bp-gauge-marker-sys" style={{ left: markerLeft(systolic) }}>
          <span className="bp-gauge-label">{systolic}</span>
          <span className="bp-gauge-caret bp-gauge-caret-down" />
        </div>
      </div>
      <div className="bp-gauge-track">
        <div className="bp-gauge-colors" />
      </div>
      <div className="bp-gauge-markers">
        <div className="bp-gauge-marker bp-gauge-marker-dia" style={{ left: markerLeft(diastolic) }}>
          <span className="bp-gauge-caret bp-gauge-caret-up" />
          <span className="bp-gauge-label">{diastolic}</span>
        </div>
      </div>
      <div className="bp-gauge-scale">
        {TICKS.map((tick) => (
          <span key={tick} style={{ left: `${position(tick)}%` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  )
}