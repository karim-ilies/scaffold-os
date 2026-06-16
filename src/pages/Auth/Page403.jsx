import { useNavigate } from 'react-router-dom'
import BlockIcon from '@mui/icons-material/Block'

export default function Page403() {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F7F8FA', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <BlockIcon style={{ fontSize: 64, color: '#dc2626', marginBottom: 16 }} />
        <h1 style={{ fontSize: 22, fontWeight: '600', color: '#111111', margin: '0 0 8px' }}>Accès refusé</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>Vous n'avez pas les permissions pour accéder à cette page.</p>
        <button onClick={() => navigate(-1)} style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>
          Retour
        </button>
      </div>
    </div>
  )
}
