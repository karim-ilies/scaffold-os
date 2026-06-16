import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePersonnel } from '../../hooks/usePersonnel'
import { formatDate, formatRole, formatStatut } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import AddIcon    from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import PeopleIcon from '@mui/icons-material/People'

const ROLES = ['patron', 'chef_equipe', 'ouvrier', 'comptable']
const ROLES_COLORS = {
  patron:      { background: '#e8edf8', color: '#0d3580' },
  chef_equipe: { background: '#fef9c3', color: '#a16207' },
  ouvrier:     { background: '#f3f4f6', color: '#374151' },
  comptable:   { background: '#dbeafe', color: '#1d4ed8' },
}

export default function PersonnelPage() {
  const { personnel, loading } = usePersonnel()
  const [search,       setSearch]       = useState('')
  const [filtreRole,   setFiltreRole]   = useState('')
  const [filtreActif,  setFiltreActif]  = useState(true)
  const navigate = useNavigate()

  const personnelFiltre = personnel.filter(p => {
    const matchSearch = !search || `${p.nom} ${p.prenom}`.toLowerCase().includes(search.toLowerCase())
    const matchRole   = !filtreRole || p.role === filtreRole
    const matchActif  = p.actif === filtreActif
    return matchSearch && matchRole && matchActif
  })

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Personnel</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{personnelFiltre.length} employé(s)</p>
        </div>
        <button onClick={() => navigate('/personnel/nouveau')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
          <AddIcon style={{ fontSize: 18 }} />Inviter
        </button>
      </div>

      <div style={{ padding: '16px 24px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
          <SearchIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#6b7280' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none' }} />
        </div>
        <select value={filtreRole} onChange={e => setFiltreRole(e.target.value)} style={{ background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111111', outline: 'none' }}>
          <option value="">Tous les rôles</option>
          {ROLES.map(r => <option key={r} value={r}>{formatRole(r)}</option>)}
        </select>
        <button onClick={() => setFiltreActif(!filtreActif)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e2e4ea', background: filtreActif ? '#0d3580' : '#FFFFFF', color: filtreActif ? '#fff' : '#6b7280', fontSize: 13, cursor: 'pointer' }}>
          {filtreActif ? 'Actifs' : 'Inactifs'}
        </button>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading
          ? <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
          : personnelFiltre.length === 0
          ? <div style={{ textAlign: 'center', padding: 64 }}><PeopleIcon style={{ fontSize: 48, color: '#c8d3ee', marginBottom: 12 }} /><p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>Aucun employé trouvé</p></div>
          : personnelFiltre.map(p => {
              const roleStyle = ROLES_COLORS[p.role] || {}
              return (
                <div key={p.id} onClick={() => navigate(`/personnel/${p.id}`)} style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: '700', color: '#0d3580', flexShrink: 0, overflow: 'hidden' }}>
                    {p.photo ? <img src={p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(p.prenom || '?')[0]}${(p.nom || '?')[0]}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: '600', color: '#111111', margin: 0 }}>{p.prenom} {p.nom}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{p.telephone || p.email || '—'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...roleStyle }}>{formatRole(p.role)}</span>
                    <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, background: p.actif ? '#dcfce7' : '#fee2e2', color: p.actif ? '#16a34a' : '#dc2626' }}>
                      {p.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
