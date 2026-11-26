import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { revokeSession } from '../api/client'
import { caseRequest } from '../api/cases'
import { formatDate, IntakeForm, useCatalog } from './CasePortal'

import PortalHeader from '../components/PortalHeader'
import CasePhoto from '../components/CasePhoto'
import { OfficeActions, CivicDesk } from './MunicipalTools'
import { replyTemplate } from './staffTemplates'

const statusLabels = {
  received: 'Received', assigned: 'Assigned', in_progress: 'In progress',
  needs_information: 'Waiting for resident', resolved: 'Resolved', reopen_requested: 'Reopening requested',
}
const actions = {
  assign: ['Assign or reassign', ['received', 'assigned', 'in_progress', 'needs_information', 'reopen_requested']],
  visit: ['Record a field visit', ['assigned', 'in_progress']],
  blocked: ['Record a blocker', ['assigned', 'in_progress']],
  transfer: ['Transfer', ['received', 'assigned', 'in_progress', 'needs_information', 'reopen_requested']],
  start: ['Start work', ['assigned']],
  request_information: ['Request details', ['assigned', 'in_progress']],
  update: ['Post update', ['assigned', 'in_progress', 'needs_information']],
  resolve: ['Resolve', ['assigned', 'in_progress', 'needs_information']],
  accept_reopen: ['Accept reopening', ['reopen_requested']],
  decline_reopen: ['Decline reopening', ['reopen_requested']],
}
const errors = {
  case_changed: 'This case changed since you opened it. Review the latest case before saving.',
  invalid_staff_credentials: 'Check your username, password, and current authenticator code.',
  outside_scope: 'Your staff role does not cover this action.',
  case_not_found: 'This case is unavailable in your queue.',
  invalid_transition: 'The case has changed. Open it again to see its current status.',
  note_required: 'Enter a reason or message for the resident.',
  choose_department: 'Choose a different department.',
  staff_sign_in_required: 'Your session expired. Sign in again.',
  department_unstaffed: 'The receiving department has no active staff for this ward.',
  invalid_link: 'Choose open cases in the same service and ward.',
  different_incidents: 'These cases already belong to different incidents.',
  future_deadline_required: 'Choose a future update time.',
  inactive_officer: 'Select an active officer.',
}

