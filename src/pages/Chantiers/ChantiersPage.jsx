import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChantiers } from '../../hooks/useChantiers'
import { useClients }   from '../../hooks/useClients'
import { formatDate, formatStatut } from '../../utils/formatters'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
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
      <PageHeader
        title="Chantiers"
        subtitle={`${chantiers.length} chantier${chantiers.length !== 1 ? 's' : ''}`}
        action={isPatron ? { label: '+ Nouveau chantier', onClick: () => setFormOpen(true) } : undefined}
      />

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
          <EmptyState icon="🏗️" title="Aucun chantier" subtitle="Ouvrez un nouveau chantier pour démarrer" action={{ label: '+ Nouveau chantier', onClick: () => navigate('/chantiers/new') }} />
        ) : chantiersFiltres.map(c => {
          const client = clientMap[c.clientId]
          const joursDepuis = c.dateDebut ? Math.max(0, Math.floor((Date.now() - new Date(c.dateDebut?.seconds ? c.dateDebut.seconds * 1000 : c.dateDebut).getTime()) / 86400000)) : 0
          return (
            <div key={c.id} onClick={() => navigate(`/chantiers/${c.id}`)}
              style={{
                background: '#fff', borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,53,128,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{c.nom}</span>
                <StatusBadge statut={c.statut} />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                {client?.nom || '—'} · {c.adresse?.ville || '—'} · Depuis {formatDate(c.dateDebut)}
              </div>
              <ProgressBar value={c.avancement || 0} showLabel height={7} />
              <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #f0f2f7', fontSize: 12, color: '#6b7280' }}>
                <span>👷 {c.nbOuvriers || 0} ouvriers</span>
                <span>📅 J+{joursDepuis}</span>
                <ChevronRightIcon style={{ fontSize: 18, color: '#c8d3ee', marginLeft: 'auto' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
