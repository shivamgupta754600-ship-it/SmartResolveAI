import { useState, useEffect, useRef } from 'react'
import {
  SendHorizonal, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, Clock, FileText, ChevronDown, ChevronUp,
  Zap, Info, MapPin, Phone, User, X, Save
} from 'lucide-react'
import Navbar from '../components/Navbar'
import CircleGauge from '../components/CircleGauge'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

/* ── category metadata ──────────────────────────────────────────── */
const CAT_META = {
  water_supply        : { icon: '💧', color: '#0284c7', bg: '#e0f2fe', label: 'Water Supply'      },
  electricity         : { icon: '⚡', color: '#d97706', bg: '#fef3c7', label: 'Electricity'       },
  road_infrastructure : { icon: '🛣️', color: '#475569', bg: '#f1f5f9', label: 'Roads'              },
  waste_management    : { icon: '♻️', color: '#16a34a', bg: '#dcfce7', label: 'Waste Management'  },
  streetlight         : { icon: '💡', color: '#7c3aed', bg: '#ede9fe', label: 'Streetlights'      },
  healthcare_services : { icon: '🏥', color: '#dc2626', bg: '#fee2e2', label: 'Healthcare'         },
  education_services  : { icon: '📚', color: '#1d4ed8', bg: '#dbeafe', label: 'Education'          },
  other               : { icon: '📋', color: '#64748b', bg: '#f1f5f9', label: 'Other'              },
}
function catMeta(cat) { return CAT_META[cat] ?? { icon: '📋', color: '#64748b', bg: '#f1f5f9', label: cat } }

