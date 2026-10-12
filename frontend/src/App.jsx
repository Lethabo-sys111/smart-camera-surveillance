import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import Header from './components/Header'
import Gallery from './components/Gallery'
import Lightbox from './components/Lightbox'
import LiveFeed from './components/LiveFeed'
import Toast from './components/Toast'

const CAMERA_POLL_MS = 4000
const CAPTURES_POLL_MS = 5000

export default function App() {
  const [camera, setCamera] = useState(null)
  const [cameraError, setCameraError] = useState(null)

  const [captures, setCaptures] = useState([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [dateFilter, setDateFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState(new Set())

  const [openIndex, setOpenIndex] = useState(null)
  const [liveOpen, setLiveOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState({ arm: false, capture: false })

  const capturesRef = useRef(captures)
  capturesRef.current = captures

  const notify = useCallback((message, tone = 'info') => setToast({ message, tone, key: Date.now() }), [])

  // ---- Camera status (polled) ----
  const loadCamera = useCallback(async () => {
    try {
      setCamera(await api.getCamera())
      setCameraError(null)
    } catch (e) {
      setCameraError(e.message)
    }
  }, [])

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
          notify(`${fresh.length} new photo${fresh.length > 1 ? 's' : ''} captured`, 'alert')
        }
        setLastPage(res.last_page)
      } catch { /* status bar already shows connection problems */ }
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
  const toggleArmed = async () => {
    if (!camera) return
    setBusy((b) => ({ ...b, arm: true }))
    try {
      const updated = await api.setArmed(!camera.armed)
      setCamera(updated)
      notify(updated.armed ? 'Camera armed: motion will be photographed' : 'Camera disarmed')
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy((b) => ({ ...b, arm: false }))
    }
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

  return (
    <div className="app">
      <Header
        camera={camera}
        error={cameraError}
        busy={busy}
        onToggleArmed={toggleArmed}
        onTakePhoto={takePhoto}
        onOpenLive={() => setLiveOpen(true)}
      />

      <main className="main">
        <div className="toolbar">
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

      {toast && <Toast key={toast.key} {...toast} onDone={() => setToast(null)} />}
    </div>
  )
}
