import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ShieldCheck, LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth()
  const { pathname } = useLocation()

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.username?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-brand-800 flex items-center justify-center text-lg shadow-sm
                          group-hover:bg-brand-900 transition-colors">
            🏛️
          </div>
          <div>
            <div className="font-black text-brand-900 text-base leading-tight tracking-tight">SmartResolve AI</div>
            <div className="text-[10px] text-gray-400 font-medium leading-tight">Citizen Grievance Portal</div>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          <NavLink to="/dashboard" icon={<LayoutDashboard size={15}/>} label="Dashboard" active={pathname === '/dashboard'} />
          {isAdmin && (
            <NavLink to="/admin" icon={<ShieldCheck size={15}/>} label="Admin Panel" active={pathname === '/admin'} />
          )}
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-3">
          {/* Avatar chip */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
            <div className="w-6 h-6 rounded-full bg-brand-800 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <span className="text-sm text-gray-700 font-medium max-w-[120px] truncate">
              {user?.full_name || user?.username}
            </span>
            {isAdmin && (
              <span className="badge badge-purple text-[10px] px-1.5 py-0.5">Admin</span>
            )}
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500
                       hover:bg-red-50 hover:text-red-600 transition-all duration-200"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

function NavLink({ to, icon, label, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200
        ${active
          ? 'bg-brand-800 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      {icon}
      {label}
    </Link>
  )
}