export default function DashboardPage() {
  const { user, refreshUser }   = useAuth()
  const { showToast }           = useToast()

  const [text, setText]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [history, setHistory]     = useState([])
  const [histLoading, setHL]      = useState(true)
  const [showProbs, setShowProbs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const resultRef = useRef(null)
  const MAX = 1000

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    setHL(true)
    try { setHistory(await api.grievances.history()) }
    catch (e) { showToast('Could not load history: ' + e.message, 'error') }
    finally { setHL(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setResult(null); setShowProbs(false)
    const trimmed = text.trim()
    if (!trimmed)       return setError('Please describe your grievance.')
    if (trimmed.length < 5) return setError('Must be at least 5 characters.')

    setLoading(true)
    try {
      const res = await api.grievances.predict(trimmed)
      setResult(res)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
      loadHistory()
    } catch (err) {
      setError(err.message || 'Prediction failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const greeting = user?.full_name ? user.full_name.split(' ')[0] : user?.username ?? 'Citizen'

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── HERO BANNER ───────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-indigo-800 p-6 sm:p-8">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 right-20 w-28 h-28 rounded-full bg-indigo-500/15" />
          <div className="relative z-10">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-white text-2xl sm:text-3xl font-black mb-1.5">
                  Namaste, {greeting} 👋
                </h1>
                <p className="text-blue-200 text-sm font-medium max-w-lg">
                  Describe your problem below — in Hindi, English, or Hinglish.
                  Our AI will classify it and suggest the right department.
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-200 font-medium">
                <div className="text-center">
                  <div className="text-white text-xl font-black">{history.length}</div>
                  <div className="text-xs">Submissions</div>
                </div>
                <div className="text-center">
                  <div className="text-white text-xl font-black">
                    {history.filter(h => h.review_status === 'approved').length}
                  </div>
                  <div className="text-xs">Approved</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── PROFILE INCOMPLETE BANNER ────────────────────────── */}
        {user && !user.profile_complete && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <MapPin size={20} className="text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 text-sm font-semibold">Complete your profile</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Add your address &amp; phone so the department can visit your location and contact you.
              </p>
            </div>
            <button onClick={() => setShowProfile(true)}
              className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap">
              Add Now
            </button>
          </div>
        )}

        {/* ── SUBMIT FORM ───────────────────────────────────────── */}
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-5">
            <FileText size={20} className="text-brand-700" />
            <h2 className="text-lg font-bold text-gray-900">Submit a Grievance</h2>
          </div>

          {/* Language chips */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {['🇮🇳 Hindi', '🇬🇧 English', '🌐 Hinglish'].map(l => (
              <span key={l} className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold border border-brand-100">
                {l}
              </span>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="relative">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={MAX}
                rows={5}
                placeholder="e.g. हमारे मोहल्ले में पिछले 3 दिनों से पानी नहीं आ रहा है…&#10;or: The street light near Gate 4 has been broken for a week."
                className={`input resize-none text-base leading-relaxed transition-all duration-200
                  ${error ? 'border-red-400 focus:ring-red-500/20 focus:border-red-400' : ''}`}
              />
              {/* Char counter */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className={`text-xs font-medium ${text.length > 900 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {text.length}/{MAX}
                </span>
              </div>
            </div>

            {/* Progress bar under textarea */}
            <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(text.length / MAX) * 100}%`,
                  background: text.length > 900 ? '#f97316' : '#1e40af'
                }}
              />
            </div>

            {error && (
              <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1.5 animate-fade-in">
                <AlertTriangle size={14} /> {error}
              </p>
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Info size={12}/> Predictions are AI-generated and require human review.
              </p>
              <button type="submit" disabled={loading || !text.trim()} className="btn-primary px-6 py-2.5">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Classifying…</>
                  : <><SendHorizonal size={16}/>Classify Grievance</>
                }
              </button>
            </div>
          </form>
        </div>

        {/* ── RESULT CARD ───────────────────────────────────────── */}
        {result && (
          <div ref={resultRef} className="animate-slide-up">
            <ResultCard result={result} showProbs={showProbs} setShowProbs={setShowProbs} />
          </div>
        )}

        {/* ── HISTORY TABLE ─────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-brand-700" />
              <h2 className="text-base font-bold text-gray-900">My Recent Submissions</h2>
            </div>
            <button onClick={loadHistory} className="btn-ghost gap-1.5 text-sm">
              <RefreshCw size={14} className={histLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {histLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin"/>
              Loading history…
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <span className="text-5xl">📭</span>
              <p className="font-medium">No submissions yet.</p>
              <p className="text-sm">Submit your first grievance above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100">
                    {['Ticket', 'Grievance', 'Department', 'Confidence', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const meta   = catMeta(row.predicted_category)
                    const pct    = Math.round(row.confidence * 100)
                    const date   = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    const status = row.review_status
                    return (
                      <tr key={row.id} className="border-b border-gray-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs">
                          <span className="text-brand-700 font-bold">{row.ticket_number ?? `#${row.id}`}</span>
                        </td>
                        <td className="px-4 py-3.5 max-w-[240px]">
                          <p className="truncate text-gray-700 font-medium">{row.grievance_text}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: meta.bg, color: meta.color }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bar-fill"
                                style={{
                                  width: `${pct}%`,
                                  background: row.confidence >= 0.8 ? '#16a34a' : row.confidence >= 0.6 ? '#d97706' : '#dc2626'
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={status} needsReview={row.needs_human_review} />
                        </td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── PROFILE MODAL ─────────────────────────────────────── */}
      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={async () => { await refreshUser(); setShowProfile(false); showToast('Profile updated!', 'success') }}
          showToast={showToast}
        />
      )}
    </div>
  )
}

/* ── Profile modal ───────────────────────────────────────────────── */
function ProfileModal({ user, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone    : user?.phone    || '',
    address  : user?.address  || '',
    city     : user?.city     || '',
    state    : user?.state    || '',
    pincode  : user?.pincode  || '',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.auth.updateProfile(form)
      onSaved()
    } catch (err) {
      showToast(err.message || 'Update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-brand-700" />
            <h3 className="font-bold text-gray-900">Complete Your Profile</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Your address and phone help the department officer reach you and visit your location to resolve the issue.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" value={form.full_name} onChange={set('full_name')} placeholder="Ramesh Kumar" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mobile Number *</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" type="tel" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Street Address</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-3 text-gray-400" />
                <textarea className="input pl-9 resize-none" rows={2} value={form.address} onChange={set('address')}
                  placeholder="House No, Street, Mohalla / Colony" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">City / Town</label>
              <input className="input" value={form.city} onChange={set('city')} placeholder="Delhi" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">State</label>
              <input className="input" value={form.state} onChange={set('state')} placeholder="Delhi" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Pincode</label>
              <input className="input" value={form.pincode} onChange={set('pincode')} placeholder="110001" maxLength={6} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <Save size={15} />}
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Result card ─────────────────────────────────────────────────── */
function ResultCard({ result, showProbs, setShowProbs }) {
  const meta = catMeta(result.predicted_category)
  const sortedProbs = Object.entries(result.probabilities).sort((a, b) => b[1] - a[1])

  return (
    <div className="card p-6 sm:p-8" style={{ borderLeft: `4px solid ${meta.color}` }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* Category info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ background: meta.bg }}>
            {meta.icon}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Predicted Department
            </div>
            <h3 className="text-2xl font-black" style={{ color: meta.color }}>
              {meta.label}
            </h3>
            {result.ticket_number && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg">
                🎫 {result.ticket_number}
              </div>
            )}
            <div className="mt-2">
              {result.needs_human_review
                ? <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                    <AlertTriangle size={12}/> Needs Human Review
                  </span>
                : <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    <CheckCircle2 size={12}/> Classified Successfully
                  </span>
              }
            </div>
          </div>
        </div>

        {/* Gauge */}
        <CircleGauge value={result.confidence} size={120} />
      </div>

      {/* Review message */}
      <div className={`mt-5 flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
        ${result.needs_human_review
          ? 'bg-yellow-50 text-yellow-800 border border-yellow-100'
          : 'bg-green-50 text-green-800 border border-green-100'
        }`}>
        {result.needs_human_review ? <AlertTriangle size={16} className="shrink-0 mt-0.5"/> : <CheckCircle2 size={16} className="shrink-0 mt-0.5"/>}
        {result.review_message}
      </div>

      {/* Probability breakdown toggle */}
      <button
        onClick={() => setShowProbs(v => !v)}
        className="mt-5 flex items-center gap-2 text-sm text-gray-500 font-semibold hover:text-gray-700 transition-colors"
      >
        <TrendingUp size={15}/>
        All category probabilities
        {showProbs ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
      </button>

      {showProbs && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {sortedProbs.map(([cat, prob]) => {
            const m   = catMeta(cat)
            const pct = Math.round(prob * 100)
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-base w-6 text-center">{m.icon}</span>
                <span className="w-36 text-xs font-semibold text-gray-600 truncate">{m.label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bar-fill" style={{ width: `${pct}%`, background: m.color }} />
                </div>
                <span className="w-10 text-right text-xs font-bold text-gray-600">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Safety note */}
      <p className="mt-5 text-xs text-gray-400 flex items-center gap-1.5 border-t border-gray-100 pt-4">
        <Info size={12} className="shrink-0"/> {result.safety_note}
      </p>
    </div>
  )
}

/* ── Status badge ─────────────────────────────────────────────────── */
function StatusBadge({ status, needsReview }) {
  if (status === 'approved') return (
    <span className="badge badge-green"><CheckCircle2 size={11}/> Approved</span>
  )
  if (status === 'rejected') return (
    <span className="badge badge-red">Rejected</span>
  )
  if (needsReview) return (
    <span className="badge badge-yellow"><AlertTriangle size={11}/> Needs Review</span>
  )
  return <span className="badge badge-gray">Pending</span>
}
