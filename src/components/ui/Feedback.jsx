export function FullPageLoader() {
  return (
    <div className="fullpage-loader">
      <Spinner size={32} />
    </div>
  )
}

export function Spinner({ size = 24 }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Cargando"
    />
  )
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, children }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={36} />}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="error-banner">
      <span>{message}</span>
    </div>
  )
}