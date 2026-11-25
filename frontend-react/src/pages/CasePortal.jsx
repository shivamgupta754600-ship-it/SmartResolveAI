import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { caseRequest, newReceipt, parseReceipt } from '../api/cases'
import './cases.css'
import { RecordDetails } from './MunicipalTools'

const copy = {
  en: {
    title: 'Municipal grievances', intro: 'Report a local service issue and track the response. No account is required.',
    file: 'Report an issue', track: 'Track your case', staff: 'Staff sign-in', demo: 'Prediction demo',
    ward: 'Ward', department: 'Service', select: 'Select an option', description: 'Describe the issue',
    location: 'Incident location or nearby landmark', privacy: 'Share only the details needed to address the issue. Keep your receipt code private.',
    sms: 'Send me optional SMS updates', phone: 'Mobile number with country code',
    submit: 'Submit report', working: 'Please wait…', received_title: 'Your report was received',
    save: 'Save both values. You’ll need them to check this case again.', ticket: 'Ticket number',
    receipt: 'Private receipt code', download: 'Download receipt', lookup: 'Check status',
    next: 'Next update due', timeline: 'Case timeline', reply: 'Send requested details', reopen: 'Request reopening',
    note: 'Details for the office', error: 'The request could not be completed. Please try again.',
    case_not_found: 'Check your ticket number and private receipt code.',
    invalid_input: 'Check the information you entered and try again.',
    invalid_transition: 'The case has changed. Check its latest status and try again.',
    catalog_error: 'The service list is unavailable. Reload this page to try again.',
    water: 'Water Supply', waste: 'Waste Management',
    visit: 'Field visit recorded', blocked: 'Work blocked', refer:'Referred', acknowledge:'Acknowledgement recorded', delay:'Revised estimate', report:'Action Taken Report published', appeal_filed:'Formal appeal filed', appeal_decided:'Appeal decided', received: 'Received', assigned: 'Assigned', in_progress: 'In progress', needs_information: 'More information needed',
    resolved: 'Resolved', reopen_requested: 'Reopening requested', assign: 'Assigned to an officer',
    transfer: 'Transferred to another office', start: 'Work started', request_information: 'Office requested details',
    update: 'Office posted an update', resolve: 'Resolution recorded', accept_reopen: 'Reopening accepted',
    decline_reopen: 'Reopening declined', sent: 'Your update was sent.',
  },
  hi: {
    title: 'नगरपालिका शिकायतें', intro: 'स्थानीय सेवा की समस्या दर्ज करें और कार्रवाई की स्थिति देखें। खाता बनाना ज़रूरी नहीं है।',
    file: 'समस्या दर्ज करें', track: 'शिकायत की स्थिति देखें', staff: 'कर्मचारी लॉगिन', demo: 'वर्गीकरण का डेमो',
    ward: 'वार्ड', department: 'सेवा', select: 'एक विकल्प चुनें', description: 'समस्या का विवरण',
    location: 'घटना का स्थान या पास का पहचान चिह्न', privacy: 'केवल ज़रूरी जानकारी दें। अपनी रसीद का कोड निजी रखें।',
    sms: 'मुझे एसएमएस से सूचना भेजें', phone: 'देश कोड सहित मोबाइल नंबर',
    submit: 'शिकायत भेजें', working: 'कृपया प्रतीक्षा करें…', received_title: 'आपकी शिकायत मिल गई है',
    save: 'दोनों विवरण सहेज लें। स्थिति फिर से देखने के लिए इनकी ज़रूरत होगी।',
    ticket: 'शिकायत संख्या', receipt: 'निजी रसीद कोड', download: 'रसीद डाउनलोड करें', lookup: 'स्थिति देखें',
    next: 'अगली सूचना की समय सीमा', timeline: 'कार्रवाई का विवरण', reply: 'माँगी गई जानकारी भेजें',
    reopen: 'फिर से खोलने का अनुरोध करें', note: 'कार्यालय के लिए जानकारी',
    error: 'अनुरोध पूरा नहीं हो सका। कृपया फिर कोशिश करें।',
    case_not_found: 'अपनी शिकायत संख्या और निजी रसीद कोड जाँचें।',
    invalid_input: 'दी गई जानकारी जाँचें और फिर कोशिश करें।',
    invalid_transition: 'शिकायत की स्थिति बदल गई है। नई स्थिति देखकर फिर कोशिश करें।',
    catalog_error: 'सेवाओं की सूची उपलब्ध नहीं है। पेज फिर से खोलें।',
    water: 'जल आपूर्ति', waste: 'कचरा प्रबंधन',
    visit: 'स्थल निरीक्षण दर्ज हुआ', blocked: 'काम में रुकावट', refer:'संदर्भ भेजा गया', acknowledge:'पावती दर्ज हुई', delay:'संशोधित अनुमान', report:'कार्रवाई रिपोर्ट जारी हुई', appeal_filed:'अपील दर्ज हुई', appeal_decided:'अपील का निर्णय', received: 'शिकायत मिली', assigned: 'अधिकारी को सौंपी गई', in_progress: 'कार्रवाई जारी है',
    needs_information: 'और जानकारी चाहिए', resolved: 'समाधान दर्ज', reopen_requested: 'फिर से खोलने का अनुरोध',
    assign: 'अधिकारी को सौंपी गई', transfer: 'दूसरे कार्यालय को भेजी गई', start: 'कार्रवाई शुरू हुई',
    request_information: 'कार्यालय ने जानकारी माँगी', update: 'कार्यालय ने नई सूचना दी', resolve: 'समाधान दर्ज हुआ',
    accept_reopen: 'दोबारा खोलने का अनुरोध स्वीकार हुआ', decline_reopen: 'दोबारा खोलने का अनुरोध अस्वीकार हुआ',
    sent: 'आपकी जानकारी भेज दी गई है।',
  },
}

