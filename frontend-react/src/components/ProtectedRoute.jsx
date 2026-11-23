import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-700 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading…</span>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />
  if (adminOnly && !user.is_admin) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
