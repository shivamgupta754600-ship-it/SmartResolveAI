const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

const TOKEN_KEY   = 'sr_access_token'
const REFRESH_KEY = 'sr_refresh_token'
const USER_KEY    = 'sr_user'

// Remove credentials cached by earlier versions on shared devices.
for (const key of [TOKEN_KEY, REFRESH_KEY, USER_KEY]) localStorage.removeItem(key)

// ── Token / session helpers ──────────────────────────────────────────
export const session = {
  getToken    : ()      => sessionStorage.getItem(TOKEN_KEY),
  setToken    : (t)     => sessionStorage.setItem(TOKEN_KEY, t),
  getRefresh  : ()      => sessionStorage.getItem(REFRESH_KEY),
  setRefresh  : (t)     => sessionStorage.setItem(REFRESH_KEY, t),
  getUser     : ()      => { try { return JSON.parse(sessionStorage.getItem(USER_KEY)) } catch { return null } },
  setUser     : (u)     => sessionStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear       : ()      => [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach(k => sessionStorage.removeItem(k)),
  isLoggedIn  : ()      => !!sessionStorage.getItem(TOKEN_KEY),
}

// ── Silent token refresh ─────────────────────────────────────────────
async function tryRefresh() {
  const rt = session.getRefresh()
  if (!rt) return false
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) return false
    const data = await res.json()
    session.setToken(data.access_token)
    return true
  } catch { return false }
}

// ── Core request function ────────────────────────────────────────────
export async function request(endpoint, options = {}, _retried = false) {
  const token = session.getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })

  // Try once to refresh on 401
  if (res.status === 401 && token && !_retried && endpoint !== '/auth/login') {
    const ok = await tryRefresh()
    if (!ok) {
      session.clear()
      window.location.href = endpoint.startsWith('/cases') ? '/login?resident=1' : '/login'
      throw new Error('Your session expired. Please sign in again.')
    }
    return request(endpoint, options, true)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.detail ?? `Error ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

// ── API surface ──────────────────────────────────────────────────────
export function revokeSession(token) {
  if (!token) return Promise.resolve()
  return fetch(`${API_BASE}/auth/logout`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true,
  }).catch(() => {})
}

export const api = {
  auth: {
    login          : (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    register       : (body) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    me             : () => request('/auth/me'),
    updateProfile  : (body) =>
      request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  },

  grievances: {
    predict      : (text) =>
      request('/grievances/predict', { method: 'POST', body: JSON.stringify({ text }) }),
    history      : () => request('/grievances/history'),
    all          : () => request('/grievances/admin/all'),
    reviewQueue  : () => request('/grievances/admin/review'),
    review       : (id, review_status, review_notes = '') =>
      request(`/grievances/admin/${id}`, {
        method: 'PUT',
        body  : JSON.stringify({ review_status, review_notes }),
      }),
  },
}