export function formatDate(value, lang = 'en') {
  if (!value) return '—'
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  }).format(new Date(utc))
}

export function useCatalog() {
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState(false)
  useEffect(() => {
    let active = true
    caseRequest('/catalog').then(data => { if (active) setCatalog(data) })
      .catch(() => { if (active) setCatalogError(true) })
    return () => { active = false }
  }, [])
  return { catalog, catalogError }
}

export function IntakeForm({ catalog, catalogError, lang, scope, token, onSaving }) {
  const t = copy[lang]
  const key = useRef(null)
  const [sms, setSms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)
  const [ward, setWard] = useState('')
  const [department,setDepartment] = useState('')
  const entries = (catalog?.register || []).filter(r => r.ward===ward && r.department===department)
  const allowed = scope?.filter(item => item.role === 'intake' || item.role === 'supervisor')
  const wards = catalog?.wards.filter(item => !allowed || allowed.some(r => r.ward === item.code))
  const departments = catalog?.departments.filter(item => !allowed || allowed.some(r => r.ward === ward && r.department === item.code))

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    onSaving?.(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (data.sms_phone === '') delete data.sms_phone
    const body = { ...data, language: lang }
    const payload = JSON.stringify(body)
    if (key.current?.payload !== payload) key.current = { payload, receipt: newReceipt() }
    try {
      const receipt = key.current.receipt
      const result = await caseRequest(token ? '/staff/assisted' : '', { token, body: { ...body, receipt } })
      setSaved({ ticket: result.ticket, receipt })
      key.current = null
    } catch (err) {
      setError(t[err.message] || t.error)
    } finally {
      setSaving(false)
      onSaving?.(false)
    }
  }

  function download() {
    const contents = `${t.ticket}: ${saved.ticket}\n${t.receipt}: ${saved.receipt}\n`
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${saved.ticket}.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (saved) return <div className="case-receipt">
    <h3 role="status">{t.received_title}</h3>
    <p>{t.save}</p>
    <dl><dt>{t.ticket}</dt><dd>{saved.ticket}</dd><dt>{t.receipt}</dt><dd>{saved.receipt}</dd></dl>
    <button type="button" onClick={download}>{t.download}</button>{' '}
    <button type="button" onClick={() => { setSaved(null); setWard(''); setSms(false) }}>{t.file}</button>
  </div>

  return <form onSubmit={submit}>
    <p>{t.privacy}</p>
    {catalogError && <p role="alert">{t.catalog_error}</p>}
    <label>{t.ward}<select name="ward" required value={ward} onChange={event => { setWard(event.target.value); setDepartment('') }}>
      <option value="">{t.select}</option>
      {wards?.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select></label>
    <label>{t.department}<select name="department" key={ward} value={department} onChange={e=>setDepartment(e.target.value)} required>
      <option value="">{t.select}</option>
      {departments?.map(item => <option key={item.code} value={item.code}>{t[item.code] ?? item.name}</option>)}
    </select></label>
    {!!entries.length && <details><summary>{lang==='hi'?'जिम्मेदार कार्यालय':'Responsible offices'}</summary>
      {entries.map(r=><p key={r.id}>{r.locality || t.ward} · {r.office} · {r.designation} · {r.escalation}</p>)}
    </details>}
    <datalist id="registered-localities">{entries.filter(r=>r.locality).map(r=><option key={r.id} value={r.locality}/>)}</datalist>
    <label>{t.location}<input list="registered-localities" name="location" required minLength={2} maxLength={300} /></label>
    <label>{t.description}<textarea name="description" required maxLength={2000} rows={4} /></label>
    {token && <label>{lang === 'hi' ? 'शिकायत का माध्यम' : 'Intake channel'}
      <select name="channel"><option value="desk">{lang === 'hi' ? 'सहायता केंद्र' : 'Help desk'}</option>
        <option value="phone">{lang === 'hi' ? 'फ़ोन' : 'Phone'}</option></select></label>}
    {catalog?.sms_enabled && <label className="case-checkbox"><input type="checkbox" checked={sms} onChange={event => setSms(event.target.checked)} />{t.sms}</label>}
    {sms && <label>{t.phone}<input name="sms_phone" type="tel" autoComplete="tel" required pattern="\+[1-9][0-9]{7,14}" placeholder="+919876543210" /></label>}
    {error && <p role="alert">{error}</p>}
    <button disabled={saving || !catalog}>{saving ? t.working : t.submit}</button>
  </form>
}

function Tracking({ lang, catalog }) {
  const [credentials, setCredentials] = useState({ ticket: '', receipt: '' })
  async function loadReceipt(event) {
    const input = event.currentTarget
    const file = input.files[0]
    input.value = ''
    if (!file) return
    setError('')
    setMessage('')
    setResult(null)
    setAccess(null)
    setCredentials({ ticket: '', receipt: '' })
    setBusy(true)
    try {
      if (file.size > 8192) throw new Error('invalid_receipt')
      setCredentials(parseReceipt(await file.text()))
      setMessage(lang === 'hi' ? 'रसीद भर दी गई है। स्थिति देखें चुनें।' : 'Receipt loaded. Select Check status to continue.')
    } catch {
      setError(lang === 'hi' ? 'डाउनलोड की गई शिकायत रसीद चुनें।' : 'Choose a downloaded SmartResolve receipt containing one ticket and private code.')
    } finally {
      setBusy(false)
    }
  }
  const t = copy[lang]
  const [access, setAccess] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function lookup(event) {
    event.preventDefault()
    const raw = Object.fromEntries(new FormData(event.currentTarget))
    const body = { ticket: raw.ticket.trim().toUpperCase(), receipt: raw.receipt.trim().toLowerCase() }
    setBusy(true)
    setError('')
    setMessage('')
    setAccess(null)
    setResult(null)
    try {
      setResult(await caseRequest('/lookup', { body }))
      setAccess(body)
    } catch (err) {
      setError(t[err.message] || t.error)
    } finally {
      setBusy(false)
    }
  }

  async function respond(event, appeal=false) {
    event.preventDefault()
    const note = new FormData(event.currentTarget).get('note')
    setError('')
    setBusy(true)
    try {
      if (appeal) await caseRequest('/appeal', {body:{...access,reason:note}})
      else await caseRequest('/respond', { body: { ...access, note, action: result.status === 'resolved' ? 'reopen' : 'reply' } })
      setMessage(t.sent)
      setResult(null)
      setResult(await caseRequest('/lookup', { body: access }))
    } catch (err) {
      setError(t[err.message] || t.error)
    } finally {
      setBusy(false)
    }
  }

  return <>
    <label>{lang === 'hi' ? 'डाउनलोड की गई रसीद से भरें' : 'Fill from a downloaded receipt'}
      <input type="file" accept=".txt,text/plain" onChange={loadReceipt} disabled={busy} />
    </label>
    <form onSubmit={lookup}>
      <label>{t.ticket}<input name="ticket" value={credentials.ticket} onChange={e => setCredentials({...credentials,ticket:e.target.value})} required maxLength={24} autoCapitalize="characters" spellCheck={false} /></label>
      <label>{t.receipt}<input name="receipt" value={credentials.receipt} onChange={e => setCredentials({...credentials,receipt:e.target.value})} type="password" required minLength={64} maxLength={64} autoComplete="off" /></label>
      <button disabled={busy}>{t.lookup}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <p role="status">{busy ? t.working : message || (result && t[result.status])}</p>
    {result && <div className="case-timeline">
      <h3>{result.ticket}</h3>
      <p>{t[result.department] ?? catalog?.departments.find(item => item.code === result.department)?.name ?? result.office}</p>
      {result.status !== 'resolved' && <p>{t.next} · {formatDate(result.next_update_at, lang)}</p>}
      <RecordDetails record={result} lang={lang}/>
      {result.target?.appeal_open && !result.appeal && <form onSubmit={e=>respond(e,true)}>
        <label>{lang==='hi'?'औपचारिक अपील का कारण':'Grounds for formal appeal'}<textarea name="note" required maxLength={2000}/></label>
        <button disabled={busy}>{lang==='hi'?'अपील दर्ज करें':'File formal appeal'}</button>
      </form>}
      <h4>{t.timeline}</h4>
      <ol>{result.events.map(item => <li key={item.id}>
        <strong>{t[item.kind]}</strong> · {formatDate(item.created_at, lang)}
        {item.note && <p dir="auto">{item.note}</p>}
      </li>)}</ol>
      {['resolved', 'needs_information'].includes(result.status) && <form onSubmit={respond}>
        <label>{t.note}<textarea name="note" required maxLength={2000} rows={3} /></label>
        <button disabled={busy}>{result.status === 'resolved' ? t.reopen : t.reply}</button>
      </form>}
    </div>}
  </>
}

export default function CasePortal() {
  const [lang, setLang] = useState('en')
  const t = copy[lang]
  const catalogState = useCatalog()
  const [submitting, setSubmitting] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  return <main className="case-page" lang={lang}>
    <header className="case-header">
      <strong>SmartResolve</strong>
      <nav aria-label={lang === 'hi' ? 'मुख्य नेविगेशन' : 'Main navigation'}>
        <Link to="/staff">{t.staff}</Link>
        <Link to="/login">{t.demo}</Link>
        <button type="button" lang={lang === 'en' ? 'hi' : 'en'} onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>
          {lang === 'en' ? 'हिन्दी' : 'English'}
        </button>
      </nav>
    </header>
    <h1>{t.title}</h1>
    <p>{t.intro}</p>
    <div className="case-grid" key={sessionKey}>
      <section aria-labelledby="file-case"><h2 id="file-case">{t.file}</h2>
        <IntakeForm onSaving={setSubmitting} lang={lang} {...catalogState} />
      </section>
      <section aria-labelledby="track-case"><h2 id="track-case">{t.track}</h2>
        <Tracking lang={lang} catalog={catalogState.catalog} />
      </section>
    </div>
    <button className="case-refresh" type="button" disabled={submitting} onClick={() => setSessionKey(key => key + 1)}>
      {lang === 'hi' ? 'इस स्क्रीन से मेरा विवरण हटाएँ' : 'Clear my details from this screen'}
    </button>
  </main>
}
