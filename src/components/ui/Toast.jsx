import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  notification: Bell,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast) => {
      const id = (nextId.current += 1)
      setToasts((list) => [...list, { id, kind: 'info', ...toast }])
      if (toast.duration !== 0) {
        window.setTimeout(() => dismiss(id), toast.duration ?? 6000)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind] ?? Info
          return (
            <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
              <Icon size={18} className="toast-icon" />
              <div className="toast-body">
                {toast.title && <strong>{toast.title}</strong>}
                {toast.message && <span>{toast.message}</span>}
                {toast.action && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      toast.action.onClick?.()
                      dismiss(toast.id)
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(toast.id)}
                aria-label="Cerrar aviso"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export { ToastContext }

