import { useState } from 'react'

export function Button({ variant = 'primary', children, onClick, disabled, fullWidth, size = 'md', style: extraStyle, ...props }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const base = {
    border: 'none', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 600, transition: 'all 0.15s ease',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }

  const sizes = {
    sm: { padding: '6px 14px', fontSize: 12 },
    md: { padding: '10px 20px', fontSize: 14 },
    lg: { padding: '14px 24px', fontSize: 16, minHeight: 48 },
  }

  const variants = {
    primary: {
      background: pressed ? '#0a2a6e' : hovered ? '#1a4ba0' : '#0d3580',
      color: '#fff',
      transform: pressed ? 'scale(0.98)' : hovered ? 'translateY(-1px)' : 'none',
      boxShadow: hovered && !pressed ? '0 4px 12px rgba(13,53,128,0.25)' : 'none',
    },
    secondary: {
      background: hovered ? '#e8edf8' : 'transparent',
      color: '#0d3580',
      border: '1.5px solid #0d3580',
      transform: pressed ? 'scale(0.98)' : 'none',
    },
    danger: {
      background: pressed ? '#991b1b' : hovered ? '#ef4444' : '#dc2626',
      color: '#fff',
      transform: pressed ? 'scale(0.98)' : 'none',
    },
    ghost: {
      background: hovered ? '#f0f2f7' : 'transparent',
      color: '#6b7280',
      border: '1.5px solid #e2e4ea',
      transform: pressed ? 'scale(0.98)' : 'none',
    },
    orange: {
      background: pressed ? '#b45309' : hovered ? '#d97706' : '#E8A838',
      color: '#fff',
      transform: pressed ? 'scale(0.98)' : hovered ? 'translateY(-1px)' : 'none',
      boxShadow: hovered && !pressed ? '0 4px 12px rgba(232,168,56,0.3)' : 'none',
    },
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...extraStyle }}
      {...props}
    >
      {children}
    </button>
  )
}
