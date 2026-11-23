import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Eye, ChevronDown, ChevronUp, Users, FileText, Clock, TrendingUp
} from 'lucide-react'
import Navbar from '../components/Navbar'
import CircleGauge from '../components/CircleGauge'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

const CAT_META = {
  water_supply     : { icon: '💧', color: '#0284c7', bg: '#e0f2fe', label: 'Water Supply'      },
  electricity      : { icon: '⚡', color: '#d97706', bg: '#fef3c7', label: 'Electricity'       },
  roads            : { icon: '🛣️', color: '#475569', bg: '#f1f5f9', label: 'Roads'              },
  waste_management : { icon: '♻️', color: '#16a34a', bg: '#dcfce7', label: 'Waste Management'  },
  streetlights     : { icon: '💡', color: '#7c3aed', bg: '#ede9fe', label: 'Streetlights'      },
  healthcare       : { icon: '🏥', color: '#dc2626', bg: '#fee2e2', label: 'Healthcare'         },
  education        : { icon: '📚', color: '#1d4ed8', bg: '#dbeafe', label: 'Education'          },
  other            : { icon: '📋', color: '#64748b', bg: '#f1f5f9', label: 'Other'              },
}
function catMeta(cat) { return CAT_META[cat] ?? { icon: '📋', color: '#64748b', bg: '#f1f5f9', label: cat } }

const FILTER_TABS = [
  { id: 'review',   label: 'Needs Review', icon: <AlertTriangle size={14}/> },
  { id: 'all',      label: 'All',          icon: <FileText size={14}/>      },
]

