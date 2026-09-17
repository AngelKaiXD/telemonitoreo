import { useEffect, useMemo, useState } from 'react'
import { Bell, BellRing, ExternalLink, Loader2, ShieldAlert } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './useToast'
import { useAuth } from '../../context/useAuth'
import { fetchPatients } from '../../services/api'
import { toUserMessage } from '../../services/errors'
import { formatBoliviaDateTime } from '../../utils/clinical'
import { fetchNotifications, jitsiUrl, subscribeNotifications } from '../../services/telemedicineService'
import { enableWebPush, notificationPermission, pushConfigMissing, pushSupported } from '../../services/pushService'

const POLL_MS = 30000

export default function NotificationsBell() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [patients, setPatients] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [permission, setPermission] = useState(() => notificationPermission())
  const seenKey = profile?.id ? `notifications-seen-${profile.id}` : null
  const [lastSeen, setLastSeen] = useState(() => {
    try {
      return seenKey ? localStorage.getItem(seenKey) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!profile?.id) return undefined
    async function run() {
      try {
        const rows = await fetchNotifications()
        setItems(rows)
        setError(null)
      } catch (loadError) {
        setError(loadError?.message || 'No se pudieron cargar las notificaciones.')
      }
    }
    run()
    const unsubscribe = subscribeNotifications((row) => {
      if (!row?.id) return
      setItems((list) => (list.some((item) => item.id === row.id) ? list : [row, ...list]))
    })
    const timer = window.setInterval(run, POLL_MS)
    window.addEventListener('telemedicine:push', run)
    return () => {
      unsubscribe()
      window.clearInterval(timer)
      window.removeEventListener('telemedicine:push', run)
    }
  }, [profile?.id])

  async function openPanel() {
    setOpen(true)
    setLoading(true)
    try {
      const [rows, patientRows] = await Promise.all([fetchNotifications(), fetchPatients()])
      setItems(rows)
      setPatients(Object.fromEntries(patientRows.map((patient) => [patient.id, patient.full_name])))
      setError(null)
    } catch (loadError) {
      setError(loadError?.message || 'No se pudieron cargar las notificaciones.')
    } finally {
      setLoading(false)
    }
  }

  function closePanel() {
    setOpen(false)
    const now = new Date().toISOString()
    setLastSeen(now)
    try {
      if (seenKey) localStorage.setItem(seenKey, now)
    } catch {
      /* almacenamiento no disponible */
    }
  }

  const unseenCount = useMemo(() => {
    if (!lastSeen) return items.length
    return items.filter((item) => item.created_at > lastSeen).length
  }, [items, lastSeen])

  async function activatePush() {
    if (enabling) return
    setEnabling(true)
    try {
      await enableWebPush(profile?.id)
      setPermission(notificationPermission())
      showToast({
        kind: 'success',
        title: 'Notificaciones activadas',
        message: 'Este navegador recibirá avisos de telemedicina aunque no estés mirando la pestaña.',
      })
    } catch (pushError) {
      const fallback = 'No se pudieron activar las notificaciones.'
      const message = pushError?.code
        ? toUserMessage(pushError, fallback)
        : pushError?.message || fallback
      setError(message)
      showToast({ kind: 'warning', title: 'Notificaciones no activadas', message })
    } finally {
      setEnabling(false)
    }
  }

  const pushNotice = (() => {
    if (!pushSupported()) {
      return { text: 'Este navegador no soporta notificaciones push.', canEnable: false }
    }
    if (pushConfigMissing()) {
      return {
        text: 'Falta la configuración de Firebase en la web (VITE_FIREBASE_*); sin ella no se pueden activar los avisos.',
        canEnable: false,
      }
    }
    if (permission === 'denied') {
      return {
        text: 'Bloqueaste las notificaciones en este navegador. Habilítalas desde la configuración del sitio para recibir avisos.',
        canEnable: false,
      }
    }
    if (permission === 'granted') {
      return { text: 'Notificaciones activadas en este navegador.', canEnable: false, active: true }
    }
    return { canEnable: true }
  })()

  return (
    <>
      <button
        type="button"
        className="topbar-logout topbar-bell"
        onClick={openPanel}
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        {unseenCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unseenCount > 0 && (
          <span className="topbar-bell-dot">{unseenCount > 9 ? '9+' : unseenCount}</span>
        )}
      </button>

      <Modal open={open} onClose={closePanel} title="Notificaciones de telemedicina">
        {pushNotice.canEnable && (
          <div className="push-cta">
            <ShieldAlert size={18} />
            <div>
              <strong>Activa las notificaciones</strong>
              <p>
                Sirven para avisarte de una videollamada de telemedicina aunque no estés mirando esta
                pestaña. El navegador te pedirá permiso solo si aceptas aquí.
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={activatePush}
              disabled={enabling}
            >
              {enabling ? <Loader2 size={14} className="spin" /> : <Bell size={14} />}
              {enabling ? 'Activando...' : 'Activar'}
            </button>
          </div>
        )}
        {!pushNotice.canEnable && pushNotice.text && (
          <p className={pushNotice.active ? 'push-status push-status-on' : 'push-status'}>
            {pushNotice.text}
          </p>
        )}

        {loading ? (
          <div className="notifications-loading">
            <Loader2 size={20} className="spin" /> Cargando...
          </div>
        ) : error ? (
          <p className="field-error">
            <span className="field-msg">{error}</span>
          </p>
        ) : items.length === 0 ? (
          <p className="notifications-empty">Todavía no enviaste invitaciones de telemedicina.</p>
        ) : (
          <ul className="notifications-list">
            {items.map((item) => (
              <li key={item.id} className="notification-item">
                <div className="notification-head">
                  <strong>{patients[item.patient_id] || 'Paciente'}</strong>
                  <span className="cell-sub">{formatBoliviaDateTime(item.created_at)}</span>
                </div>
                <p>{item.reason || 'Sin motivo'}</p>
                {item.jitsi_room && (
                  <a
                    className="btn btn-outline btn-sm"
                    href={jitsiUrl(item.jitsi_room)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} />
                    Entrar a la sala
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
