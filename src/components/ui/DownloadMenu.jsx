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
 *
 * Con la prop `items` (array de { label, onPdf, onExcel }) cada reporte se
 * muestra como grupo con sus botones PDF/Excel. Sin `items` mantiene el
 * comportamiento original: un solo par PDF/Excel para `onPdf`/`onExcel`.
 */
export default function DownloadMenu({
  onPdf,
  onExcel,
  items,
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

  const hasItems = Array.isArray(items) && items.length > 0

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
          {hasItems ? (
            items.map((entry) => (
              <div className="download-menu-group" key={entry.label}>
                <span className="download-menu-label">{entry.label}</span>
                <div className="download-menu-actions">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => choose(entry.onPdf)}
                  >
                    <FileText size={15} />
                    PDF
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => choose(entry.onExcel)}
                  >
                    <FileSpreadsheet size={15} />
                    Excel
                  </button>
                </div>
              </div>
            ))
          ) : (
            <>
              <button type="button" role="menuitem" disabled={busy} onClick={() => choose(onPdf)}>
                <FileText size={15} />
                PDF
              </button>
              <button type="button" role="menuitem" disabled={busy} onClick={() => choose(onExcel)}>
                <FileSpreadsheet size={15} />
                Excel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}