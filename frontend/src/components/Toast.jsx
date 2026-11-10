import { useEffect, useRef } from 'react'

export default function Toast({ message, tone = 'info', onDone }) {
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const t = setTimeout(() => done.current(), 3500)
    return () => clearTimeout(t)
  }, [])

  return <div className={`toast toast-${tone}`} role="status">{message}</div>
}