function CaseDetail({ selected, token, scope, catalog, onAction, onIncident, busy }) {
  const supervisor = scope.some(item => item.ward === selected.ward && item.department === selected.department && item.role === 'supervisor')
  const ownsCase = !selected.officer_id || selected.assigned_to_me || supervisor
  const available = ownsCase ? Object.entries(actions).filter(([key, [, statuses]]) =>
    statuses.includes(selected.status) && (supervisor || !['transfer', 'accept_reopen', 'decline_reopen'].includes(key))) : []
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [fieldMode, setFieldMode] = useState(false)
  const started = useRef(null)
  const template = replyTemplate(selected.department, action, selected.language)
  const latestReply = selected.events.filter(e => ['in_progress', 'reopen_requested'].includes(e.kind)).at(-1)
  const fieldAction = action === 'visit' || action === 'blocked'
  function chooseAction(value) {
    setNote('')
    started.current = null
    setAction(value)
  }

  return <>
    <h2>{fieldMode ? 'Field work' : selected.ticket}</h2>
    {available.some(([key]) => key === 'visit') && <button type="button" onClick={() => {
      chooseAction(fieldMode ? '' : 'visit')
      setFieldMode(!fieldMode)
    }}>{fieldMode ? 'Back to case' : 'Open field view'}</button>}
    {fieldMode && <p>{selected.ticket}</p>}
    <p><strong>{statusLabels[selected.status]}</strong> · {selected.ward} · {selected.department}</p>
    <p>Reported by {selected.channel === 'web' ? 'web' : selected.channel === 'desk' ? 'help desk' : 'phone'} · {selected.language === 'hi' ? 'Hindi' : 'English'}</p>
    {selected.resident_contact && <p><strong>Resident contact</strong> · {selected.resident_contact.full_name} · <a href={'tel:+91'+selected.resident_contact.phone?.slice(-10)}>{selected.resident_contact.phone}</a></p>}
    <p><strong>Location</strong> · <span dir="auto">{selected.location}</span></p>
    <p dir="auto">{selected.description}</p>
    {selected.status !== 'resolved' && <p>Next update due · {formatDate(selected.next_update_at)}</p>}
    {selected.escalated_at && <p><strong>Escalated</strong> · {formatDate(selected.escalated_at)}</p>}
    <p>Assigned officer · {selected.officers.find(officer => officer.id === selected.officer_id)?.username ?? 'Unassigned'}</p>
    {!fieldMode && <p>AI suggestion · {selected.suggested_category
      ? `${selected.suggested_category} (${Math.round(selected.suggestion_confidence * 100)}% confidence)`
      : selected.suggestion_state === 'pending' ? 'Pending' : 'Unavailable'}</p>}
    {selected.has_photo && <CasePhoto ticket={selected.ticket} token={token}/>}
    {latestReply && <p><strong>Latest resident message</strong> · {latestReply.note}</p>}
    {available.some(([key]) => key === 'visit') && <div className="field-buttons">
      <button disabled={busy} onClick={() => chooseAction('visit')}>Record visit</button>
      <button disabled={busy} onClick={() => chooseAction('blocked')}>Record blocker</button>
    </div>}
    {available.length > 0 && <form onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const body = { action }
      if (data.get('department')) body.department = data.get('department')
      if (data.get('officer_id')) body.officer_id = Number(data.get('officer_id'))
      if (data.get('note')?.trim()) body.note = data.get('note')
      if (fieldAction) body.next_update_at = new Date(data.get('next_update')).toISOString()
      if (note && started.current !== null) body.compose_seconds = Math.min(86400, Math.floor((performance.now() - started.current) / 1000))
      onAction(body)
    }}>
      <label>Action<select required value={action} onChange={event => chooseAction(event.target.value)}>
        <option value="">Choose an action</option>
        {available.filter(([key]) => !fieldMode || ['visit', 'blocked'].includes(key)).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      {action === 'assign' && supervisor && <label>Officer<select name="officer_id">
        <option value="">Assign to myself</option>
        {selected.officers.map(officer => <option key={officer.id} value={officer.id}>{officer.username}</option>)}
      </select></label>}
      {action === 'transfer' && <label>Receiving department<select name="department" required>
        <option value="">Choose a department</option>
        {catalog?.departments.filter(item => item.code !== selected.department).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
      </select></label>}
      {fieldAction && <label>Next update (your local time)<input name="next_update" type="datetime-local" required /></label>}
      {template && <button type="button" disabled={busy} onClick={() => {
        started.current ??= performance.now()
        setNote(template)
      }}>Use reply template</button>}
      <label>Message for resident ({selected.language === 'hi' ? 'Hindi' : 'English'})
        <textarea key={action} name="note" value={note} onChange={event => setNote(event.target.value)}
          onFocus={() => { started.current ??= performance.now() }} maxLength={2000} rows={3} required={Boolean(action && !['assign', 'start'].includes(action))} />
      </label>
      <button disabled={busy || !action}>Save action</button>
    </form>}
    {!fieldMode && ownsCase && selected.status !== 'resolved' && <details className="incident-tools">
      <summary>Related reports ({selected.members.length} linked)</summary>
      {selected.members.map(member => <p key={member.ticket}>{member.ticket} · {statusLabels[member.status]}</p>)}
      {selected.matches.length > 0 && <h3>Possible matches at this location</h3>}
      {selected.matches.map(match => <p key={match.ticket}>{match.ticket} · {match.location} · {formatDate(match.created_at)}</p>)}
      <form onSubmit={event => {
        event.preventDefault()
        onIncident('link', { ticket: new FormData(event.currentTarget).get('ticket').trim().toUpperCase() })
      }}>
        <label>Confirm another ticket for this incident<input name="ticket" required maxLength={24} list="incident-matches" /></label>
        <datalist id="incident-matches">{selected.matches.map(match => <option key={match.ticket} value={match.ticket} />)}</datalist>
        <button disabled={busy}>Link reports</button>
      </form>
      {selected.members.filter(m => m.status !== 'resolved').length > 1 && <form onSubmit={event => {
        event.preventDefault()
        onIncident('broadcast', Object.fromEntries(new FormData(event.currentTarget)))
      }}>
        <h3>Update all open linked reports</h3>
        <label>English update<textarea name="english" required maxLength={2000} /></label>
        <label>Hindi update<textarea name="hindi" lang="hi" required maxLength={2000} /></label>
        <button disabled={busy}>Send shared update</button>
      </form>}
    </details>}
    {!fieldMode && <OfficeActions record={selected} editable={ownsCase} busy={busy} submit={onIncident}/>}
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
  const [workspace,setWorkspace] = useState('queue')
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [operations,setOperations] = useState(null)
  const [metrics, setMetrics] = useState([])
  const detailPanel = useRef(null)
  useEffect(() => {
    if (selected) detailPanel.current?.focus()
  }, [selected])
  const [more, setMore] = useState(false)
  const [filter, setFilter] = useState('mine')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [intakeLanguage, setIntakeLanguage] = useState('en')
  const catalogState = useCatalog()

  function logout() {
    void revokeSession(token)
    setToken('')
    setScope([])
    setQueue([])
    setOperations(null)
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
    const items = await caseRequest(`/staff/work?offset=${after}&view=${status}`, { token: session })
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
      const permissions = await caseRequest('/staff/scope', { token: access_token })
      setScope(permissions)
      setWorkspace(permissions.some(s => s.role !== 'intake') ? 'queue' : 'intake')
      await loadQueue(access_token, 0, 'mine')
      await loadMetrics(access_token)
      setFilter('mine')
      setToken(access_token)
    })
  }

  function open(ticket) {
    run(async () => {
      setNotice('')
      setSelected(null)
      setSelected(await caseRequest(`/staff/case/${ticket}`, { token }))
      setWorkspace('queue')
    })
  }

  function incident(operation, body) {
    run(async () => {
      const path = `/staff/case/${selected.ticket}`
      const edit = ['refer', 'acknowledge', 'delay', 'report'].includes(operation)
        ? { ...body, expected_event_id: selected.events.at(-1)?.id ?? 0 }
        : body
      const result = await caseRequest(`${path}/${operation}`, { body: edit, token })
      setNotice(operation === 'link' ? 'Reports linked.' : operation === 'broadcast' ? `Updated ${result.updated} tickets.` : 'Office record saved.')
      setSelected(await caseRequest(path, { token }))
      await loadQueue()
    })
  }

  function save(body) {
    run(async () => {
      const ticket = selected.ticket
      await caseRequest(`/staff/case/${ticket}`, { body: { ...body, expected_event_id: selected.events.at(-1)?.id ?? 0 }, token })
      setNotice('Case updated.')
      setSelected(body.action === 'transfer' ? null : await caseRequest(`/staff/case/${ticket}`, { token }))
      await loadQueue()
      await loadMetrics()
    })
  }

  const intake = scope.some(item => ['intake', 'supervisor'].includes(item.role))
  const handlesCases = scope.some(item => ['officer', 'supervisor'].includes(item.role))
  return <main className="case-page staff-page">
    <PortalHeader><Link to="/">Resident portal</Link>
      {token && <button type="button" disabled={busy} onClick={logout}>Sign out</button>}
    </PortalHeader>
    <h1>{token ? 'Municipal case workspace' : 'Staff sign-in'}</h1>
    {error && <p role="alert">{error}</p>}
    {(notice || busy) && <p role="status">{busy ? 'Please wait…' : notice}</p>}
    {!token ? <section className="staff-signin">
      <div className="staff-login-art portal-art" aria-hidden="true"/>
      <form onSubmit={login}>
        <p>Use your staff account and authenticator to open your assigned cases.</p>
        <label>Username<input name="username" maxLength={50} autoComplete="username" required /></label>
        <label>Password<input type="password" name="password" maxLength={72} autoComplete="current-password" required /></label>
        <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>
        <button disabled={busy}>Sign in</button>
      </form>
    </section> : <>
      <nav className="desk-navigation" aria-label="Workspace views">
        {[[handlesCases,'queue','Case queue'],[intake,'intake','Assisted intake'],[scope.some(s=>s.role==='supervisor'),'review','Ward supervision']].map(([available,id,label])=>
          available && <button type="button" key={id} aria-pressed={workspace===id} onClick={()=>setWorkspace(id)}>{label}</button>
        )}
      </nav>
      <div className="case-grid desk-panels" data-view={workspace}>
      {handlesCases && <section hidden={workspace!=='queue'} aria-labelledby="queue-heading">
        <h2 id="queue-heading">My work today</h2>
        <form onSubmit={event => {
          event.preventDefault()
          open(new FormData(event.currentTarget).get('ticket').trim().toUpperCase())
        }}>
          <label>Find by ticket number<input name="ticket" required pattern="[Ss][Rr]-[A-Fa-f0-9]{21}" maxLength={24} spellCheck={false} /></label>
          <button disabled={busy}>Open ticket</button>
        </form>
        <label>Show cases<select value={filter} disabled={busy} onChange={event => {
          const value = event.target.value
          setFilter(value)
          run(() => loadQueue(token, 0, value))
        }}>
          <option value="mine">Assigned to me</option>
          <option value="unassigned">Needs an owner</option>
          <option value="replied">Resident replied</option>
          <option value="today">Due today (India time)</option>
          {scope.some(s => s.role === 'supervisor') && <option value="stalled">Supervisor · stalled work</option>}
          <option value="open">All open</option><option value="overdue">Overdue</option><option value="resolved">Resolved</option>
        </select></label>
        <button type="button" className="case-refresh" disabled={busy} onClick={() => run(async () => {
          await loadQueue()
          await loadMetrics()
        })}>Refresh queue</button>
        <ul className="case-queue">{queue.map(item => <li key={item.id}>
          <button type="button" disabled={busy} onClick={() => open(item.ticket)}>{item.ticket}</button>
          <span>{statusLabels[item.status]} · {item.ward} · {item.department}</span>
          <span>{item.location}</span>
          <strong>{item.status === 'resolved' ? 'Review resolution' : item.status === 'reopen_requested' ? 'Review reopening request' :
            !item.officer_id ? 'Assign an officer' : item.last_kind === 'in_progress' ? 'Review resident reply' :
            item.status === 'needs_information' ? 'Await resident details' : item.status === 'assigned' ? 'Start work' : 'Record progress'}</strong>
          {Boolean(item.overdue) && item.status !== 'resolved' && <span>Missed update deadline</span>}
          {item.reopened > 0 && <span>Reopening requested {item.reopened} time(s)</span>}
          {item.transfers >= 2 && <span>{item.transfers} transfers</span>}
          {item.escalated_at && <strong>Escalated to supervisors</strong>}
          {item.status !== 'resolved' && <span>Update due · {formatDate(item.next_update_at)}</span>}
        </li>)}</ul>
        {!queue.length && <p>No cases match this filter.</p>}
        {more && <button type="button" disabled={busy} onClick={() => run(() => loadQueue(token, queue.length))}>Load more</button>}
      </section>}
      {selected && <section hidden={workspace!=='queue'} ref={detailPanel} tabIndex={-1} aria-label="Selected case">
        <button type="button" disabled={busy} onClick={() => open(selected.ticket)}>Reload case</button>
        <CaseDetail token={token} key={selected.ticket + selected.status + selected.events.at(-1)?.id} selected={selected} scope={scope}
        catalog={catalogState.catalog} onAction={save} onIncident={incident} busy={busy} /></section>}
      {intake && <section hidden={workspace!=='intake'}><h2>Assisted intake</h2>
        <label>Resident language<select value={intakeLanguage} onChange={event => setIntakeLanguage(event.target.value)}>
          <option value="en">English</option><option value="hi" lang="hi">हिन्दी</option>
        </select></label>
        <div lang={intakeLanguage}><IntakeForm {...catalogState} token={token} scope={scope} lang={intakeLanguage} /></div>
      </section>}
      {scope.some(item => item.role === 'supervisor') && <div hidden={workspace!=='review'}><CivicDesk token={token} scope={scope} run={run} busy={busy} open={open}/></div>}
      {scope.some(item => item.role === 'supervisor') && <section hidden={workspace!=='review'} className="case-metrics"><h2>Supervisor metrics</h2>
        <button disabled={busy} onClick={()=>run(async()=>setOperations(await caseRequest('/staff/operations',{token})))}>Check worker, SMS and staffing</button>
        {operations && <div aria-live="polite">
          <p>{operations.heartbeat.minutes_ago == null ? 'No completed worker run recorded.'
            : 'Last completed worker run: ' + operations.heartbeat.minutes_ago + ' min ago.'}
            {operations.heartbeat.minutes_ago >= 5 && ' Check the worker schedule.'}</p>
          <p>{operations.delivery.waiting} unsent messages · {operations.delivery.exhausted} exhausted retries
            {operations.delivery.oldest_minutes != null && ' · oldest waiting ' + operations.delivery.oldest_minutes + ' min'}</p>
          {operations.coverage.map(row=><p key={row.ward+'/'+row.department}>
            {row.ward} · {row.department} · {row.handlers} active case handlers{row.handlers < 2 && ' · arrange backup coverage'}
          </p>)}
        </div>}
        {!metrics.length && <p>No cases to report.</p>}
        {metrics.map(row => <article key={row.ward + '/' + row.department + '/' + row.language}>
          <h3>{row.ward} · {row.department} · {row.language === 'hi' ? 'Hindi' : 'English'}</h3>
          <p>{row.total} cases · {row.resolved} resolved · {row.overdue} overdue</p>
          <p>Average first staff action · {row.first_action_seconds == null ? '—' : Math.round(row.first_action_seconds / 60) + ' min'}</p>
          <p>Average reply drafting time per case · {row.compose_seconds == null ? '—' : Math.round(row.compose_seconds) + ' sec'}</p>
          <p>Average time to assignment · {row.avg_assignment_minutes === null ? '—' : Math.round(Number(row.avg_assignment_minutes)) + ' min'}</p>
          <p>{row.transferred} transferred · {row.reopened} cases with reopening requests</p>
          <p>AI agreed with confirmed routing on {row.matching} of {row.assessed} assessed cases</p>
        </article>)}
      </section>}
    </div></>}
  </main>
}
