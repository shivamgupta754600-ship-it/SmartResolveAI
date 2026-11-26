import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowRight, Camera, MapPin, UserRound } from 'lucide-react'
import PhoneVerification from '../components/PhoneVerification'
import { request } from '../api/client'

const documents = {
  aadhaar: ['Aadhaar', 'आधार'], voter: ['Voter ID', 'मतदाता पहचान पत्र'],
  passport: ['Passport', 'पासपोर्ट'], driving_licence: ['Driving licence', 'ड्राइविंग लाइसेंस'],
  other: ['Other government ID', 'अन्य सरकारी पहचान पत्र'],
}

export default function ResidentAccount({ lang, children, renderTracking }) {
  const { user, loading, logout, refreshUser } = useAuth()
  const hi = lang === 'hi'
  const [profile,setProfile] = useState(null)
  const [mobile,setMobile] = useState('')
  const [editing,setEditing] = useState(false)
  const [history,setHistory] = useState([])
  const [selected,setSelected] = useState(null)
  const [more,setMore] = useState(false)
  const [code,setCode] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [revision,setRevision] = useState(0)
  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([request('/cases/resident/profile'),request('/cases/resident/history')])
      .then(([record,rows])=>{
        if (active) { setProfile(record); setMobile(record.phone || ''); setHistory(rows); setMore(rows.length===25); setError('') }
      }).catch(()=>{if(active)setError(hi?'प्रोफ़ाइल नहीं खुली।':'Could not load your profile.')})
    return ()=>{active=false}
  },[user?.id,revision,hi])
  async function run(fn) {
    setError(''); setBusy(true)
    try { await fn() } catch { setError(hi?'विवरण जाँचकर फिर कोशिश करें।':'Check your details and try again.') }
    finally { setBusy(false) }
  }
  if (loading) return <p role="status">{hi?'कृपया प्रतीक्षा करें…':'Please wait…'}</p>
  if (!user) return <div className="filing-guide">
    <p>{hi?'स्थानीय सेवा की समस्या संबंधित कार्यालय तक पहुँचाएँ।':'Send a local service issue to the office responsible.'}</p>
    <ul>
      <li><UserRound/><span>{hi?'अपनी निवासी प्रोफ़ाइल से साइन इन करें':'Sign in with your resident profile'}</span></li>
      <li><MapPin/><span>{hi?'वार्ड और पास का पहचान चिह्न चुनें':'Choose your ward and describe the location'}</span></li>
      <li><Camera/><span>{hi?'ज़रूरत हो तो समस्या की फ़ोटो जोड़ें':'Attach a photo if it helps explain the issue'}</span></li>
    </ul>
    <Link className="portal-cta" to="/login?resident=1">{hi?'खाता बनाएँ या साइन इन करें':'Create an account or sign in'}<ArrowRight size={17}/></Link>
  </div>
  return <>
    <p>{user.username} · <button type="button" onClick={logout}>{hi?'साइन आउट':'Sign out'}</button></p>
    {error && <p role="alert">{error}</p>}
    {!profile && <button onClick={()=>setRevision(n=>n+1)}>{hi?'प्रोफ़ाइल लोड करें':'Load profile'}</button>}
    {profile && (!profile.ready || editing) && <form onSubmit={e=>{
      e.preventDefault()
      const body=Object.fromEntries(new FormData(e.currentTarget))
      run(async()=>{
        setProfile(await request('/cases/resident/profile',{method:'PUT',body:JSON.stringify(body)}))
        setEditing(false); setCode(''); await refreshUser()
      })
    }}>
      <h3>{hi?'निवासी प्रोफ़ाइल':'Resident profile'}</h3>
      <label>{hi?'पूरा नाम':'Full name'}<input name="full_name" required maxLength={100} defaultValue={profile.full_name} /></label>
      <label>{hi?'संपर्क मोबाइल नंबर':'Contact mobile number'}<input name="phone" type="tel" required pattern="([+]91|91)?[6-9][0-9]{9}" placeholder="9876543210" value={mobile} onChange={e=>setMobile(e.target.value)}/></label>
      {profile.verification_required && (!profile.phone_verified || mobile !== profile.phone) && <PhoneVerification key={mobile} account phone={mobile} lang={lang} onVerified={async()=>{
        const current=await request('/cases/resident/profile')
        setProfile(current);setMobile(current.phone);await refreshUser()
      }}/>}
      <label>{hi?'पहचान पत्र का प्रकार':'Government ID type'}<select name="document_type" defaultValue={profile.document_type || ''} required>
        <option value="">{hi?'चुनें':'Choose one'}</option>
        {Object.entries(documents).map(([value,labels])=><option key={value} value={value}>{labels[hi?1:0]}</option>)}
      </select></label>
      <label>{hi?'पहचान पत्र के केवल अंतिम चार अक्षर या अंक':'Last four characters of ID only'}<input name="document_suffix" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" defaultValue={profile.document_suffix || ''} autoComplete="off" /></label>
      <p>{hi?'यह जानकारी आपके द्वारा घोषित है। आधार के लिए अंतिम चार अंक लिखें।':'This is a self-declared ID reference. For Aadhaar, enter the last four digits.'}</p>
      <button disabled={busy || (profile.verification_required && (!profile.phone_verified || mobile !== profile.phone))}>{hi?'प्रोफ़ाइल सहेजें':'Save resident profile'}</button>
    </form>}
    {profile?.ready && !editing && <>
      <details><summary>{hi?'मेरी प्रोफ़ाइल':'My resident profile'}</summary>
        <p>{profile.full_name} · {profile.phone} ({profile.phone_verified ? (hi?'सत्यापित':'verified') : (hi?'असत्यापित':'unverified')}) · {documents[profile.document_type][hi?1:0]} •••• {profile.document_suffix}</p>
        <button type="button" onClick={()=>setEditing(true)}>{hi?'बदलें':'Edit profile'}</button>
        <button type="button" disabled={busy} onClick={()=>run(async()=>setCode((await request('/cases/resident/assistance',{method:'POST'})).code))}>{hi?'सहायता केंद्र के लिए कोड बनाएँ':'Get help-desk filing code'}</button>
        {code && <p role="status">{code} · {hi?'एक शिकायत के लिए, 30 मिनट तक मान्य':'Give this code to the intake officer. Valid for one filing within 30 minutes.'}</p>}
      </details>
      {children(profile,()=>setRevision(n=>n+1))}
    </>}
    {profile && <details><summary>{hi?'मेरी शिकायतें':'My complaints'}</summary>
        {history.length===0 && <p>{hi?'अभी कोई शिकायत नहीं है।':'No linked complaints yet.'}</p>}
        {history.map(row=><div key={row.id}><button type="button" aria-expanded={selected===row.ticket} onClick={()=>setSelected(selected===row.ticket ? null : row.ticket)}>{row.ticket} · {row.department} · {row.status.replaceAll('_',' ')}</button>{selected===row.ticket && renderTracking(row.ticket,updated=>setHistory(rows=>rows.map(item=>item.ticket===updated.ticket ? {...item,status:updated.status} : item)))}</div>)}
        {more && <button disabled={busy} onClick={()=>run(async()=>{
          const rows=await request('/cases/resident/history?before='+history.at(-1).id)
          setHistory(h=>[...h,...rows]);setMore(rows.length===25)
        })}>{hi?'और देखें':'Load more'}</button>}
    </details>}
  </>
}
