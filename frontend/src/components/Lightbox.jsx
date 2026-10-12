import { useEffect } from 'react'
import { formatDay, formatSize, formatTime } from '../format'

export default function Lightbox({ captures, index, onIndex, onClose, onDelete }) {
  const capture = captures[index]
  const hasPrev = index > 0
  const hasNext = index < captures.length - 1

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onIndex(index - 1)
      if (e.key === 'ArrowRight' && hasNext) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, hasPrev, hasNext, onIndex, onClose])

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="viewer" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-bar">
          <div>
            <strong>{formatDay(capture.captured_at)}</strong>
            <span className="mono muted"> · {formatTime(capture.captured_at)} · {formatSize(capture.size_bytes)} · {capture.trigger}</span>
          </div>
          <div className="viewer-actions">
            <a className="btn btn-sm" href={capture.url} download target="_blank" rel="noreferrer">Download</a>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(capture)}>Delete</button>
            <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="viewer-stage">
          <button className="nav nav-prev" disabled={!hasPrev} onClick={() => onIndex(index - 1)} aria-label="Newer">‹</button>
          <img src={capture.url} alt="" />
          <button className="nav nav-next" disabled={!hasNext} onClick={() => onIndex(index + 1)} aria-label="Older">›</button>
        </div>

        <p className="viewer-count mono muted">{index + 1} / {captures.length}</p>
      </div>
    </div>
  )
}
