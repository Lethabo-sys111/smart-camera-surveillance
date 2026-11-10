const paths = {
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z',
  shieldOff: 'M12 3l7 3v6c0 1.6-.4 3.1-1 4.4M5.5 6.6V12c0 4.5 3 8 6.5 9 1.6-.4 3-1.3 4.2-2.5M3 3l18 18',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
  live: 'M15 10l5-3v10l-5-3M3 7h12v10H3z',
  motion: 'M13 4a2 2 0 11-4 0 2 2 0 014 0zM9 21l2-6-2-3 1-5 4 3 3 1M10 7l-4 2-1 4M11 15l4 2 1 4',
  photo: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5a1 1 0 100-1 1 1 0 000 1z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 118 0v3',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 017.5-2',
  wifi: 'M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01',
  wifiOff: 'M3 3l18 18M8.5 16a5 5 0 017 0M5 12.5a10 10 0 015.2-2.8M14 9.8a10 10 0 015 2.7M2 9a15 15 0 014.5-3M12 19.5h.01',
  close: 'M6 6l12 12M18 6L6 18',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
}

export default function Icon({ name, size = 18, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
