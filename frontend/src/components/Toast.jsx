import { useEffect } from 'react'

export default function Toast({ message, tone = 'info', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])

  return <div className={`toast toast-${tone}`} role="status">{message}</div>
}
