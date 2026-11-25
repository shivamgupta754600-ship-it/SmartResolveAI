import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Lock, Mail, Phone, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api, session } from '../api/client'
import { useToast } from '../components/Toast'

const FEATURES = [
  { icon: '🧠', text: 'AI classifies grievances in milliseconds' },
  { icon: '🗣️', text: 'Hindi, English & Hinglish supported' },
  { icon: '📊', text: 'Confidence scores & probability breakdown' },
  { icon: '👨‍⚖️', text: 'Human review flag for uncertain cases' },
]

export default function LoginPage() {
  const navigate     = useNavigate()
  const { login }    = useAuth()
  const { showToast } = useToast()
  const [tab, setTab]     = useState('login')   // 'login' | 'register'

  // Redirect if already logged in
  if (session.isLoggedIn()) { navigate('/dashboard', { replace: true }); return null }

  return (
    <div className="min-h-screen flex">
      <a href="/" className="absolute z-20 top-3 right-4 rounded-lg bg-white px-3 py-2 text-sm text-brand-800 underline">Case portal</a>

      {/* ── LEFT HERO PANEL ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12
                      bg-gradient-to-br from-brand-950 via-brand-900 to-indigo-900 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-indigo-500/10" />
        <div className="absolute -bottom-16 left-1/4 w-48 h-48 rounded-full bg-blue-400/10" />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center text-2xl">
              🏛️
            </div>
            <div>
              <div className="text-white font-black text-xl">SmartResolve AI</div>
              <div className="text-blue-300 text-xs font-medium">v2.0 · Student Project</div>
            </div>
          </div>

          <h1 className="text-white text-4xl font-black leading-tight mb-4">
            Empowering Citizens<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
              Through AI
            </span>
          </h1>
          <p className="text-blue-200 text-base font-medium max-w-sm leading-relaxed">
            Submit grievances in your language. Our ML model classifies them instantly
            and routes them to the right department.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-blue-100">
              <span className="text-xl w-8 text-center">{f.icon}</span>
              <span className="text-sm font-medium">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Bottom disclaimer */}
        <div className="relative z-10 flex items-start gap-2 bg-white/5 rounded-2xl p-4 border border-white/10">
          <span className="text-yellow-400 text-lg mt-0.5">⚠️</span>
          <p className="text-blue-200 text-xs leading-relaxed">
            <strong className="text-white">Demo / Student project.</strong> Not an official
            government platform. Predictions are AI-generated and require human review.
          </p>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-[420px]">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 bg-brand-800 rounded-xl flex items-center justify-center text-xl">🏛️</div>
            <div className="font-black text-brand-900 text-lg">SmartResolve AI</div>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 bg-gray-100 rounded-2xl mb-8">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${tab === t
                    ? 'bg-white text-brand-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {tab === 'login'
            ? <LoginForm login={login} navigate={navigate} showToast={showToast} />
            : <RegisterForm setTab={setTab} showToast={showToast} />
          }
        </div>
      </div>
    </div>
  )
}

/* ── LOGIN FORM ─────────────────────────────────────────────────── */
function LoginForm({ login, navigate, showToast }) {
  const [form, setForm]       = useState({ username: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.username.trim()) return setError('Please enter your username.')
    if (!form.password)        return setError('Please enter your password.')

    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">Welcome back</h2>
        <p className="text-sm text-gray-500">Sign in to your citizen account.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium animate-fade-in">
          <span>⚠️</span> {error}
        </div>
      )}

      <Field label="Username" icon={<User size={16} className="text-gray-400" />}>
        <input className="input pl-10" type="text" placeholder="your_username"
          value={form.username} onChange={set('username')} autoComplete="username" />
      </Field>

      <Field label="Password" icon={<Lock size={16} className="text-gray-400" />}
        trailing={
          <button type="button" onClick={() => setShowPwd(v => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        }
      >
        <input className="input pl-10 pr-10" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
          value={form.password} onChange={set('password')} autoComplete="current-password" />
      </Field>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
        {loading
          ? <><Spinner /> Signing in…</>
          : <> Sign In <ArrowRight size={16}/></>
        }
      </button>
    </form>
  )
}

