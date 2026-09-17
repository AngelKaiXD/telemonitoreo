import { useState } from 'react'
import { Send } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './useToast'
import { jitsiUrl, sendTelemedicineInvite } from '../../services/telemedicineService'

export default function TelemedicineModal({ onClose, patient }) {
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function send() {
    const text = reason.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    try {
      const result = await sendTelemedicineInvite(patient.id, text)
      const room = result.jitsi_room
      const pushSent = result.push_sent === true
      showToast({
        kind: 'notification',
        title: 'Telemedicina',
        message: pushSent
          ? `Invitación enviada a ${patient.full_name}.`
          : 'Invitación guardada, pero no se pudo notificar por push. La paciente no tiene un dispositivo con token registrado.',
        duration: 8000,
      })
      if (room) {
        window.open(jitsiUrl(room), '_blank', 'noopener,noreferrer')
      } else {
        setError('La sala de videollamada no se creó correctamente.')
      }
      onClose()
    } catch (sendError) {
      const message = sendError?.message || 'No se pudo enviar la invitación.'
      setError(message)
      showToast({ kind: 'warning', title: 'No se pudo invitar', message })
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open onClose={() => !sending && onClose()} title="Invitación a telemedicina">
      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
        Paciente: {patient.full_name}
      </p>
      <p style={{ marginBottom: 16 }}>{patient.gestation_weeks} semanas</p>

      <div className="field">
        <label htmlFor="telemedicine-reason">Motivo</label>
        <textarea
          id="telemedicine-reason"
          rows={3}
          maxLength={280}
          placeholder="Describe el motivo de la consulta"
          value={reason}
          disabled={sending}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      {error && (
        <p className="field-error" style={{ marginTop: 10 }}>
          <span className="field-msg">{error}</span>
        </p>
      )}

      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn btn-outline" type="button" onClick={onClose} disabled={sending}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={send}
          disabled={sending || reason.trim().length === 0}
        >
          <Send size={16} />
          {sending ? 'Enviando...' : 'Enviar invitación'}
        </button>
      </div>
    </Modal>
  )
}
