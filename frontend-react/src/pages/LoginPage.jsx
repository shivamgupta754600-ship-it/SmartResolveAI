import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, User, Lock, Mail, Phone, Sparkles, ArrowRight } from 'lucide-react'
import PortalHeader from '../components/PortalHeader'
import PhoneVerification from '../components/PhoneVerification'
import { useAuth } from '../context/AuthContext'
import { api, request, session } from '../api/client'
import { useToast } from '../components/Toast'

export default function LoginPage() {
  const navigate     = useNavigate()
  const { login }    = useAuth()
  const { showToast } = useToast()
  const [tab, setTab]     = useState('login')   // 'login' | 'register'

  const [query] = useSearchParams()
  const destination = query.get("resident") === "1" ? "/" : "/dashboard"

  // Redirect if already logged in
  if (session.isLoggedIn()) return <Navigate to={destination === "/" ? "/#file-case" : destination} replace />

  return (
    <main className="auth-page"><PortalHeader><Link to="/">Resident portal</Link></PortalHeader>
      <div className="auth-layout"><aside className="auth-aside">
        <h1>{destination==='/' ? 'Your resident account' : 'SmartResolve workspace'}</h1>
        <p>{destination==='/' ? 'File complaints, share evidence and follow updates from your municipal office.' : 'Review predictions and manage your grievance history.'}</p>
        <div className="portal-art" aria-hidden="true"/>
        <small>Independent project · Demonstration portal</small>
      </aside><section className="auth-form">
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

          {destination === '/' && tab === 'login' && <details className="mb-4"><summary>Need help recovering your account?</summary>
            <p>Contact the office handling your complaint for assisted account recovery. If you still have your private receipt, you can track the complaint from the case portal.</p>
          </details>}
          {tab === 'login'
            ? <LoginForm destination={destination} login={login} navigate={navigate} showToast={showToast} />
            : <RegisterForm setTab={setTab} showToast={showToast} />
          }
      </section></div>
    </main>
  )
}

/* ── LOGIN FORM ─────────────────────────────────────────────────── */
function LoginForm({ destination, login, navigate, showToast }) {
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
      navigate(destination === "/" ? "/#file-case" : destination, { replace: true })
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
  const [proof,setProof] = useState(null)
  const [required, setRequired] = useState(null)
  const [settingsAttempt, setSettingsAttempt] = useState(0)
  useEffect(() => {
    let active = true
    request('/auth/registration-settings')
      .then(data => { if (active) setRequired(data.verification_required) })
      .catch(() => { if (active) setError('Could not load registration settings.') })
    return () => { active = false }
  }, [settingsAttempt])

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
    if (!/^(?:[+]91|91)?[6-9][0-9]{9}$/.test(form.phone.trim()))
      errs.phone = 'Enter a valid 10-digit mobile number.'
    setFE(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return
    if (required === null) return
    if (required && (!proof || proof.phone !== form.phone)) return setError('Verify your mobile number first.')

    setLoading(true)
    try {
      await api.auth.register({
        username : form.username.trim().toLowerCase(),
        email    : form.email.trim(),
        password : form.password,
        full_name: form.fullName.trim(),
        phone    : form.phone.trim(),
        ...(required && { phone_proof: proof.value }),
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

      <Field label="Mobile number *" icon={<Phone size={16} className="text-gray-400"/>} error={fieldErrors.phone}>
        <input className={`input pl-10 ${fieldErrors.phone ? 'error':''}`} type="tel"
          placeholder="9876543210" value={form.phone} onChange={e=>{setProof(null);set('phone')(e)}} disabled={loading} autoComplete="tel" />
      </Field>

      {required === null && error && <button type="button" onClick={() => { setError(''); setSettingsAttempt(n => n + 1) }}>Retry loading settings</button>}
      {required && (proof?.phone === form.phone
        ? <p role="status">Mobile number verified. <button type="button" onClick={()=>setProof(null)}>Verify again</button></p>
        : <PhoneVerification key={form.phone} phone={form.phone} onVerified={value=>setProof({phone:form.phone,value})}/>)}
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

      <button type="submit" disabled={loading || required === null} className="btn-primary w-full py-3 text-base mt-1">
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