/* ── REGISTER FORM ──────────────────────────────────────────────── */
function RegisterForm({ setTab, showToast }) {
  const [form, setFormState] = useState({ fullName: '', username: '', email: '', password: '', phone: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [fieldErrors, setFE]  = useState({})

  const set = (k) => (e) => setFormState(f => ({ ...f, [k]: e.target.value }))

  function validate() {
    const errs = {}
    if (!form.username.trim()) errs.username = 'Required.'
    else if (!/^[a-zA-Z0-9_]{3,50}$/.test(form.username)) errs.username = 'Letters, numbers, underscores only (3–50 chars).'
    if (!form.email.trim())    errs.email = 'Required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.'
    if (!form.password)        errs.password = 'Required.'
    else if (form.password.length < 8) errs.password = 'At least 8 characters.'
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Include at least one uppercase letter.'
    else if (!/[0-9]/.test(form.password)) errs.password = 'Include at least one number.'
    if (form.phone.trim() && !/^\d{10,15}$/.test(form.phone.replace(/[\s\-\+()]/g, '')))
      errs.phone = 'Enter a valid 10-digit mobile number.'
    setFE(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      await api.auth.register({
        username : form.username.trim().toLowerCase(),
        email    : form.email.trim(),
        password : form.password,
        full_name: form.fullName.trim(),
        phone    : form.phone.trim() || undefined,
      })
      showToast('Account created! Please sign in.', 'success')
      setTab('login')
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
      <div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">Create account</h2>
        <p className="text-sm text-gray-500">Join SmartResolve AI as a citizen.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium animate-fade-in">
          <span>⚠️</span> {error}
        </div>
      )}

      <Field label="Full Name (optional)" icon={<User size={16} className="text-gray-400"/>}>
        <input className="input pl-10" type="text" placeholder="Ramesh Kumar"
          value={form.fullName} onChange={set('fullName')} />
      </Field>

      <Field label="Username *" icon={<User size={16} className="text-gray-400"/>} error={fieldErrors.username}>
        <input className={`input pl-10 ${fieldErrors.username ? 'error':''}`} type="text"
          placeholder="ramesh_123" value={form.username} onChange={set('username')} autoComplete="username" />
      </Field>

      <Field label="Email *" icon={<Mail size={16} className="text-gray-400"/>} error={fieldErrors.email}>
        <input className={`input pl-10 ${fieldErrors.email ? 'error':''}`} type="email"
          placeholder="ramesh@example.com" value={form.email} onChange={set('email')} autoComplete="email" />
      </Field>

      <Field label="Mobile Number (recommended)" icon={<Phone size={16} className="text-gray-400"/>} error={fieldErrors.phone}>
        <input className={`input pl-10 ${fieldErrors.phone ? 'error':''}`} type="tel"
          placeholder="9876543210" value={form.phone} onChange={set('phone')} autoComplete="tel" />
      </Field>

      <Field label="Password *" icon={<Lock size={16} className="text-gray-400"/>}
        error={fieldErrors.password}
        trailing={
          <button type="button" onClick={() => setShowPwd(v => !v)}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        }
      >
        <input className={`input pl-10 pr-10 ${fieldErrors.password ? 'error':''}`}
          type={showPwd ? 'text' : 'password'} placeholder="Min 8 chars, 1 uppercase, 1 number"
          value={form.password} onChange={set('password')} autoComplete="new-password" />
      </Field>

      <p className="text-xs text-gray-400 leading-relaxed">
        📍 You can add your address after registration so the department can visit your location.
      </p>

      <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-1">
        {loading
          ? <><Spinner /> Creating account…</>
          : <><Sparkles size={16}/> Create Account</>
        }
      </button>
    </form>
  )
}

/* ── Shared helpers ─────────────────────────────────────────────── */
function Field({ label, icon, trailing, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
        {children}
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
}