export default function AdminPage() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('review')
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [stats, setStats]         = useState(null)
  const [selected, setSelected]   = useState(null)   // row for review modal
  const [expandedId, setExpandedId] = useState(null) // inline expand

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [all, queue] = await Promise.all([
        api.grievances.all(),
        api.grievances.reviewQueue(),
      ])
      // compute stats from all
      const approved = all.filter(r => r.review_status === 'approved').length
      const rejected = all.filter(r => r.review_status === 'rejected').length
      const pending  = all.filter(r => r.review_status === 'pending').length
      const avgConf  = all.length ? all.reduce((s, r) => s + r.confidence, 0) / all.length : 0

      setStats({ total: all.length, approved, rejected, pending, needsReview: queue.length, avgConf })
      setRows(activeTab === 'review' ? queue : all)
    } catch (err) {
      showToast('Failed to load data: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { loadData() }, [loadData])

  async function handleReview(id, status, notes) {
    try {
      await api.grievances.review(id, { review_status: status, review_notes: notes })
      showToast(`Grievance ${status === 'approved' ? 'approved' : 'rejected'} successfully.`, 'success')
      setSelected(null)
      loadData()
    } catch (err) {
      showToast('Review failed: ' + err.message, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={22} className="text-brand-700"/>
              <h1 className="text-2xl font-black text-gray-900">Admin Panel</h1>
            </div>
            <p className="text-sm text-gray-500">Review AI-classified grievances and manage queue.</p>
          </div>
          <button onClick={loadData} className="btn-ghost gap-1.5 text-sm self-start">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── STATS GRID ──────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total" value={stats.total}      icon={<FileText size={18}/>}      color="brand" />
            <StatCard label="Pending" value={stats.pending}  icon={<Clock size={18}/>}         color="gray"  />
            <StatCard label="Approved" value={stats.approved} icon={<CheckCircle2 size={18}/>} color="green" />
            <StatCard label="Rejected" value={stats.rejected} icon={<XCircle size={18}/>}      color="red"   />
            <StatCard label="Needs Review" value={stats.needsReview} icon={<AlertTriangle size={18}/>} color="yellow" />
            <StatCard label="Avg Confidence" value={`${Math.round(stats.avgConf * 100)}%`} icon={<TrendingUp size={18}/>} color="indigo" />
          </div>
        )}

        {/* ── FILTER TABS + TABLE ─────────────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-4 pt-2 gap-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-sm font-semibold border-b-2 transition-all
                  ${activeTab === tab.id
                    ? 'text-brand-800 border-brand-700 bg-brand-50'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'review' && stats?.needsReview > 0 && (
                  <span className="ml-1 w-5 h-5 flex items-center justify-center bg-yellow-500 text-white text-[10px] font-black rounded-full">
                    {stats.needsReview}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin"/>
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <span className="text-5xl">{activeTab === 'review' ? '✅' : '📭'}</span>
              <p className="font-medium">{activeTab === 'review' ? 'Review queue is empty!' : 'No grievances found.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100">
                    {['#', 'User', 'Grievance', 'Department', 'Conf.', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const meta = catMeta(row.predicted_category)
                    const pct  = Math.round(row.confidence * 100)
                    const date = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    const expanded = expandedId === row.id
                    return [
                      <tr key={row.id} className={`border-b border-gray-50 hover:bg-slate-50/60 transition-colors cursor-pointer
                        ${expanded ? 'bg-brand-50/40' : ''}`}
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                      >
                        <td className="px-4 py-3.5 text-gray-400 font-mono text-xs">#{row.id}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-medium text-gray-600">
                            {row.username ?? <span className="text-gray-300 italic">anon</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <p className="truncate text-gray-700 text-xs">{row.grievance_text}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: meta.bg, color: meta.color }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={row.review_status} needsReview={row.needs_human_review} />
                        </td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">{date}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setSelected(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-semibold hover:bg-brand-100 transition-colors"
                            >
                              <Eye size={11}/> Review
                            </button>
                            {expanded ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                          </div>
                        </td>
                      </tr>,
                      expanded && (
                        <tr key={`exp-${row.id}`} className="bg-brand-50/30 border-b border-gray-100">
                          <td colSpan={8} className="px-6 py-4">
                            <ExpandedRow row={row} onReview={handleReview} />
                          </td>
                        </tr>
                      )
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── REVIEW MODAL ─────────────────────────────────────────── */}
      {selected && (
        <ReviewModal row={selected} onClose={() => setSelected(null)} onReview={handleReview} />
      )}
    </div>
  )
}

/* ── Expanded inline row ───────────────────────────────────────── */
function ExpandedRow({ row, onReview }) {
  const meta = catMeta(row.predicted_category)
  const sortedProbs = Object.entries(row.probabilities ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-wrap gap-6 items-start">
      {/* Full text */}
      <div className="flex-1 min-w-[200px]">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Full Grievance</div>
        <p className="text-sm text-gray-700 leading-relaxed">{row.grievance_text}</p>
        {row.review_notes && (
          <div className="mt-3 px-3 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-500">
            <strong className="text-gray-600">Review note:</strong> {row.review_notes}
          </div>
        )}
      </div>

      {/* Gauge */}
      <CircleGauge value={row.confidence} size={80} />

      {/* Probabilities */}
      {sortedProbs.length > 0 && (
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Category Probabilities</div>
          <div className="space-y-1.5">
            {sortedProbs.slice(0, 5).map(([cat, prob]) => {
              const m = catMeta(cat)
              const pct = Math.round(prob * 100)
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-sm w-5 text-center">{m.icon}</span>
                  <span className="w-28 text-xs text-gray-500 truncate">{m.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                  </div>
                  <span className="text-xs font-bold text-gray-500 w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {row.review_status === 'pending' && (
        <div className="flex flex-col gap-2 justify-start">
          <button
            onClick={() => onReview(row.id, 'approved', '')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-colors"
          >
            <CheckCircle2 size={13}/> Approve
          </button>
          <button
            onClick={() => onReview(row.id, 'rejected', '')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors"
          >
            <XCircle size={13}/> Reject
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Review modal ──────────────────────────────────────────────── */
function ReviewModal({ row, onClose, onReview }) {
  const [notes, setNotes]       = useState(row.review_notes ?? '')
  const [status, setStatus]     = useState(row.review_status === 'pending' ? '' : row.review_status)
  const [loading, setLoading]   = useState(false)
  const meta = catMeta(row.predicted_category)

  async function submit() {
    if (!status) return
    setLoading(true)
    await onReview(row.id, status, notes)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-brand-700"/>
            <h3 className="font-bold text-gray-900">Review Grievance #{row.id}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Category chip */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
              style={{ background: meta.bg, color: meta.color }}>
              {meta.icon} {meta.label}
            </span>
            <CircleGauge value={row.confidence} size={60} />
          </div>

          {/* Full text */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Grievance Text</div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed max-h-32 overflow-y-auto">
              {row.grievance_text}
            </div>
          </div>

          {/* Decision buttons */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Decision</div>
            <div className="flex gap-3">
              {['approved', 'rejected'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2
                    ${status === s
                      ? s === 'approved'
                        ? 'bg-green-500 text-white border-green-500 shadow-md'
                        : 'bg-red-500 text-white border-red-500 shadow-md'
                      : s === 'approved'
                        ? 'border-green-200 text-green-600 hover:bg-green-50'
                        : 'border-red-200 text-red-500 hover:bg-red-50'
                    }`}
                >
                  {s === 'approved' ? <CheckCircle2 size={15}/> : <XCircle size={15}/>}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Review Notes <span className="normal-case font-normal">(optional)</span></div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Add any notes for the citizen or record…"
              className="input resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={!status || loading} className="btn-primary flex-1">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving…</>
              : 'Submit Review'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Stat card ─────────────────────────────────────────────────── */
const colorMap = {
  brand:  { bg: 'bg-brand-50',  text: 'text-brand-700',  icon: 'text-brand-500'  },
  gray:   { bg: 'bg-slate-50',  text: 'text-slate-700',  icon: 'text-slate-400'  },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500'  },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    icon: 'text-red-500'    },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-500' },
}
function StatCard({ label, value, icon, color }) {
  const c = colorMap[color] ?? colorMap.gray
  return (
    <div className={`card p-4 flex flex-col gap-2 ${c.bg}`}>
      <div className={`${c.icon}`}>{icon}</div>
      <div>
        <div className={`text-xl font-black ${c.text}`}>{value}</div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  )
}

/* ── Status badge ──────────────────────────────────────────────── */
function StatusBadge({ status, needsReview }) {
  if (status === 'approved') return (
    <span className="badge badge-green flex items-center gap-1"><CheckCircle2 size={10}/> Approved</span>
  )
  if (status === 'rejected') return (
    <span className="badge badge-red flex items-center gap-1"><XCircle size={10}/> Rejected</span>
  )
  if (needsReview) return (
    <span className="badge badge-yellow flex items-center gap-1"><AlertTriangle size={10}/> Needs Review</span>
  )
  return <span className="badge badge-gray">Pending</span>
}
