import { formatDay, formatTime } from '../format'

export default function Gallery({ captures, loading, newIds, onOpen, hasMore, onLoadMore }) {
  if (loading && captures.length === 0) {
    return <div className="grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="tile skeleton" />)}</div>
  }

  if (captures.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No photos yet</p>
        <p>When the camera is armed and sees motion, photos land here automatically.</p>
      </div>
    )
  }

  // Group by day, keeping newest-first order.
  const groups = []
  for (const c of captures) {
    const day = formatDay(c.captured_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(c)
    else groups.push({ day, items: [c] })
  }

  return (
    <>
      {groups.map((g) => (
        <section key={g.day} className="day-group">
          <h3 className="day-heading">{g.day} <span>{g.items.length}</span></h3>
          <div className="grid">
            {g.items.map((c) => (
              <button key={c.id} className="tile" onClick={() => onOpen(c.id)}>
                <img src={c.url} alt={`Capture at ${formatTime(c.captured_at)}`} loading="lazy" />
                <span className="tile-meta">
                  <span className="mono">{formatTime(c.captured_at)}</span>
                  {c.trigger === 'manual' && <span className="tag">manual</span>}
                  {newIds.has(c.id) && <span className="tag tag-new">new</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {hasMore && (
        <div className="load-more">
          <button className="btn" onClick={onLoadMore}>Load older photos</button>
        </div>
      )}
    </>
  )
}
