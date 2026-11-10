import { useEffect } from 'react'
import { formatDay, formatSize, formatTime } from '../format'
import Icon from './Icon'

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
          <div className="viewer-title">
            <strong>{formatDay(capture.captured_at)} · {formatTime(capture.captured_at)}</strong>
            <span className="mono muted small">{capture.trigger} · {formatSize(capture.size_bytes)} · {index + 1} of {captures.length}</span>
          </div>
          <div className="viewer-actions">
            <a className="btn btn-sm" href={capture.url} download target="_blank" rel="noreferrer"><Icon name="download" size={15} /> <span className="hide-sm">Download</span></a>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(capture)}><Icon name="trash" size={15} /> <span className="hide-sm">Delete</span></button>
            <button className="btn btn-sm btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
          </div>
        </div>

        <div className="viewer-stage">
          <button className="nav nav-prev" disabled={!hasPrev} onClick={() => onIndex(index - 1)} aria-label="Newer"><Icon name="left" size={22} /></button>
          <img src={capture.url} alt="" />
          <button className="nav nav-next" disabled={!hasNext} onClick={() => onIndex(index + 1)} aria-label="Older"><Icon name="right" size={22} /></button>
        </div>
      </div>
    </div>
  )
}
