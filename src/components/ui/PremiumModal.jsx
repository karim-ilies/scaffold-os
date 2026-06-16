import { useEffect } from 'react'
import DeleteIcon      from '@mui/icons-material/Delete'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import InfoIcon        from '@mui/icons-material/Info'

const CFG = {
  danger: {
    bg: '#1f0a0a', border: '#991b1b', iconColor: '#ef4444',
    btnBg: '#dc2626', Icon: DeleteIcon,
  },
  confirm: {
    bg: '#0a0f1f', border: '#1e3a8a', iconColor: '#3b82f6',
    btnBg: '#0d3580', Icon: CheckCircleIcon,
  },
  info: {
    bg: '#0a0f1f', border: '#1e3a8a', iconColor: '#60a5fa',
    btnBg: '#0d3580', Icon: InfoIcon,
  },
}

export default function PremiumModal({
  type = 'confirm',
  title,
  message,
  confirmLabel = 'Confirmer',
  initials,
  onConfirm,
  onCancel,
}) {
  const cfg    = CFG[type] || CFG.confirm
  const { Icon } = cfg
  const isInfo = type === 'info'

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !isInfo) onCancel?.()
      if (e.key === 'Enter') onConfirm?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onCancel, isInfo])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !isInfo) onCancel?.() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: cfg.bg, border: `1.5px solid ${cfg.border}`,
        borderRadius: 16, padding: '24px 24px 20px',
        width: '100%', maxWidth: 300,
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ background: `${cfg.iconColor}22`, borderRadius: 12, padding: 10, display: 'flex' }}>
            <Icon style={{ fontSize: 22, color: cfg.iconColor }} />
          </div>
          {initials && (
            <div style={{
              background: cfg.border, borderRadius: 8,
              padding: '4px 10px', fontSize: 13, fontWeight: '700',
              color: '#ffffff', letterSpacing: '0.04em',
            }}>
              {initials}
            </div>
          )}
        </div>

        <p style={{ fontSize: 16, fontWeight: '600', color: '#ffffff', margin: '0 0 8px', lineHeight: 1.3 }}>
          {title}
        </p>
        {message && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{
              width: '100%', background: cfg.btnBg, color: '#fff',
              border: 'none', borderRadius: 10, padding: 12,
              fontSize: 14, fontWeight: '600', cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
          {!isInfo && (
            <button
              onClick={onCancel}
              style={{
                width: '100%', background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: 11,
                fontSize: 13, fontWeight: '500', cursor: 'pointer',
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
