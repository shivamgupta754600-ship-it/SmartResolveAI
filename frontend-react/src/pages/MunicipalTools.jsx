import { useState } from 'react'
import { caseRequest } from '../api/cases'
import { formatDate } from './CasePortal'

export function printText(title, text, lang = 'en') {
  const page = window.open('', '_blank')
  if (!page) return
  page.opener = null
  page.document.title = title
  page.document.documentElement.lang = lang
  const heading = page.document.createElement('h1')
  heading.textContent = title
  const content = page.document.createElement('article')
  content.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:16px/1.55 system-ui'
  content.textContent = text
  page.document.body.append(heading, content)
  page.focus()
  page.print()
}

function values(event) {
  event.preventDefault()
  return Object.fromEntries(new FormData(event.currentTarget))
}

export function RecordDetails({ record, lang = 'en' }) {
  const hi = lang === 'hi'
  const t = record.target
  return <>
    {t && <div>
      <p>{hi ? 'दर्ज करते समय जिम्मेदार कार्यालय' : 'Office at filing'} · {t.office} · {t.designation}</p>
      <p>{hi ? 'समाधान की मूल समय सीमा' : 'Original resolution target'} · {formatDate(t.due_at, lang)}</p>
      <p>{hi ? 'संपर्क अधिकारी' : 'Escalation contact'} · {t.escalation}</p>
      {t.revised_at && <p>{hi ? 'संशोधित अनुमान' : 'Revised estimate'} · {formatDate(t.revised_at, lang)} · {t.delay_reason}</p>}
      {t.scheme && <p>{t.scheme} · {t.authority} {t.appeal_deadline && <> · {hi ? 'अपील की समय सीमा' : 'Appeal deadline'} · {formatDate(t.appeal_deadline, lang)}</>}</p>}
    </div>}
    {record.referrals?.map(r => <p key={r.id}>
      {hi ? 'संदर्भ' : 'Referral'} · {r.office} · {formatDate(r.referred_at, lang)} · {r.follow_up} · {r.inward_number}
      {' · '}{r.acknowledged_at ? formatDate(r.acknowledged_at, lang) : hi ? 'पावती लंबित' : 'Awaiting acknowledgement'}
    </p>)}
    {record.appeal && <p>{hi ? 'औपचारिक अपील' : 'Formal appeal'} · {record.appeal.reason} · {record.appeal.decision || (hi ? 'निर्णय लंबित' : 'Awaiting decision')}</p>}
    {record.report && <details><summary>{hi ? 'कार्रवाई रिपोर्ट' : 'Action Taken Report'}</summary>
      <p style={{whiteSpace:'pre-wrap'}}>{record.report.report}</p>
      <p>{record.report.designation} · {formatDate(record.report.reviewed_at, lang)}</p>
      <button type="button" onClick={() => printText(record.ticket, [record.report.report,record.report.designation,formatDate(record.report.reviewed_at, lang)].join('\n'),lang)}>
        {hi ? 'रिपोर्ट प्रिंट करें' : 'Print report'}</button>
    </details>}
  </>
}

function reportDraft(record) {
  const hi = record.language === 'hi'
  const notes = kind => record.events.filter(e => kind.includes(e.kind)).map(e =>
    `${formatDate(e.created_at,record.language)} · ${e.note || ''}`).join('\n')
  return [
    [hi ? 'शिकायत संख्या' : 'Ticket', record.ticket],
    [hi ? 'शिकायत' : 'Complaint', record.description],
    [hi ? 'स्थान' : 'Location', record.location],
    [hi ? 'निरीक्षण' : 'Inspection', notes(['visit'])],
    [hi ? 'की गई कार्रवाई' : 'Work completed', notes(['start','update','resolve'])],
    [hi ? 'लंबित कार्य' : 'Outstanding work', notes(['blocked','delay'])],
    [hi ? 'समापन का कारण' : 'Closure reason', notes(['resolve','decline_reopen'])],
  ].map(([label,value]) => label+' — '+value).join('\n\n')
}

export function OfficeActions({ record, submit, busy, editable }) {
  const pending = record.referrals.filter(item => !item.acknowledged_at)
  return <details><summary>Office records and referrals</summary>
    <RecordDetails record={record}/>
    {editable && <>
      <form onSubmit={e => {const data=values(e); submit('refer', {...data,inward_number:data.inward_number || null})}}>
        <h3>Refer to an external office</h3>
        <label>Receiving office<input name="office" required maxLength={160}/></label>
        <label>Follow-up owner<input name="follow_up" required maxLength={160}/></label>
        <label>External reference (optional)<input name="inward_number" maxLength={160}/></label>
        <button disabled={busy}>Record referral</button>
      </form>
      {!!pending.length && <form onSubmit={e => submit('acknowledge',values(e))}>
        <label>Receiving office acknowledgement<select name="referral_id">{pending.map(r => <option key={r.id} value={r.id}>{r.office} · {formatDate(r.referred_at)}</option>)}</select></label>
        <label>Inward number<input name="inward_number" required maxLength={160}/></label>
        <button disabled={busy}>Record acknowledgement</button>
      </form>}
      {record.target && record.status !== 'resolved' && <form onSubmit={e => {
        const data=values(e)
        submit('delay',{reason:data.reason,estimate:new Date(data.estimate).toISOString(),update_due:new Date(data.update_due).toISOString()})
      }}>
        <h3>Record a delay</h3><label>Reason for resident<textarea name="reason" required maxLength={2000}/></label>
        <label>Revised resolution estimate<input name="estimate" type="datetime-local" required/></label>
        <label>Next resident update<input name="update_due" type="datetime-local" required/></label>
        <button disabled={busy}>Save revised estimate</button>
      </form>}
      <form onSubmit={e=>submit('report',values(e))}>
        <h3>Review Action Taken Report</h3>
        <label>Issuing officer designation<input name="designation" required maxLength={160} defaultValue={record.report?.designation || record.target?.designation}/></label>
        <label>Resident copy · {record.language === 'hi' ? 'Hindi' : 'English'}<textarea rows={10} required maxLength={12000} name="report" defaultValue={record.report?.report || reportDraft(record)}/></label>
        <button disabled={busy}>Publish reviewed report</button>
      </form>
    </>}
  </details>
}

