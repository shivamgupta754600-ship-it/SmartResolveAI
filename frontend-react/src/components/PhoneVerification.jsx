import { useEffect, useRef, useState } from 'react'
import { request } from '../api/client'

let scriptReady
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptReady) {
    scriptReady = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = () => window.turnstile.ready(() => resolve(window.turnstile))
      script.onerror = () => {
        scriptReady = undefined
        script.remove()
        reject(new Error('Could not load the CAPTCHA.'))
      }
      document.head.append(script)
    })
  }
  return scriptReady
}

export default function PhoneVerification({phone, account = false, onVerified, lang = 'en'}) {
  const host = useRef(null)
  const [captcha,setCaptcha] = useState('')
  const [challenge,setChallenge] = useState('')
  const [code,setCode] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [reload,setReload] = useState(0)
  const hi = lang === 'hi'
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const validPhone = /^(?:[+]91|91)?[6-9][0-9]{9}$/.test(phone)
  useEffect(() => {
    if (!sitekey || !validPhone) return
    let active = true
    let widget
    loadTurnstile().then(api => {
      if (!active) return
      widget = api.render(host.current, {
        sitekey, action:account ? 'change_phone' : 'register', language:lang,
        callback: token => { if (active) setCaptcha(token) },
        'expired-callback': () => setCaptcha(''),
        'error-callback': () => { setCaptcha('');setError(hi?'कैप्चा फिर से लोड करें।':'Reload the CAPTCHA and try again.') },
      })
    }).catch(() => { if(active) setError(hi?'कैप्चा नहीं खुला।':'Could not load the CAPTCHA.') })
    return () => {
      active = false
      if (widget !== undefined) window.turnstile.remove(widget)
    }
  }, [reload,sitekey,validPhone,account,lang,hi])

  async function send() {
    setBusy(true);setError('')
    try {
      const result = await request(account ? '/auth/phone/request' : '/auth/otp/request', {
        method:'POST',body:JSON.stringify({phone,captcha}),
      })
      setChallenge(result.challenge)
      setCode('')
    } catch (err) { setError(err.message) }
    finally { setBusy(false);setCaptcha('');setReload(n=>n+1) }
  }

  async function verify() {
    setBusy(true);setError('')
    try {
      const result = await request('/auth/otp/verify',{method:'POST',body:JSON.stringify({challenge,code})})
      if (account) await request('/auth/phone/confirm',{method:'POST',body:JSON.stringify({phone,...result})})
      await onVerified(result.phone_proof)
    } catch(err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return <fieldset className="space-y-2">
    <legend>{hi?'मोबाइल नंबर सत्यापन':'Mobile verification'}</legend>
    <div ref={host}/>
    {!sitekey && <p role="alert">{hi?'सत्यापन सेवा अभी उपलब्ध नहीं है।':'Mobile verification is unavailable until CAPTCHA is configured.'}</p>}
    {sitekey && error && <button type="button" onClick={()=>{setCaptcha('');setReload(n=>n+1)}}>{hi?'कैप्चा दोबारा लोड करें':'Reload CAPTCHA'}</button>}
    <button className="btn-primary" type="button" disabled={busy || !captcha || !validPhone}
      onClick={send}>{challenge ? (hi?'नया कोड भेजें':'Send a new code') : (hi?'एसएमएस कोड भेजें':'Send SMS code')}</button>
    {challenge && <>
      <label>{hi?'एसएमएस से मिला छह अंकों का कोड':'Six-digit code from SMS'}
        <input className="input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/>
      </label>
      <button className="btn-primary" type="button" disabled={busy || !/^[0-9]{6}$/.test(code)} onClick={verify}>{hi?'कोड जाँचें':'Verify code'}</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </fieldset>
}
