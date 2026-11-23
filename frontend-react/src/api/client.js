const API_BASE = 'http://localhost:8000'

const TOKEN_KEY   = 'sr_access_token'
const REFRESH_KEY = 'sr_refresh_token'
const USER_KEY    = 'sr_user'

// ── Token / session helpers ──────────────────────────────────────────
export const session = {
  getToken    : ()      => localStorage.getItem(TOKEN_KEY),
  setToken    : (t)     => localStorage.setItem(TOKEN_KEY, t),
  getRefresh  : ()      => localStorage.getItem(REFRESH_KEY),
  setRefresh  : (t)     => localStorage.setItem(REFRESH_KEY, t),
  getUser     : ()      => { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } },
  setUser     : (u)     => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear       : ()      => [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach(k => localStorage.removeItem(k)),
  isLoggedIn  : ()      => !!localStorage.getItem(TOKEN_KEY),
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
async function request(endpoint, options = {}, _retried = false) {
  const token = session.getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })

  // Try once to refresh on 401
  if (res.status === 401 && !_retried) {
    const ok = await tryRefresh()
    if (!ok) {
      session.clear()
      window.location.href = '/'
      return
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
export const api = {
  auth: {
    login    : (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    register : (body) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    me       : () => request('/auth/me'),
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
