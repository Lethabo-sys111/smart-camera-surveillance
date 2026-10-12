import { useEffect, useState } from 'react'
import FullscreenButton from './FullscreenButton'

export default function LiveFeed({ camera, onClose }) {
  const [state, setState] = useState('loading') // loading | playing | error
  // A cache-busting query string forces a fresh connection each time the modal opens.
  const [src] = useState(() => camera?.stream_url ? `${camera.stream_url}?t=${Date.now()}` : '')

  // If nothing arrives within 8s the Pi is probably unreachable from this device.
  useEffect(() => {
    if (state !== 'loading') return
    const t = setTimeout(() => setState('error'), 8000)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const blockedByHttps = window.location.protocol === 'https:' && src.startsWith('http:')

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="viewer live" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-bar">
          <div className="live-title">
            <span className={`live-dot ${state === 'playing' ? 'pulse' : ''}`} aria-hidden="true" />
            <strong>Live feed</strong>
            <span className="mono muted"> · {camera?.ip}</span>
          </div>
          <div className="viewer-actions">
            <FullscreenButton className="btn btn-sm btn-ghost" />
            <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="viewer-stage">
          {state !== 'error' && !blockedByHttps && src && (
            <img
              src={src}
              alt="Live camera feed"
              onLoad={() => setState('playing')}
              onError={() => setState('error')}
              style={{ opacity: state === 'playing' ? 1 : 0 }}
            />
          )}
          {state === 'loading' && !blockedByHttps && <p className="stage-msg">Connecting to camera…</p>}
          {(state === 'error' || blockedByHttps || !src) && (
            <div className="stage-msg">
              <p><strong>Can't reach the live stream.</strong></p>
              <ul>
                <li>Your device must be on the same Wi-Fi as the Pi.</li>
                <li>Check the camera script is running on the Pi.</li>
                {blockedByHttps && <li>This page is HTTPS but the stream is HTTP, so the browser blocks it. Open the app over http:// on your network.</li>}
              </ul>
              {src && !blockedByHttps && <a className="btn btn-sm" href={src} target="_blank" rel="noreferrer">Open stream directly</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
