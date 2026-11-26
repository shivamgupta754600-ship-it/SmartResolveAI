import { createContext, useContext, useEffect, useState } from 'react'
import { api, session, revokeSession } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(session.getUser())
  const [loading, setLoading] = useState(true)   // bootstrapping

  // On mount — rehydrate user from API if token exists
  useEffect(() => {
    if (!session.isLoggedIn()) { setLoading(false); return }
    api.auth.me()
      .then(u => { session.setUser(u); setUser(u) })
      .catch(() => { session.clear(); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  async function login(username, password) {
    const data = await api.auth.login(username, password)
    session.setToken(data.access_token)
    session.setRefresh(data.refresh_token)
    const me = await api.auth.me()
    session.setUser(me)
    setUser(me)
    return me
  }

  function logout() {
    void revokeSession(session.getRefresh() || session.getToken())
    session.clear()
    setUser(null)
  }

  async function refreshUser() {
    try {
      const me = await api.auth.me()
      session.setUser(me)
      setUser(me)
      return me
    } catch { return null }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isAdmin: !!user?.is_admin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
