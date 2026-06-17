import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFactures } from '../../hooks/useFactures'
import { useClients }  from '../../hooks/useClients'
import { formatEuro, formatDate, formatStatut } from '../../utils/formatters'
import { EmptyState } from '../../components/ui/EmptyState'
import { estEnRetard, joursDeRetard } from '../../utils/calcFacture'
import { BADGES } from '../../constants/theme'
import FactureWizard from './FactureWizard'
import AddIcon          from '@mui/icons-material/Add'
import SearchIcon       from '@mui/icons-material/Search'
import DescriptionIcon  from '@mui/icons-material/Description'
import FilterListIcon   from '@mui/icons-material/FilterList'

export default function FacturesPage() {
  const { factures, loading } = useFactures()
  const { clients }           = useClients()
  const navigate              = useNavigate()
  const [wizardOpen,    setWizardOpen]    = useState(false)
  const [search,        setSearch]        = useState('')
  const [filtreStatut,  setFiltreStatut]  = useState('')
  const [showArchives,  setShowArchives]  = useState(false)

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])

  const facturesFiltrees = useMemo(() => {
    return factures
      .filter(f => {
        const client = clientMap[f.clientId]
        const matchSearch = !search ||
          f.numero?.toLowerCase().includes(search.toLowerCase()) ||
          client?.nom?.toLowerCase().includes(search.toLowerCase()) ||
          f.chantierId?.toLowerCase().includes(search.toLowerCase())
        const matchStatut = !filtreStatut || f.statut === filtreStatut
        const matchArchive = showArchives
          ? f.statut === 'archivee'
          : f.statut !== 'archivee'
        return matchSearch && matchStatut && matchArchive
      })
      .sort((a, b) => {
        const nA = parseInt(a.numero?.split('-')[2] || '0', 10)
        const nB = parseInt(b.numero?.split('-')[2] || '0', 10)
        return nB - nA
      })
  }, [factures, search, filtreStatut, clientMap, showArchives])

  const nbArchivees = useMemo(() => factures.filter(f => f.statut === 'archivee').length, [factures])

  if (wizardOpen) return <FactureWizard onClose={() => setWizardOpen(false)} mode="facture" />

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#ffffff', margin: 0 }}>Factures</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{factures.length} facture{factures.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}
        >
          <AddIcon style={{ fontSize: 18 }} />
          Nouvelle facture
        </button>
      </div>

      {/* Onglets Actives / Archives */}
      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 4, borderBottom: '1px solid #e2e4ea', background: '#FFFFFF' }}>
        {[
          { label: 'Actives',  active: !showArchives, onClick: () => { setShowArchives(false); setFiltreStatut('') } },
          { label: `Archives${nbArchivees > 0 ? ` (${nbArchivees})` : ''}`, active: showArchives, onClick: () => { setShowArchives(true); setFiltreStatut('') } },
        ].map(t => (
          <button key={t.label} onClick={t.onClick} style={{
            padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: t.active ? '600' : '400',
            color: t.active ? '#0d3580' : '#6b7280',
            borderBottom: t.active ? '2px solid #0d3580' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <SearchIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#6b7280' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher numéro, client…"
            style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '9px 12px 9px 36px', fontSize: 13, color: '#111111', outline: 'none' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <FilterListIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#6b7280' }} />
          <select
            value={filtreStatut}
            onChange={e => setFiltreStatut(e.target.value)}
            style={{ background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '9px 12px 9px 32px', fontSize: 13, color: '#111111', outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="envoyee">Envoyée</option>
            <option value="payee">Payée</option>
            <option value="annulee">Annulée</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      <div style={{ padding: '0 24px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
        ) : facturesFiltrees.length === 0 ? (
          <EmptyState icon="🧾" title="Aucune facture" subtitle="Créez votre première facture pour commencer" action={{ label: '+ Nouvelle facture', onClick: () => navigate('/factures/new') }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {facturesFiltrees.map(facture => (
              <FactureCard
                key={facture.id}
                facture={facture}
                client={clientMap[facture.clientId]}
                onClick={() => navigate(`/factures/${facture.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FactureCard({ facture, client, onClick }) {
  const enRetard = estEnRetard(facture)
  const retardJ  = joursDeRetard(facture)
  const statutEff = enRetard ? 'en_retard' : facture.statut
  const badge     = BADGES[statutEff] || BADGES.brouillon

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
      onClick={onClick}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: '600', color: '#111111' }}>{facture.numero}</span>
          <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...badge }}>
            {enRetard ? `En retard (${retardJ}j)` : formatStatut(facture.statut)}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#3d3d3d' }}>{client?.nom || '—'}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
          Échéance : {formatDate(facture.dateEcheance)}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: '600', color: '#0d3580' }}>{formatEuro(facture.totalTTC)}</p>
        {facture.solde > 0 && facture.statut !== 'brouillon' && (
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#c2410c' }}>Solde : {formatEuro(facture.solde)}</p>
        )}
      </div>
    </div>
  )
}
