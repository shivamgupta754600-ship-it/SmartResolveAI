import { useState } from 'react'
import { request } from '../api/client'
import { caseRequest } from '../api/cases'

export function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('invalid_photo'))
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.readAsDataURL(file)
  })
}

export default function CasePhoto({ ticket, access, token, account, lang = 'en' }) {
  const [image, setImage] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const hi = lang === 'hi'

  async function show() {
    setFailed(false)
    setBusy(true)
    try {
      const result = token
        ? await caseRequest('/staff/case/' + ticket + '/photo', { token })
        : account ? await request('/cases/resident/photo', {method:'POST', body:JSON.stringify({ticket})})
        : await caseRequest('/photo', { body: access })
      setImage('data:image/jpeg;base64,' + result.jpeg)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return <div className="case-photo">
    <button type="button" disabled={busy} onClick={image ? () => setImage('') : show}>
      {image ? (hi ? 'फ़ोटो छिपाएँ' : 'Hide photo') : (hi ? 'शिकायत की फ़ोटो देखें' : 'View complaint photo')}
    </button>
    {failed && <p role="alert">{hi ? 'फ़ोटो नहीं खुल सकी। फिर कोशिश करें।' : 'Could not load the photo. Try again.'}</p>}
    {image && <img src={image} alt={hi ? 'शिकायत के साथ जमा की गई फ़ोटो' : 'Photo submitted with this complaint'} />}
  </div>
}
