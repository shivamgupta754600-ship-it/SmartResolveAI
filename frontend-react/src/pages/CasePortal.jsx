import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { caseRequest, newReceipt, parseReceipt } from '../api/cases'
import './cases.css'
import evidencePhoto from '../assets/report-evidence.webp'
import reviewPhoto from '../assets/ward-review.webp'
import repairPhoto from '../assets/field-repair.webp'
import communityPhoto from '../assets/community-repair.webp'
import PortalHeader from '../components/PortalHeader'
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, FilePenLine, Languages, Search } from 'lucide-react'
import ResidentAccount from './ResidentAccount'
import { request } from '../api/client'
import { useAuth } from '../context/AuthContext'
import CasePhoto, { readPhoto } from '../components/CasePhoto'
import { RecordDetails } from './MunicipalTools'

const copy = {
  en: {
    title: 'Municipal grievances', intro: 'Report a local service issue and track the response. Sign in and complete your resident profile to file.',
    file: 'Report an issue', track: 'Track your case', staff: 'Staff sign-in', demo: 'Prediction demo',
    ward: 'Ward', department: 'Service', select: 'Select an option', description: 'Describe the issue',
    location: 'Incident location or nearby landmark', privacy: 'Share only the details needed to address the issue. Keep your receipt code private.',
    sms: 'Send me optional SMS updates', phone: 'Mobile number with country code',
    submit: 'Submit report', working: 'Please wait…', received_title: 'Your report was received',
    save: 'Save both values. You’ll need them to check this case again.', ticket: 'Ticket number',
    receipt: 'Private receipt code', download: 'Download receipt', lookup: 'Check status',
    next: 'Next update due', timeline: 'Case timeline', reply: 'Send requested details', reopen: 'Request reopening',
    note: 'Details for the office', error: 'The request could not be completed. Please try again.',
    location_not_served: 'This service has no configured intake office in the selected state or union territory.',
    case_not_found: 'Check your ticket number and private receipt code.',
    photo_too_large: 'Choose a photo up to 5 MB and 24 megapixels.',
    sms_requires_verified_phone: 'SMS updates require a verified contact number. Clear the SMS option to file.',
    invalid_assistance_code: 'Ask the resident for a new help-desk filing code.',
    use_profile_phone: 'Use the contact number from the resident profile.',
    invalid_photo: 'Choose a readable, still JPEG, PNG, or WebP photo.',
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
    title: 'नगरपालिका शिकायतें', intro: 'स्थानीय सेवा की समस्या दर्ज करें और कार्रवाई की स्थिति देखें। दर्ज करने से पहले साइन इन करके अपनी निवासी प्रोफ़ाइल पूरी करें।',
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
    location_not_served: 'चुने गए राज्य या केंद्र शासित प्रदेश में इस सेवा के लिए शिकायत कार्यालय उपलब्ध नहीं है।',
    case_not_found: 'अपनी शिकायत संख्या और निजी रसीद कोड जाँचें।',
    photo_too_large: '5 एमबी और 24 मेगापिक्सेल तक की फ़ोटो चुनें।',
    sms_requires_verified_phone: 'एसएमएस के लिए सत्यापित नंबर चाहिए। शिकायत दर्ज करने के लिए एसएमएस विकल्प हटाएँ।',
    invalid_assistance_code: 'निवासी से नया सहायता कोड लें।',
    use_profile_phone: 'निवासी प्रोफ़ाइल का मोबाइल नंबर दर्ज करें।',
    invalid_photo: 'JPEG, PNG या WebP की स्थिर फ़ोटो चुनें।',
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

export function IntakeForm({ catalog, catalogError, lang, scope, token, onSaving, resident, onFiled }) {
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
  const departments = catalog?.departments.filter(item => !allowed || allowed.some(r => (ward === 'india_intake' || r.ward === ward) && r.department === item.code))

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    onSaving?.(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (data.sms_phone === '') delete data.sms_phone
    if (data.ward === 'india_intake') {
      data.geography = Object.fromEntries(
        ['state','district','subdistrict','settlement_type','settlement','local_area']
          .map(name => [name, String(data[name]).trim()])
          .filter(([,value]) => value)
      )
      for (const name of ['state','district','subdistrict','settlement_type','settlement','local_area']) delete data[name]
    }
    const file = data.photo
    delete data.photo
    const body = { ...data, language: lang }
    try {
      if (file?.name) {
        if (file.size > 5 * 1024 * 1024) throw new Error('photo_too_large')
        if (!file.size) throw new Error('invalid_photo')
        body.photo = await readPhoto(file)
      }
      const payload = JSON.stringify(body)
      if (key.current?.payload !== payload) key.current = { payload, receipt: newReceipt() }
      const receipt = key.current.receipt
      const result = token
        ? await caseRequest('/staff/assisted', { token, body: { ...body, receipt } })
        : await request('/cases', { method: 'POST', body: JSON.stringify({ ...body, receipt }) })
      setSaved({ ticket: result.ticket, receipt })
      key.current = null
      onFiled?.()
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
    <label>{lang==='hi'?'शिकायत का क्षेत्र':'Complaint area'}<select name="ward" required value={ward} onChange={event => { setWard(event.target.value); setDepartment('') }}>
      <option value="">{t.select}</option>
      {catalog?.states?.length > 0 && <option value="india_intake">{lang==='hi'?'राज्य या केंद्र शासित प्रदेश से खोजें':'Choose by state or union territory'}</option>}
      {wards?.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select></label>
    {ward === 'india_intake' && <fieldset className="india-location">
      <legend>{lang==='hi'?'भारत में शिकायत का स्थान':'Complaint location in India'}</legend>
      <label>{lang==='hi'?'राज्य या केंद्र शासित प्रदेश':'State or union territory'}
        <select name="state" required><option value="">{t.select}</option>
          {catalog.states.map(state=><option key={state}>{state}</option>)}
        </select>
      </label>
      <label>{lang==='hi'?'ज़िला':'District'}<input name="district" required maxLength={120}/></label>
      <label>{lang==='hi'?'तहसील / तालुका / उपज़िला':'Tehsil, taluka or subdivision (if known)'}<input name="subdistrict" maxLength={120}/></label>
      <label>{lang==='hi'?'क्षेत्र का प्रकार':'Settlement type'}<select name="settlement_type" required>
        <option value="">{t.select}</option><option value="village">{lang==='hi'?'गाँव':'Village'}</option>
        <option value="town">{lang==='hi'?'कस्बा':'Town'}</option><option value="city">{lang==='hi'?'शहर':'City'}</option>
      </select></label>
      <label>{lang==='hi'?'गाँव, कस्बे या शहर का नाम':'Village, town or city name'}<input name="settlement" required maxLength={120}/></label>
      <label>{lang==='hi'?'ग्राम पंचायत या वार्ड':'Gram panchayat or ward (if known)'}<input name="local_area" maxLength={120}/></label>
    </fieldset>}
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
    <label>{lang === 'hi' ? 'सबूत की फ़ोटो (वैकल्पिक)' : 'Evidence photo (optional)'}
      <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} />
      <small>{lang === 'hi' ? 'एक JPEG, PNG या WebP फ़ोटो · अधिकतम 5 एमबी और 24 मेगापिक्सेल' : 'One JPEG, PNG or WebP photo · up to 5 MB and 24 megapixels'}</small>
    </label>
    {token && <label>{lang==='hi'?'निवासी का एक बार उपयोग होने वाला कोड':'Resident’s one-time filing code'}<input name="assistance_code" required pattern="[a-fA-F0-9]{16}" maxLength={16} autoComplete="off" /></label>}
    {token && <label>{lang === 'hi' ? 'शिकायत का माध्यम' : 'Intake channel'}
      <select name="channel"><option value="desk">{lang === 'hi' ? 'सहायता केंद्र' : 'Help desk'}</option>
        <option value="phone">{lang === 'hi' ? 'फ़ोन' : 'Phone'}</option></select></label>}
    {catalog?.sms_enabled && (token || resident?.phone_verified) && <label className="case-checkbox"><input type="checkbox" checked={sms} onChange={event => setSms(event.target.checked)} />{t.sms}</label>}
    {sms && <label>{t.phone}<input name="sms_phone" defaultValue={resident ? "+91"+resident.phone.slice(-10) : undefined} readOnly={!!resident} type="tel" autoComplete="tel" required pattern="\+[1-9][0-9]{7,14}" placeholder="+919876543210" /></label>}
    {error && <p role="alert">{error}</p>}
    <button disabled={saving || !catalog}>{saving ? t.working : t.submit}</button>
  </form>
}

function Tracking({ lang, catalog, ownerTicket, onUpdated }) {
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

  useEffect(() => {
    if (!ownerTicket) return
    let active = true
    setBusy(true)
    request('/cases/resident/lookup', {method: 'POST', body: JSON.stringify({ticket: ownerTicket})})
      .then(record => { if (active) setResult(record) })
      .catch(() => { if (active) setError(t.error) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [ownerTicket, t])

  function trackingRequest(path, values) {
    if (ownerTicket) return request('/cases/resident' + path, {
      method: 'POST', body: JSON.stringify({ticket: ownerTicket, ...values}),
    })
    return caseRequest(path, {body: {...access, ...values}})
  }

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
      if (appeal) await trackingRequest('/appeal', {reason:note})
      else await trackingRequest('/respond', {note, action: result.status === 'resolved' ? 'reopen' : 'reply'})
      setMessage(t.sent)
      setResult(null)
      const updated = await trackingRequest('/lookup', {})
      setResult(updated)
      onUpdated?.(updated)
    } catch (err) {
      setError(t[err.message] || t.error)
    } finally {
      setBusy(false)
    }
  }

  return <>
    {!ownerTicket && <>
    <p>{lang==='hi' ? 'रसीद पर दी गई शिकायत संख्या और निजी कोड दर्ज करें।' : 'Use the ticket number and private code on your receipt.'}</p>
    <form onSubmit={lookup}>
      <label>{t.ticket}<input name="ticket" value={credentials.ticket} onChange={e => setCredentials({...credentials,ticket:e.target.value})} required maxLength={24} autoCapitalize="characters" spellCheck={false} /></label>
      <label>{t.receipt}<input name="receipt" value={credentials.receipt} onChange={e => setCredentials({...credentials,receipt:e.target.value})} type="password" required minLength={64} maxLength={64} autoComplete="off" /></label>
      <button disabled={busy}>{t.lookup}</button>
    </form>
    <details className="receipt-import"><summary>{lang==='hi' ? 'सहेजी गई रसीद खोलें' : 'Import a saved receipt'}</summary>
      <label>{lang==='hi' ? 'रसीद फ़ाइल' : 'Receipt file'}<input type="file" accept=".txt,text/plain" onChange={loadReceipt} disabled={busy}/></label>
    </details></>}
    {error && <p role="alert">{error}</p>}
    <p role="status">{busy ? t.working : message || (result && t[result.status])}</p>
    {result && <div className="case-timeline">
      <h3>{result.ticket}</h3>
      <p>{t[result.department] ?? catalog?.departments.find(item => item.code === result.department)?.name ?? result.office}</p>
      {result.status !== 'resolved' && <p>{t.next} · {formatDate(result.next_update_at, lang)}</p>}
      {(access || ownerTicket) && result.has_photo && <CasePhoto key={result.ticket} ticket={result.ticket} account={Boolean(ownerTicket)} access={access} lang={lang}/>}
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
  const {user, logout} = useAuth()
  const [lang, setLang] = useState('en')
  const t = copy[lang]
  const catalogState = useCatalog()
  const [submitting, setSubmitting] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  const { hash } = useLocation()
  const hi = lang === 'hi'
  const activePanel = hash === '#track-case' ? 'track-case' : (user || hash === '#file-case') ? 'file-case' : null
  const filingLink = user ? '#file-case' : '/login?resident=1'

  useEffect(() => {
    if (hash === '#track-case' || hash === '#file-case') {
      document.getElementById(hash.slice(1))?.focus({preventScroll:true})
      document.getElementById(hash.slice(1))?.scrollIntoView({block:'start'})
    }
  }, [hash])

  return <main className="case-page civic-home" lang={lang}>
    <PortalHeader hi={lang==='hi'}>
      <Link to="/staff" className="staff-nav">{hi?'कर्मचारी कार्यस्थल':'Staff workspace'}<ArrowUpRight size={14}/></Link>
      <button className="language-button" type="button" onClick={() => setLang(hi ? 'en' : 'hi')}>
        <Languages size={16}/>{hi ? 'English' : 'हिन्दी'}
      </button>
      <Link className="account-nav" to={filingLink}>{user ? (hi?'मेरा खाता':'My account') : (hi?'साइन इन':'Sign in')}<ArrowRight size={15}/></Link>
    </PortalHeader>
    <div className="civic-hero">
      <img className="civic-scene" src={communityPhoto} fetchPriority="high"
        alt={hi?'एक निवासी और नगरपालिका कर्मचारी सार्वजनिक नल की जाँच करते हुए।':'A resident and a municipal worker inspect a public tap in an Indian neighbourhood.'}/>
      <div className="civic-hero-inner">
        <span className="civic-signature" lang={hi?'en':'hi'}>{hi?'Your voice. Your city.':'आपकी आवाज़, आपका शहर।'}</span>
        <h1>{hi?'आपकी आवाज़,':'Your voice.'}<br/><em>{hi?'आपका शहर।':'Your city.'}</em></h1>
        <p>{hi?'नल टपक रहा है या कूड़ा नहीं उठा? शिकायत दर्ज करें, फ़ोटो जोड़ें और देखें कि आपके वार्ड में क्या कार्रवाई हुई।':'Leaking tap or missed waste collection? Report it, share a photo, and follow the response from your ward office.'}</p>
        <div className="civic-hero-actions">
          <Link className="gold-action" to={filingLink}>{t.file}<ArrowRight size={17}/></Link>
          <Link className="glass-action" to="#track-case"><Search size={16}/>{t.track}</Link>
        </div>
      </div>
    </div>
    <div className="service-index">
      <h2>{hi?'सेवाएँ':'Service directory'}</h2>
      <div className="service-links">
        {[
          [filingLink, FilePenLine, hi?'निवासी सेवाएँ':'Resident services', hi?'शिकायत दर्ज करें, फ़ोटो भेजें और अपनी शिकायतें देखें।':'File a report, attach evidence and manage your complaints.'],
          ['#track-case', Search, hi?'रसीद से स्थिति देखें':'Receipt lookup', hi?'अपनी निजी रसीद से कार्यालय की नवीनतम कार्रवाई देखें।':'Use your private receipt to see the latest case update.'],
          ['/staff', BriefcaseBusiness, hi?'कर्मचारी कार्यस्थल':'Staff workspace', hi?'शिकायतें सौंपें, काम दर्ज करें और निवासियों को उत्तर दें।':'Assign cases, record fieldwork and respond to residents.'],
        ].map(([to,Icon,label,description])=><Link key={label} to={to} className="service-link">
          <span className="service-symbol"><Icon size={22} strokeWidth={1.6}/></span>
          <strong>{label}</strong><span className="service-description">{description}</span><ArrowUpRight className="service-arrow" size={18}/>
        </Link>)}
      </div>
    </div>
    <div className="service-panels" key={sessionKey+'/'+(user?.id ?? 'guest')}>
      <section hidden={activePanel!=='file-case'} aria-labelledby="file-case"><h2 id="file-case" tabIndex={-1}>{t.file}</h2>
        <ResidentAccount lang={lang} renderTracking={(ticket,onUpdated)=><Tracking key={ticket} ownerTicket={ticket} lang={lang} catalog={catalogState.catalog} onUpdated={onUpdated}/>}>{(profile,onFiled)=><IntakeForm resident={profile} onFiled={onFiled} onSaving={setSubmitting} lang={lang} {...catalogState} />}</ResidentAccount>
      </section>
      <section hidden={activePanel!=='track-case'} aria-labelledby="track-case"><h2 id="track-case" tabIndex={-1}>{t.track}</h2>
        <Tracking lang={lang} catalog={catalogState.catalog} />
      </section>
    </div>
    <section className="complaint-story" aria-labelledby="story-title">
      <h2 id="story-title">{hi?'शिकायत पर कैसे होती है कार्रवाई':'How a complaint gets resolved'}</h2>
      <ol>
        {[
          [evidencePhoto, hi?'समस्या की फ़ोटो भेजें':'Send a photo', hi?'एक निवासी सार्वजनिक नल की फ़ोटो ले रही हैं।':'A resident photographs a leaking tap.', hi?'वार्ड और जगह बताएँ। समस्या समझाने के लिए फ़ोटो जोड़ सकते हैं।':'Choose the ward and location. Add a photo if it helps explain the issue.'],
          [reviewPhoto, hi?'वार्ड कार्यालय में समीक्षा':'Ward staff review the report', hi?'कार्यालय में कर्मचारी कंप्यूटर पर शिकायत की फ़ोटो देख रहे हैं।':'Ward staff examine the submitted photo on a monitor.', hi?'कर्मचारी शिकायत की समीक्षा करते हैं और कार्रवाई के लिए अधिकारी नियुक्त करते हैं।':'Staff review the complaint and assign an officer to follow up.'],
          [repairPhoto, hi?'कार्रवाई की जानकारी देखें':'Follow the repair', hi?'एक कर्मचारी सार्वजनिक नल का वाल्व बदल रहा है।':'A field technician fits a replacement valve.', hi?'कार्यालय कार्रवाई दर्ज करता है। समाधान देखें और ज़रूरत पड़ने पर शिकायत फिर से खोलने का अनुरोध करें।':'Read the office’s update. If the problem persists, request reopening.'],
        ].map(([photo,title,alt,caption])=><li key={photo}>
          <figure><img src={photo} alt={alt} width="600" height="360" loading="lazy" decoding="async"/>
            <figcaption><h3>{title}</h3><p>{caption}</p></figcaption>
          </figure>
        </li>)}
      </ol>
    </section>
    <footer className="portal-footer"><Link to="/login">{t.demo}</Link><button className="case-refresh" type="button" disabled={submitting} onClick={() => { logout(); setSessionKey(key => key + 1) }}>
      {lang === 'hi' ? 'इस स्क्रीन से मेरा विवरण हटाएँ' : 'Clear my details from this screen'}
    </button></footer>
  </main>
}
