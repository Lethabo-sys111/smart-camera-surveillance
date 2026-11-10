import { formatAgo, formatTime } from '../format'
import Icon from './Icon'

const kinds = {
  motion: { icon: 'motion', tone: 'bad', label: (e) => `Motion detected · ${e.count} photo${e.count > 1 ? 's' : ''}` },
  manual: { icon: 'photo', tone: 'info', label: (e) => (e.count > 1 ? `${e.count} manual photos` : 'Manual photo') },
  armed: { icon: 'lock', tone: 'warn', label: () => 'System armed' },
  disarmed: { icon: 'unlock', tone: 'good', label: () => 'System disarmed' },
}

export default function ActivityFeed({ events, onOpen }) {
  return (
    <section className="card activity-card">
      <div className="card-head">
        <h2>Activity</h2>
        <span className="muted small">Latest {events.length}</span>
      </div>

      {events.length === 0 ? (
        <p className="empty-small">No activity yet. Events show up here as they happen.</p>
      ) : (
        <ol className="timeline">
          {events.map((e) => {
            const k = kinds[e.type] || kinds.manual
            return (
              <li key={e.id} className={`event tone-${k.tone}`}>
                <span className="event-icon"><Icon name={k.icon} size={16} /></span>
                <div className="event-body">
                  <strong>{k.label(e)}</strong>
                  <span className="mono muted small">{formatTime(e.at)} · {formatAgo(e.at)}</span>
                </div>
                {e.thumbs.length > 0 && (
                  <button className="event-thumb" onClick={() => onOpen(e.thumbs[0].id)} aria-label="Open photo">
                    <img src={e.thumbs[0].url} alt="" loading="lazy" />
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
