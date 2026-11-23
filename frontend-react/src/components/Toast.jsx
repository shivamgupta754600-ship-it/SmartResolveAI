import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success : <CheckCircle  size={18} className="text-green-500 shrink-0" />,
  error   : <XCircle      size={18} className="text-red-500 shrink-0" />,
  info    : <Info         size={18} className="text-blue-500 shrink-0" />,
  warning : <AlertTriangle size={18} className="text-yellow-500 shrink-0" />,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info', duration = 3800) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2.5 items-end">
        {toasts.map(t => (
          <div
            key={t.id}
            className="animate-slide-up flex items-start gap-3 px-4 py-3 bg-white rounded-xl
                       shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100
                       min-w-[280px] max-w-[380px]"
          >
            {ICONS[t.type] ?? ICONS.info}
            <span className="text-sm text-gray-800 font-medium flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
