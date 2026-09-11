import Modal from './Modal'

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title ?? 'Confirmar'}>
      <p>{message ?? '¿Deseas continuar con esta acción?'}</p>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={onClose} disabled={loading}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={onConfirm} disabled={loading}>
          {loading ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}