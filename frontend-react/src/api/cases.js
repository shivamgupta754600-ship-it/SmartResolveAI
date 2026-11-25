const base = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function caseRequest(path, { body, token } = {}) {
  const response = await fetch(`${base}/cases${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(typeof result.detail === 'string' ? result.detail : 'invalid_input')
    error.status = response.status
    throw error
  }
  return result
}

export function newReceipt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
    byte.toString(16).padStart(2, '0')).join('')
}
