import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChantiers } from '../../hooks/useChantiers'
import { useClients }   from '../../hooks/useClients'
import { formatDate, formatStatut } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import ChantierForm from './ChantierForm'
import AddIcon            from '@mui/icons-material/Add'
import SearchIcon         from '@mui/icons-material/Search'
import ConstructionIcon   from '@mui/icons-material/Construction'
import LocationOnIcon     from '@mui/icons-material/LocationOn'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'
import FilterListIcon     from '@mui/icons-material/FilterList'
import { useAuth }        from '../../hooks/useAuth'
import { useResponsive }  from '../../hooks/useResponsive'

const STATUTS = ['en_attente', 'en_cours', 'termine', 'annule']

export default function ChantiersPage() {
  const { chantiers, loading }      = useChantiers()
  const { isPatron, isChefEquipe, isComptable } = useAuth()
  const { clients }                 = useClients(isPatron || isComptable)
  const { isMobile }           = useResponsive()
  const [formOpen,      setFormOpen]      = useState(false)
  const [search,        setSearch]        = useState('')
  const [filtreStatut,  setFiltreStatut]  = useState('')
  const navigate = useNavigate()

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])

  const chantiersFiltres = useMemo(() => chantiers.filter(c => {
    const client = clientMap[c.clientId]
    const matchSearch = !search || c.nom?.toLowerCase().includes(search.toLowerCase()) || client?.nom?.toLowerCase().includes(search.toLowerCase())
    const matchStatut = !filtreStatut || c.statut === filtreStatut
    return matchSearch && matchStatut
  }), [chantiers, search, filtreStatut, clientMap])

  if (formOpen) return <ChantierForm onClose={() => setFormOpen(false)} />

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Chantiers</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{chantiers.length} chantier{chantiers.length !== 1 ? 's' : ''}</p>
        </div>
        {isPatron && (
          <button onClick={() => setFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
            <AddIcon style={{ fontSize: 18 }} />Nouveau chantier
          </button>
        )}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <SearchIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#6b7280' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '9px 12px 9px 36px', fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Filtre statut — dropdown compact sur mobile, pills sur desktop */}
        {isMobile ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <FilterListIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: filtreStatut ? '#0d3580' : '#6b7280', pointerEvents: 'none' }} />
            <select
              value={filtreStatut}
              onChange={e => setFiltreStatut(e.target.value)}
              style={{
                appearance: 'none', WebkitAppearance: 'none',
                background: filtreStatut ? '#e8edf8' : '#FFFFFF',
                border: `1.5px solid ${filtreStatut ? '#0d3580' : '#e2e4ea'}`,
                borderRadius: 8, padding: '9px 28px 9px 32px',
                fontSize: 13, fontWeight: filtreStatut ? '600' : '400',
                color: filtreStatut ? '#0d3580' : '#6b7280',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Tous</option>
              {STATUTS.map(s => <option key={s} value={s}>{formatStatut(s)}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: filtreStatut ? '#0d3580' : '#6b7280', pointerEvents: 'none' }}>▼</span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {['', ...STATUTS].map(s => (
              <button key={s} onClick={() => setFiltreStatut(s)} style={{
                padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: '500', cursor: 'pointer',
                background: filtreStatut === s ? '#0d3580' : '#FFFFFF',
                color:      filtreStatut === s ? '#fff' : '#6b7280',
                border:     filtreStatut === s ? '1.5px solid #0d3580' : '1px solid #e2e4ea',
              }}>
                {s === '' ? 'Tous' : formatStatut(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
        ) : chantiersFiltres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <ConstructionIcon style={{ fontSize: 48, color: '#c8d3ee', marginBottom: 12 }} />
            <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>Aucun chantier trouvé</p>
          </div>
        ) : chantiersFiltres.map(c => {
          const client = clientMap[c.clientId]
          const badge  = BADGES[c.statut] || BADGES.en_attente
          return (
            <div key={c.id} onClick={() => navigate(`/chantiers/${c.id}`)} style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, background: '#e8edf8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ConstructionIcon style={{ fontSize: 20, color: '#0d3580' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: '600', color: '#111111' }}>{c.nom}</span>
                  <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...badge }}>{formatStatut(c.statut)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#3d3d3d' }}>{client?.nom || '—'}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <LocationOnIcon style={{ fontSize: 12, color: '#6b7280' }} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{c.adresse?.ville || '—'} · Début : {formatDate(c.dateDebut)}</span>
                </div>
              </div>
              <ChevronRightIcon style={{ fontSize: 20, color: '#c8d3ee' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
