import { useEffect, useState } from 'react'
import FullscreenButton from './FullscreenButton'
import Icon from './Icon'

export default function LiveFeed({ camera, onClose }) {
  const [state, setState] = useState('loading') // loading | playing | error
  const [src] = useState(() => camera?.stream_url ? `${camera.stream_url}?t=${Date.now()}` : '')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (state !== 'loading') return
    const t = setTimeout(() => setState('error'), 8000)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(t); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const blockedByHttps = window.location.protocol === 'https:' && src.startsWith('http:')

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="viewer live" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-bar">
          <div className="viewer-title">
            <strong className="live-title">
              <span className={`live-badge ${state === 'playing' ? 'on' : ''}`}><span className="live-dot" />LIVE</span>
              {camera?.name || 'Camera'}
            </strong>
            <span className="mono muted small">{camera?.ip}</span>
          </div>
          <div className="viewer-actions">
            <FullscreenButton className="btn btn-sm btn-ghost btn-icon" />
            <button className="btn btn-sm btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
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
          {state === 'playing' && (
            <div className="osd mono">
              <span>{camera?.armed ? '● ARMED' : '○ DISARMED'}</span>
              <span>{now.toLocaleString()}</span>
            </div>
          )}
          {state === 'loading' && !blockedByHttps && <p className="stage-msg">Connecting to camera…</p>}
          {(state === 'error' || blockedByHttps || !src) && (
            <div className="stage-msg">
              <p><strong>Can't reach the live stream.</strong></p>
              <ul>
                <li>Your device must be on the same Wi-Fi as the Pi.</li>
                <li>Check the camera script is running on the Pi.</li>
                {blockedByHttps && <li>This page is HTTPS but the stream is HTTP, so the browser blocks it. Open the app over http://.</li>}
              </ul>
              {src && !blockedByHttps && <a className="btn btn-sm" href={src} target="_blank" rel="noreferrer">Open stream directly</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
