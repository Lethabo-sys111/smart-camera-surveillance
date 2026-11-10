import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import TopBar from './components/TopBar'
import StatusPanel from './components/StatusPanel'
import ActivityFeed from './components/ActivityFeed'
import Gallery from './components/Gallery'
import Lightbox from './components/Lightbox'
import LiveFeed from './components/LiveFeed'
import Toast from './components/Toast'
import ConfirmDialog from './components/ConfirmDialog'

const CAMERA_POLL_MS = 3000
const CAPTURES_POLL_MS = 5000

// Photos taken within this many seconds of each other count as one event.
const BURST_GAP_S = 10

function toEvents(captures) {
  const events = []
  for (const c of captures) {
    const t = new Date(c.captured_at).getTime()
    const last = events[events.length - 1]
    if (last && last.type === c.trigger && last.start - t < BURST_GAP_S * 1000) {
      last.count += 1
      last.start = t
      last.thumbs.push(c)
    } else {
      events.push({ id: `c${c.id}`, type: c.trigger, at: c.captured_at, start: t, count: 1, thumbs: [c] })
    }
  }
  return events
}

export default function App() {
  const [camera, setCamera] = useState(null)
  const [cameraError, setCameraError] = useState(null)

  const [captures, setCaptures] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [dateFilter, setDateFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState(new Set())

  const [sessionEvents, setSessionEvents] = useState([])
  const [openIndex, setOpenIndex] = useState(null)
  const [liveOpen, setLiveOpen] = useState(false)
  const [confirmDisarm, setConfirmDisarm] = useState(false)
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState({ arm: false, capture: false })

  const capturesRef = useRef(captures)
  capturesRef.current = captures
  const prevArmed = useRef(null)

  const notify = useCallback((message, tone = 'info') => setToast({ message, tone, key: Date.now() }), [])

  // Record arm/disarm changes, whether they came from this app, another phone or an NFC card.
  const trackArmed = useCallback((cam) => {
    if (!cam) return
    if (prevArmed.current !== null && prevArmed.current !== cam.armed) {
      const at = new Date().toISOString()
      setSessionEvents((ev) => [{ id: `s${Date.now()}`, type: cam.armed ? 'armed' : 'disarmed', at, count: 1, thumbs: [] }, ...ev].slice(0, 30))
    }
    prevArmed.current = cam.armed
  }, [])

  // ---- Camera status (polled) ----
  const loadCamera = useCallback(async () => {
    try {
      const cam = await api.getCamera()
      trackArmed(cam)
      setCamera(cam)
      setCameraError(null)
    } catch (e) {
      setCameraError(e.message)
    }
  }, [trackArmed])

  useEffect(() => {
    loadCamera()
    const t = setInterval(loadCamera, CAMERA_POLL_MS)
    return () => clearInterval(t)
  }, [loadCamera])

  // ---- Captures: reload page 1 when the filter changes ----
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getCaptures(1, dateFilter)
      .then((res) => {
        if (cancelled) return
        setCaptures(res.data)
        setPage(1)
        setLastPage(res.last_page)
      })
      .catch((e) => !cancelled && notify(e.message, 'error'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dateFilter, notify])

  // ---- Captures: poll page 1 and add anything new to the top ----
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await api.getCaptures(1, dateFilter)
        const known = new Set(capturesRef.current.map((c) => c.id))
        const fresh = res.data.filter((c) => !known.has(c.id))
        if (fresh.length > 0) {
          setCaptures((prev) => {
            const ids = new Set(prev.map((c) => c.id))
            return [...fresh.filter((c) => !ids.has(c.id)), ...prev]
          })
          setNewIds((ids) => new Set([...ids, ...fresh.map((c) => c.id)]))
          const motion = fresh.some((c) => c.trigger === 'motion')
          notify(motion ? `Motion detected · ${fresh.length} photo${fresh.length > 1 ? 's' : ''}` : 'New photo captured', motion ? 'alert' : 'info')
        }
        setLastPage(res.last_page)
      } catch { /* the banner already shows connection problems */ }
    }, CAPTURES_POLL_MS)
    return () => clearInterval(t)
  }, [dateFilter, notify])

  const loadMore = async () => {
    const next = page + 1
    try {
      const res = await api.getCaptures(next, dateFilter)
      setCaptures((prev) => {
        const known = new Set(prev.map((c) => c.id))
        return [...prev, ...res.data.filter((c) => !known.has(c.id))]
      })
      setPage(next)
      setLastPage(res.last_page)
    } catch (e) {
      notify(e.message, 'error')
    }
  }

  // ---- Actions ----
  const setArmed = async (armed) => {
    setBusy((b) => ({ ...b, arm: true }))
    try {
      const updated = await api.setArmed(armed)
      trackArmed(updated)
      setCamera(updated)
      notify(updated.armed ? 'System armed' : 'System disarmed', updated.armed ? 'alert' : 'good')
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy((b) => ({ ...b, arm: false }))
    }
  }

  const toggleArmed = () => {
    if (!camera) return
    if (camera.armed) setConfirmDisarm(true)
    else setArmed(true)
  }

  const takePhoto = async () => {
    setBusy((b) => ({ ...b, capture: true }))
    try {
      setCamera(await api.requestCapture())
      notify('Photo requested. It will appear in a few seconds.')
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy((b) => ({ ...b, capture: false }))
    }
  }

  const deleteCapture = async (capture) => {
    if (!window.confirm('Delete this photo?')) return
    try {
      await api.deleteCapture(capture.id)
      setCaptures((prev) => prev.filter((c) => c.id !== capture.id))
      setOpenIndex((i) => {
        if (i === null) return null
        const remaining = captures.length - 1
        return remaining === 0 ? null : Math.min(i, remaining - 1)
      })
      notify('Photo deleted')
    } catch (e) {
      notify(e.message, 'error')
    }
  }

  const openCapture = (id) => {
    setNewIds((ids) => { const n = new Set(ids); n.delete(id); return n })
    setOpenIndex(captures.findIndex((c) => c.id === id))
  }

  const events = useMemo(() => {
    const all = [...sessionEvents, ...toEvents(captures)]
    all.sort((a, b) => new Date(b.at) - new Date(a.at))
    return all.slice(0, 12)
  }, [sessionEvents, captures])

  const lastMotion = captures.find((c) => c.trigger === 'motion')
  const alarmActive = !!(camera?.armed && lastMotion && Date.now() - new Date(lastMotion.captured_at).getTime() < 60_000)

  return (
    <div className={`app ${camera?.armed ? 'is-armed' : ''} ${alarmActive ? 'is-alarm' : ''}`}>
      <TopBar camera={camera} error={cameraError} />

      {cameraError && (
        <div className="banner banner-bad" role="alert">
          <strong>Server unreachable.</strong> Retrying every few seconds. Check the laptop is running the demo and this device is on the same Wi-Fi.
        </div>
      )}

      <main className="layout">
        <StatusPanel
          camera={camera}
          alarm={alarmActive}
          lastMotion={lastMotion}
          busy={busy}
          onToggleArmed={toggleArmed}
          onTakePhoto={takePhoto}
          onOpenLive={() => setLiveOpen(true)}
        />

        <ActivityFeed events={events} onOpen={openCapture} />

        <section className="card gallery-card">
          <div className="card-head">
            <h2>Gallery</h2>
            <div className="toolbar-right">
              <label className="date-filter">
                <span>Day</span>
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
              </label>
              {dateFilter && (
                <button className="btn btn-ghost btn-sm" onClick={() => setDateFilter('')}>Show all</button>
              )}
            </div>
          </div>

          <Gallery
            captures={captures}
            loading={loading}
            newIds={newIds}
            onOpen={openCapture}
            hasMore={page < lastPage}
            onLoadMore={loadMore}
          />
        </section>
      </main>

      {openIndex !== null && captures[openIndex] && (
        <Lightbox
          captures={captures}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onDelete={deleteCapture}
        />
      )}

      {liveOpen && <LiveFeed camera={camera} onClose={() => setLiveOpen(false)} />}

      {confirmDisarm && (
        <ConfirmDialog
          title="Disarm the system?"
          body="Motion will no longer be photographed and the alarm will stop."
          confirmLabel="Disarm"
          onConfirm={() => { setConfirmDisarm(false); setArmed(false) }}
          onCancel={() => setConfirmDisarm(false)}
        />
      )}

      {toast && <Toast key={toast.key} {...toast} onDone={() => setToast(null)} />}
    </div>
  )
}
