export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '64px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: '#e8edf8', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 32 }}>{icon}</span>
      </div>
      <div style={{
        fontSize: 17, fontWeight: 600,
        color: '#111', marginBottom: 8,
      }}>{title}</div>
      <div style={{
        fontSize: 14, color: '#6b7280',
        marginBottom: action ? 24 : 0,
        maxWidth: 280, lineHeight: 1.5,
      }}>{subtitle}</div>
      {action && (
        <button onClick={action.onClick} style={{
          background: '#0d3580', color: '#fff',
          border: 'none', borderRadius: 10,
          padding: '10px 24px', fontSize: 14,
          fontWeight: 500, cursor: 'pointer',
        }}>{action.label}</button>
      )}
    </div>
  )
}
