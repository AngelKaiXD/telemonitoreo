import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'

/**
 * Menú de descarga de reportes con opciones PDF y Excel.
 * `disabled` deshabilita el botón; `busyLabel` se muestra mientras genera.
 */
export default function DownloadMenu({
  onPdf,
  onExcel,
  disabled = false,
  busy = false,
  label = 'Descargar reporte',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocumentClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [open])

  function choose(action) {
    setOpen(false)
    action?.()
  }

  return (
    <div className="download-menu" ref={ref}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || busy}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={16} />
        {busy ? 'Generando...' : label}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="download-menu-list" role="menu">
          <button type="button" role="menuitem" disabled={busy} onClick={() => choose(onPdf)}>
            <FileText size={15} />
            PDF
          </button>
          <button type="button" role="menuitem" disabled={busy} onClick={() => choose(onExcel)}>
            <FileSpreadsheet size={15} />
            Excel
          </button>
        </div>
      )}
    </div>
  )
}