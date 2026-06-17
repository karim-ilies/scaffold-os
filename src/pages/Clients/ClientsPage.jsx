import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients }  from '../../hooks/useClients'
import { formatEuro }  from '../../utils/formatters'
import { useResponsive } from '../../hooks/useResponsive'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import AddIcon          from '@mui/icons-material/Add'
import SearchIcon       from '@mui/icons-material/Search'
import PersonIcon       from '@mui/icons-material/Person'
import BusinessIcon     from '@mui/icons-material/Business'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ClientQuickCreate from './ClientQuickCreate'

export default function ClientsPage() {
  const navigate       = useNavigate()
  const { clients }    = useClients()
  const { isMobile }   = useResponsive()
  const [search,    setSearch]    = useState('')
  const [typeFilter, setType]     = useState('')
  const [actifFilter, setActif]   = useState('actif')
  const [showCreate,  setCreate]  = useState(false)

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchActif = actifFilter === 'tous' || (actifFilter === 'actif' ? c.actif !== false : c.actif === false)
      const matchType  = !typeFilter || c.type === typeFilter
      const matchSearch = !search || [c.nom, c.telephone, c.adresse?.ville]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      return matchActif && matchType && matchSearch
    })
  }, [clients, search, typeFilter, actifFilter])

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PageHeader
        title="Clients"
        subtitle={`${clients.filter(c => c.actif !== false).length} clients actifs`}
        action={{ label: '+ Nouveau client', onClick: () => setCreate(true) }}
      />

      <div style={{ background: '#0d3580', padding: '0 24px 16px' }}>
        {/* Barre recherche */}
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <SearchIcon style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher nom, téléphone, ville…"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#fff', flex: 1, fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 24px', overflowX: 'auto' }}>
        {[['', 'Tous types'], ['pro', 'Professionnels'], ['particulier', 'Particuliers']].map(([v, l]) => (
          <button key={v} onClick={() => setType(v)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: typeFilter === v ? '600' : '400', background: typeFilter === v ? '#0d3580' : '#fff', color: typeFilter === v ? '#fff' : '#6b7280', border: typeFilter === v ? 'none' : '1px solid #e2e4ea', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {l}
          </button>
        ))}
        <div style={{ width: 1, background: '#e2e4ea', margin: '0 4px' }} />
        {[['actif', 'Actifs'], ['archive', 'Archivés'], ['tous', 'Tous']].map(([v, l]) => (
          <button key={v} onClick={() => setActif(v)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: actifFilter === v ? '600' : '400', background: actifFilter === v ? '#6b7280' : '#fff', color: actifFilter === v ? '#fff' : '#6b7280', border: actifFilter === v ? 'none' : '1px solid #e2e4ea', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <EmptyState icon="👥" title="Aucun client" subtitle="Ajoutez votre premier client" action={{ label: '+ Nouveau client', onClick: () => navigate('/clients/new') }} />
        ) : filtered.map(c => (
          <ClientCard key={c.id} client={c} onOpen={() => navigate(`/clients/${c.id}`)} isMobile={isMobile} />
        ))}
      </div>

      {showCreate && (
        <ClientQuickCreate
          onCreated={client => { setCreate(false); navigate(`/clients/${client.id}`) }}
          onClose={() => setCreate(false)}
        />
      )}
    </div>
  )
}

function ClientCard({ client, onOpen, isMobile }) {
  const isArchive = client.actif === false
  return (
    <div
      onClick={onOpen}
      style={{
        background: '#fff', borderRadius: 14,
        border: `1.5px solid ${isArchive ? '#e2e4ea' : '#0d3580'}`,
        padding: isMobile ? '14px' : '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', opacity: isArchive ? 0.7 : 1,
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: isArchive ? '#f3f4f6' : '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: 14, color: '#0d3580', flexShrink: 0 }}>
        {client.nom?.slice(0, 2).toUpperCase() || <PersonIcon />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>{client.nom}</p>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: client.type === 'pro' ? '#e8edf8' : '#f3f4f6', color: client.type === 'pro' ? '#0d3580' : '#374151', fontWeight: '600' }}>
            {client.type === 'pro' ? 'Pro' : 'Particulier'}
          </span>
          {isArchive && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: '600' }}>Archivé</span>}
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>
          {client.adresse?.ville || ''}{client.adresse?.ville && client.telephone ? ' · ' : ''}{client.telephone}
        </p>
        {!isMobile && (
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
            {client.nbChantiers || 0} chantier{(client.nbChantiers || 0) !== 1 ? 's' : ''} · {client.nbFactures || 0} facture{(client.nbFactures || 0) !== 1 ? 's' : ''} · CA {formatEuro(client.caTotalHT || 0)}
          </p>
        )}
      </div>
      <ChevronRightIcon style={{ fontSize: 20, color: '#c8d3ee', flexShrink: 0 }} />
    </div>
  )
}
