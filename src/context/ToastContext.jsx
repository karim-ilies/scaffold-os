import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback(({ message, type = 'success', duration = 3000 }) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 99999, pointerEvents: 'none',
      }}>
        {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const config = {
    success: { accent: '#16a34a', icon: '✓' },
    error:   { accent: '#dc2626', icon: '✕' },
    warning: { accent: '#d97706', icon: '⚠' },
    info:    { accent: '#0d3580', icon: 'ℹ' },
  }
  const c = config[toast.type] || config.success

  return (
    <div
      onClick={onClose}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#1c1c1e', borderRadius: 12,
        padding: '12px 16px', minWidth: 280, maxWidth: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        borderLeft: `3px solid ${c.accent}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        cursor: 'pointer', pointerEvents: 'auto',
      }}
    >
      <span style={{ color: c.accent, fontSize: 14, fontWeight: 700, width: 18, textAlign: 'center', flexShrink: 0 }}>{c.icon}</span>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, flex: 1 }}>{toast.message}</span>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>×</span>
    </div>
  )
}

export const useToast = () => useContext(ToastContext)
