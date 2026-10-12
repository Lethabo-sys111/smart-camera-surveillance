import { formatAgo } from '../format'
import FullscreenButton from './FullscreenButton'

export default function Header({ camera, error, busy, onToggleArmed, onTakePhoto, onOpenLive }) {
  const online = camera?.online
  const armed = camera?.armed

  let statusText = 'Connecting…'
  let statusTone = 'muted'
  if (error) { statusText = 'Server unreachable'; statusTone = 'bad' }
  else if (camera && online) { statusText = 'Camera online'; statusTone = 'good' }
  else if (camera) { statusText = `Camera offline · seen ${formatAgo(camera.last_seen_at)}`; statusTone = 'bad' }

  return (
    <header className="header">
      <div className="brand">
        <div className={`rec-dot ${armed && online ? 'on' : ''}`} aria-hidden="true" />
        <div>
          <h1>{camera?.name || 'Smart Camera'}</h1>
          <p className={`status status-${statusTone}`}>{statusText}</p>
        </div>
      </div>

      <dl className="stats">
        <div><dt>Today</dt><dd>{camera?.captures_today ?? '–'}</dd></div>
        <div><dt>Total</dt><dd>{camera?.captures_total ?? '–'}</dd></div>
        <div><dt>IP</dt><dd className="mono">{camera?.ip || '–'}</dd></div>
      </dl>

      <div className="actions">
        <button
          className={`btn arm-toggle ${armed ? 'is-armed' : ''}`}
          onClick={onToggleArmed}
          disabled={!camera || busy.arm}
          aria-pressed={!!armed}
        >
          <span className="arm-switch" aria-hidden="true"><span /></span>
          {armed ? 'Armed' : 'Disarmed'}
        </button>
        <button className="btn" onClick={onTakePhoto} disabled={!online || busy.capture} title={online ? '' : 'Camera is offline'}>
          <span className="hide-sm">Take photo</span><span className="show-sm">Photo</span>
        </button>
        <button className="btn btn-primary" onClick={onOpenLive} disabled={!camera?.stream_url}>
          <span className="live-dot" aria-hidden="true" /> <span className="hide-sm">View live feed</span><span className="show-sm">Live</span>
        </button>
        <FullscreenButton className="btn btn-icon" />
      </div>
    </header>
  )
}
