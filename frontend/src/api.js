const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try { message = (await res.json()).message || message } catch { /* not JSON */ }
    throw new Error(message)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  getCamera: () => request('/camera'),
  setArmed: (armed) => request('/camera', { method: 'PATCH', body: JSON.stringify({ armed }) }),
  requestCapture: () => request('/camera/capture', { method: 'POST' }),
  getCaptures: (page = 1, date = '') =>
    request(`/captures?page=${page}&per_page=24${date ? `&date=${date}` : ''}`),
  deleteCapture: (id) => request(`/captures/${id}`, { method: 'DELETE' }),
}
