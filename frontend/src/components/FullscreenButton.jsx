import { useEffect, useState } from 'react'

const supported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

export default function FullscreenButton({ className = 'btn' }) {
  const [active, setActive] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  if (!supported) return null

  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  return (
    <button className={className} onClick={toggle} title={active ? 'Exit full screen' : 'Full screen'} aria-label={active ? 'Exit full screen' : 'Full screen'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {active
          ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  )
}