export function CivicDesk({ token, scope, run, busy, open }) {
  const [data,setData] = useState(null)
  const [unit,setUnit] = useState('')
  const [scheme,setScheme] = useState(false)
  const [notice,setNotice] = useState('')
  const units = scope.filter(s=>s.role==='supervisor')
  const [ward,department] = (unit || (units[0] ? units[0].ward+'/'+units[0].department : '')).split('/')
  async function refresh() {
    const [weekly,appeals,reviewers,rules] = await Promise.all(['/staff/weekly','/staff/appeals','/staff/reviewers','/staff/register'].map(path=>caseRequest(path,{token})))
    setData({weekly,appeals,reviewers,rules})
  }
  function decisions(r) {
    const next = []
    if (r.waiting) next.push('Obtain acknowledgement from '+r.waiting)
    if (r.missed && r.status!=='resolved') next.push('Review missed resolution target')
    if (r.repeated) next.push('Inspect recurring fault')
    return next.join(' · ') || 'Confirm next action'
  }
  function sheet(r) {
    return [r.ticket,r.ward,r.department,r.location,formatDate(r.created_at),r.designation || 'Confirm responsible officer',decisions(r)].join(' · ')
  }
  return <section><h2>Ward review and service register</h2>
    <button disabled={busy} onClick={()=>run(refresh)}>{data?'Refresh records':'Open office records'}</button>
    {notice && <p role="status">{notice}</p>}
    {data && <>
      <h3>Weekly ward review · oldest first</h3>
      <button onClick={()=>printText('Weekly ward review',new Date().toLocaleDateString('en-IN')+'\n\n'+data.weekly.map(sheet).join('\n\n'))}>Print review sheet</button>
      {!data.weekly.length && <p>No outstanding cases or referrals.</p>}
      {data.weekly.map(r=><p key={r.ticket}><button disabled={busy} onClick={()=>open(r.ticket)}>{r.ticket}</button> {sheet(r)}</p>)}
      <h3>Appeals assigned to you</h3>
      {!data.appeals.length && <p>No pending appeals.</p>}
      {data.appeals.map(a=><form key={a.ticket} onSubmit={e=>{
        const body=values(e)
        run(async()=>{await caseRequest('/staff/case/'+a.ticket+'/decision',{token,body});await refresh()})
      }}><p>{a.ticket} · {a.scheme} · {a.authority}</p><p>{a.description}</p><p>{a.reason}</p>
        <label>Reasoned decision<textarea required name="note" maxLength={2000}/></label><button disabled={busy}>Issue decision</button></form>)}
      <details><summary>Verify service responsibilities</summary>
        {data.rules.filter(r=>units.some(s=>s.department===r.department && s.ward===r.ward)).map(r=><p key={r.id}>{r.ward} · {r.department} · {r.locality || 'All localities'} · {r.office} · {r.designation} · {r.target_hours} h · verified by {r.verifier} on {formatDate(r.verified_at)}</p>)}
        <form onSubmit={e=>{
          const body={...values(e),ward,department}
          run(async()=>{await caseRequest('/staff/register',{token,body});setNotice('Register entry verified. New filings use this version.');await refresh()})
        }}>
          <label>Jurisdiction<select value={ward+'/'+department} onChange={e=>setUnit(e.target.value)}>{units.map(s=><option key={s.ward+'/'+s.department}>{s.ward+'/'+s.department}</option>)}</select></label>
          <label>Asset or locality (blank for ward default)<input name="locality" maxLength={120}/></label>
          <label>Responsible office<input name="office" required maxLength={160}/></label>
          <label>Officer designation<input name="designation" required maxLength={160}/></label>
          <label>Escalation contact (public office contact)<input name="escalation" required maxLength={160}/></label>
          <label>Resolution target in elapsed hours<input type="number" name="target_hours" min="1" max="87600" required/></label>
          <label><input type="checkbox" checked={scheme} onChange={e=>setScheme(e.target.checked)}/> Configure a notified service appeal</label>
          {scheme && <><label>Scheme or notification<input name="scheme" required maxLength={160}/></label>
            <label>Appellate authority designation<input name="authority" required maxLength={160}/></label>
            <label>Appellate reviewer<select name="reviewer" required>{data.reviewers.filter(r=>r.ward===ward && r.department===department).map(r=><option key={r.id} value={r.id}>{r.username}</option>)}</select></label>
            <label>Filing window in calendar days<input type="number" name="appeal_days" min="1" max="3650" required/></label></>}
          <button disabled={busy}>Verify and save register entry</button>
        </form>
      </details>
    </>}
  </section>
}
