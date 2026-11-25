import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { caseRequest } from '../api/cases'
import { formatDate, IntakeForm, useCatalog } from './CasePortal'

const statusLabels = {
  received: 'Received', assigned: 'Assigned', in_progress: 'In progress',
  needs_information: 'Waiting for resident', resolved: 'Resolved', reopen_requested: 'Reopening requested',
}
const actions = {
  assign: ['Assign', ['received', 'assigned']],
  transfer: ['Transfer', ['received', 'assigned', 'in_progress', 'needs_information', 'reopen_requested']],
  start: ['Start work', ['assigned']],
  request_information: ['Request details', ['assigned', 'in_progress']],
  update: ['Post update', ['assigned', 'in_progress', 'needs_information']],
  resolve: ['Resolve', ['assigned', 'in_progress', 'needs_information']],
  accept_reopen: ['Accept reopening', ['reopen_requested']],
  decline_reopen: ['Decline reopening', ['reopen_requested']],
}
const errors = {
  invalid_staff_credentials: 'Check your username, password, and current authenticator code.',
  outside_scope: 'Your staff role does not cover this action.',
  case_not_found: 'This case is unavailable in your queue.',
  invalid_transition: 'The case has changed. Open it again to see its current status.',
  note_required: 'Enter a reason or message for the resident.',
  choose_department: 'Choose a different department.',
  staff_sign_in_required: 'Your session expired. Sign in again.',
  department_unstaffed: 'The receiving department has no active staff for this ward.',
  inactive_officer: 'Select an active officer.',
}

function CaseDetail({ selected, scope, catalog, onAction, busy }) {
  const supervisor = scope.some(item => item.ward === selected.ward && item.department === selected.department && item.role === 'supervisor')
  const ownsCase = !selected.officer_id || selected.assigned_to_me || supervisor
  const available = ownsCase ? Object.entries(actions).filter(([key, [, statuses]]) =>
    statuses.includes(selected.status) && (supervisor || !['transfer', 'accept_reopen', 'decline_reopen'].includes(key))) : []
  const [action, setAction] = useState('')

  return <>
    <h2>{selected.ticket}</h2>
    <p><strong>{statusLabels[selected.status]}</strong> · {selected.ward} · {selected.department}</p>
    <p>Reported by {selected.channel === 'web' ? 'web' : selected.channel === 'desk' ? 'help desk' : 'phone'} · {selected.language === 'hi' ? 'Hindi' : 'English'}</p>
    <p><strong>Location</strong> · <span dir="auto">{selected.location}</span></p>
    <p dir="auto">{selected.description}</p>
    {selected.status !== 'resolved' && <p>Next update due · {formatDate(selected.next_update_at)}</p>}
    {selected.escalated_at && <p><strong>Escalated</strong> · {formatDate(selected.escalated_at)}</p>}
    <p>Assigned officer · {selected.officers.find(officer => officer.id === selected.officer_id)?.username ?? 'Unassigned'}</p>
    <p>AI suggestion · {selected.suggested_category
      ? `${selected.suggested_category} (${Math.round(selected.suggestion_confidence * 100)}% confidence)`
      : selected.suggestion_state === 'pending' ? 'Pending' : 'Unavailable'}</p>
    {available.length > 0 && <form onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const body = { action }
      if (data.get('department')) body.department = data.get('department')
      if (data.get('officer_id')) body.officer_id = Number(data.get('officer_id'))
      if (data.get('note')?.trim()) body.note = data.get('note')
      onAction(body)
    }}>
      <label>Action<select required value={action} onChange={event => setAction(event.target.value)}>
        <option value="">Choose an action</option>
        {available.map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      {action === 'assign' && supervisor && <label>Officer<select name="officer_id">
        <option value="">Assign to myself</option>
        {selected.officers.map(officer => <option key={officer.id} value={officer.id}>{officer.username}</option>)}
      </select></label>}
      {action === 'transfer' && <label>Receiving department<select name="department" required>
        <option value="">Choose a department</option>
        {catalog?.departments.filter(item => item.code !== selected.department).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
      </select></label>}
      <label>Message for resident ({selected.language === 'hi' ? 'Hindi' : 'English'})
        <textarea key={action} name="note" maxLength={2000} rows={3} required={Boolean(action && !['assign', 'start'].includes(action))} />
      </label>
      <button disabled={busy || !action}>Save action</button>
    </form>}
    <div className="case-timeline">
      <h3>Case timeline</h3>
      <ol>{selected.events.map(item => <li key={item.id}>
        <strong>{actions[item.kind]?.[0] ?? statusLabels[item.kind] ?? item.kind}</strong> · {formatDate(item.created_at)}
        {item.note && <p dir="auto">{item.note}</p>}
      </li>)}</ol>
    </div>
  </>
}

