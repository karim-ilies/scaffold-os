export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      background: '#0d3580',
      padding: '20px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <h1 style={{
          fontSize: 22, fontWeight: 700,
          color: '#ffffff', margin: 0, lineHeight: 1.2,
        }}>{title}</h1>
        {subtitle && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.6)',
            margin: '4px 0 0', fontWeight: 400,
          }}>{subtitle}</p>
        )}
      </div>
      {action && (
        <button onClick={action.onClick} style={{
          background: '#ffffff', color: '#0d3580',
          border: 'none', borderRadius: 10,
          padding: '10px 20px', fontSize: 14,
          fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)' }}
        >
          {action.icon && <span>{action.icon}</span>}
          {action.label}
        </button>
      )}
    </div>
  )
}
