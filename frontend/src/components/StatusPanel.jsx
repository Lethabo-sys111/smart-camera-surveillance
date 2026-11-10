import { formatAgo, formatTime } from '../format'
import Icon from './Icon'

export default function StatusPanel({ camera, alarm, lastMotion, busy, onToggleArmed, onTakePhoto, onOpenLive }) {
  const armed = !!camera?.armed
  const online = !!camera?.online
  const state = !camera ? 'unknown' : alarm ? 'alarm' : armed ? 'armed' : 'disarmed'

  const titles = {
    unknown: ['Waiting for camera', 'Connecting to the server…'],
    alarm: ['Intrusion detected', `Motion at ${lastMotion ? formatTime(lastMotion.captured_at) : ''}. Disarm to silence the alarm.`],
    armed: ['System armed', 'Motion will trigger photos and the alarm.'],
    disarmed: ['System disarmed', 'Motion is ignored. Arm with a card or the button.'],
  }
  const [title, sub] = titles[state]

  return (
    <section className={`card status-card state-${state}`}>
      <div className="status-main">
        <div className="status-badge">
          <Icon name={armed ? 'lock' : 'unlock'} size={34} />
        </div>
        <div className="status-text">
          <span className="eyebrow">Security status</span>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      </div>

      <button
        className={`arm-button ${armed ? 'is-armed' : ''}`}
        onClick={onToggleArmed}
        disabled={!camera || busy.arm}
        aria-pressed={armed}
      >
        <Icon name={armed ? 'shieldOff' : 'shield'} size={22} />
        {busy.arm ? 'Working…' : armed ? 'Disarm system' : 'Arm system'}
      </button>

      <div className="quick-actions">
        <button className="btn" onClick={onOpenLive} disabled={!camera?.stream_url}>
          <span className="live-dot" aria-hidden="true" /> Live feed
        </button>
        <button className="btn" onClick={onTakePhoto} disabled={!online || busy.capture} title={online ? '' : 'Camera is offline'}>
          <Icon name="camera" size={16} /> {busy.capture ? 'Requesting…' : 'Take photo'}
        </button>
      </div>

      <dl className="metrics">
        <div><dt>Photos today</dt><dd>{camera?.captures_today ?? '–'}</dd></div>
        <div><dt>All photos</dt><dd>{camera?.captures_total ?? '–'}</dd></div>
        <div><dt>Last seen</dt><dd>{camera ? (online ? 'Now' : formatAgo(camera.last_seen_at)) : '–'}</dd></div>
        <div><dt>Camera IP</dt><dd className="mono">{camera?.ip || '–'}</dd></div>
      </dl>
    </section>
  )
}