export default function StaffCases() {
  const [token, setToken] = useState('')
  const [scope, setScope] = useState([])
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [metrics, setMetrics] = useState([])
  const [more, setMore] = useState(false)
  const [filter, setFilter] = useState('open')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [intakeLanguage, setIntakeLanguage] = useState('en')
  const catalogState = useCatalog()

  function logout() {
    setToken('')
    setScope([])
    setQueue([])
    setMetrics([])
    setSelected(null)
    setNotice('')
    setError('')
  }

  async function run(work) {
    setError('')
    setBusy(true)
    try {
      await work()
    } catch (err) {
      if (err.message === 'staff_sign_in_required') logout()
      setError(errors[err.message] || 'The request failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function loadQueue(session = token, after = 0, status = filter) {
    const items = await caseRequest(`/staff/queue?after=${after}&limit=25&filter=${status}`, { token: session })
    setQueue(previous => after ? [...previous, ...items] : items)
    setMore(items.length === 25)
  }

  async function loadMetrics(session = token) {
    setMetrics(await caseRequest('/staff/metrics', { token: session }))
  }

  useEffect(() => {
    if (!token) return
    const timeout = setTimeout(() => logout(), 30 * 60 * 1000)
    return () => clearTimeout(timeout)
  }, [token])

  function login(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    run(async () => {
      const { access_token } = await caseRequest('/staff/session', { body })
      setScope(await caseRequest('/staff/scope', { token: access_token }))
      await loadQueue(access_token, 0, 'open')
      await loadMetrics(access_token)
      setFilter('open')
      setToken(access_token)
    })
  }

  function open(ticket) {
    run(async () => {
      setNotice('')
      setSelected(await caseRequest(`/staff/case/${ticket}`, { token }))
    })
  }

  function save(body) {
    run(async () => {
      const ticket = selected.ticket
      await caseRequest(`/staff/case/${ticket}`, { body, token })
      setNotice('Case updated.')
      setSelected(body.action === 'transfer' ? null : await caseRequest(`/staff/case/${ticket}`, { token }))
      await loadQueue()
      await loadMetrics()
    })
  }

  const intake = scope.some(item => ['intake', 'supervisor'].includes(item.role))
  const handlesCases = scope.some(item => ['officer', 'supervisor'].includes(item.role))
  return <main className="case-page">
    <header className="case-header"><Link to="/">Resident portal</Link>
      {token && <button type="button" disabled={busy} onClick={logout}>Sign out</button>}
    </header>
    <h1>{token ? 'Municipal case workspace' : 'Staff sign-in'}</h1>
    {error && <p role="alert">{error}</p>}
    {(notice || busy) && <p role="status">{busy ? 'Please wait…' : notice}</p>}
    {!token ? <section className="case-grid">
      <form onSubmit={login}>
        <label>Username<input name="username" maxLength={50} autoComplete="username" required /></label>
        <label>Password<input type="password" name="password" maxLength={72} autoComplete="current-password" required /></label>
        <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>
        <button disabled={busy}>Sign in</button>
      </form>
    </section> : <div className="case-grid">
      {handlesCases && <section aria-labelledby="queue-heading">
        <h2 id="queue-heading">Department queue</h2>
        <label>Show cases<select value={filter} disabled={busy} onChange={event => {
          const value = event.target.value
          setFilter(value)
          run(() => loadQueue(token, 0, value))
        }}>
          <option value="open">Open</option><option value="overdue">Overdue</option><option value="resolved">Resolved</option>
        </select></label>
        <button type="button" className="case-refresh" disabled={busy} onClick={() => run(async () => {
          await loadQueue()
          await loadMetrics()
        })}>Refresh queue</button>
        <ul className="case-queue">{queue.map(item => <li key={item.id}>
          <button type="button" disabled={busy} onClick={() => open(item.ticket)}>{item.ticket}</button>
          <span>{statusLabels[item.status]} · {item.ward} · {item.department}</span>
          {item.escalated_at && <strong>Escalated to supervisors</strong>}
          {item.status !== 'resolved' && <span>Update due · {formatDate(item.next_update_at)}</span>}
        </li>)}</ul>
        {!queue.length && <p>No cases match this filter.</p>}
        {more && <button type="button" disabled={busy} onClick={() => run(() => loadQueue(token, queue.at(-1).id))}>Load more</button>}
      </section>}
      {selected && <section><CaseDetail key={selected.ticket + selected.status} selected={selected} scope={scope}
        catalog={catalogState.catalog} onAction={save} busy={busy} /></section>}
      {intake && <section><h2>Assisted intake</h2>
        <label>Resident language<select value={intakeLanguage} onChange={event => setIntakeLanguage(event.target.value)}>
          <option value="en">English</option><option value="hi" lang="hi">हिन्दी</option>
        </select></label>
        <div lang={intakeLanguage}><IntakeForm {...catalogState} token={token} scope={scope} lang={intakeLanguage} /></div>
      </section>}
      {scope.some(item => item.role === 'supervisor') && <section className="case-metrics"><h2>Supervisor metrics</h2>
        {!metrics.length && <p>No cases to report.</p>}
        {metrics.map(row => <article key={row.ward + '/' + row.department + '/' + row.language}>
          <h3>{row.ward} · {row.department} · {row.language === 'hi' ? 'Hindi' : 'English'}</h3>
          <p>{row.total} cases · {row.resolved} resolved · {row.overdue} overdue</p>
          <p>Average time to assignment · {row.avg_assignment_minutes === null ? '—' : Math.round(Number(row.avg_assignment_minutes)) + ' min'}</p>
          <p>{row.transferred} transferred · {row.reopened} cases with reopening requests</p>
          <p>AI agreed with confirmed routing on {row.matching} of {row.assessed} assessed cases</p>
        </article>)}
      </section>}
    </div>}
  </main>
}
