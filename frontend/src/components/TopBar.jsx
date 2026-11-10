import { useEffect, useState } from 'react'
import FullscreenButton from './FullscreenButton'
import Icon from './Icon'

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="clock mono">
      <span>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      <small>{now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</small>
    </div>
  )
}

export default function TopBar({ camera, error }) {
  let link = { text: 'Connecting', tone: 'muted', icon: 'wifi' }
  if (error) link = { text: 'Server offline', tone: 'bad', icon: 'wifiOff' }
  else if (camera?.online) link = { text: 'Camera online', tone: 'good', icon: 'wifi' }
  else if (camera) link = { text: 'Camera offline', tone: 'bad', icon: 'wifiOff' }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon name="shield" size={20} /></span>
        <div>
          <h1>Sentinel</h1>
          <p>{camera?.name || 'Smart Camera'} · Surveillance console</p>
        </div>
      </div>
      <div className="topbar-right">
        <span className={`pill pill-${link.tone}`}><Icon name={link.icon} size={14} />{link.text}</span>
        <Clock />
        <FullscreenButton className="btn btn-icon btn-ghost" />
      </div>
    </header>
  )
}
