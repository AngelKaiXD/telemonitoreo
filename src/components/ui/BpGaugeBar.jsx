import { bpZone } from '../../utils/bpClassifier'

const MIN = 60
const MAX = 160
const TICKS = [60, 80, 100, 120, 140, 160]

const ZONE_COLORS = {
  0: '#2f9e63',
  1: '#e6b31a',
  2: '#d64545',
}

function position(value) {
  const clamped = Math.min(MAX, Math.max(MIN, Number(value) || MIN))
  return ((clamped - MIN) / (MAX - MIN)) * 100
}

/**
 * Barra de distribución de PA: valor arriba, gradiente verde→amarillo→rojo
 * según los mismos umbrales de bpClassifier.js, marcador en la posición del
 * valor y escala fija 60-160. La zona de color (verde/amarillo/rojo) se
 * deriva de la clasificación JNC7/AHA con sistólica y diastólica.
 */
export default function BpGaugeBar({ systolic, diastolic }) {
  const zone = Math.min(bpZone(Number(systolic), Number(diastolic)), 2)
  const color = ZONE_COLORS[zone]
  const markerLeft = `${position(systolic)}%`

  return (
    <div
      className="bp-gauge"
      role="img"
      aria-label={`Presión arterial ${systolic}/${diastolic} mmHg, ${zone === 0 ? 'normal' : zone === 1 ? 'en vigilancia' : 'en rango de hipertensión'}`}
    >
      <div className="bp-gauge-value" style={{ color }}>
        {systolic}
      </div>
      <div className="bp-gauge-track">
        <div className="bp-gauge-colors" />
        <div className="bp-gauge-marker" style={{ left: markerLeft, background: color }} />
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