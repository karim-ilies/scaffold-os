import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDevis }   from '../../hooks/useDevis'
import { useClients } from '../../hooks/useClients'
import { formatEuro, formatDate, formatStatut } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import FactureWizard from '../Factures/FactureWizard'
import AddIcon        from '@mui/icons-material/Add'
import SearchIcon     from '@mui/icons-material/Search'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import SwapHorizIcon  from '@mui/icons-material/SwapHoriz'

export default function DevisPage() {
  const { devis, loading, convertirEnFacture } = useDevis()
  const { clients }                             = useClients()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [search,    setSearch]      = useState('')
  const navigate = useNavigate()

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])

  const devisFiltres = useMemo(() => devis
    .filter(d => {
      const client = clientMap[d.clientId]
      return !search || d.numero?.toLowerCase().includes(search.toLowerCase()) || client?.nom?.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      const nA = parseInt(a.numero?.split('-')[2] || '0', 10)
      const nB = parseInt(b.numero?.split('-')[2] || '0', 10)
      return nB - nA
    }),
  [devis, search, clientMap])

  const isExpire = (d) => {
    if (!d.dateValidite || d.statut !== 'envoye') return false
    const date = d.dateValidite?.toDate ? d.dateValidite.toDate() : new Date(d.dateValidite)
    return date < new Date()
  }

  const joursRestants = (d) => {
    if (!d.dateValidite) return null
    const date = d.dateValidite?.toDate ? d.dateValidite.toDate() : new Date(d.dateValidite)
    const diff = date - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  if (wizardOpen) return <FactureWizard onClose={() => setWizardOpen(false)} mode="devis" />

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#ffffff', margin: 0 }}>Devis</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{devis.length} devis</p>
        </div>
        <button onClick={() => setWizardOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
          <AddIcon style={{ fontSize: 18 }} />Nouveau devis
        </button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        <div style={{ position: 'relative' }}>
          <SearchIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#6b7280' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ width: '100%', boxSizing: 'border-box', background: '#FFFFFF', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '9px 12px 9px 36px', fontSize: 13, color: '#111111', outline: 'none' }} />
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
        ) : devisFiltres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <RequestQuoteIcon style={{ fontSize: 48, color: '#c8d3ee', marginBottom: 12 }} />
            <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>Aucun devis trouvé</p>
          </div>
        ) : devisFiltres.map(d => {
          const expire     = isExpire(d)
          const jours      = joursRestants(d)
          const statutEff  = expire ? 'expire' : d.statut
          const badge      = BADGES[statutEff] || BADGES.brouillon
          const client     = clientMap[d.clientId]

          return (
            <div key={d.id} onClick={() => navigate(`/devis/${d.id}`)} style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: '600', color: '#111111' }}>{d.numero}</span>
                  <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...badge }}>
                    {expire ? 'Expiré' : formatStatut(d.statut)}
                  </span>
                  {d.statut === 'envoye' && !expire && jours !== null && (
                    <span style={{ fontSize: 11, color: jours <= 3 ? '#c2410c' : '#d97706' }}>
                      Expire dans {jours}j
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#3d3d3d' }}>{client?.nom || '—'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Valide jusqu'au : {formatDate(d.dateValidite)}</p>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: '600', color: '#0d3580' }}>{formatEuro(d.totalTTC)}</p>
                {d.statut === 'accepte' && !d.factureId && (
                  <button
                    onClick={e => { e.stopPropagation(); convertirEnFacture(d.id, d).then(fid => navigate(`/factures/${fid}`)) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: '600', cursor: 'pointer' }}
                  >
                    <SwapHorizIcon style={{ fontSize: 14 }} />Convertir en facture
                  </button>
                )}
                {d.factureId && (
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: '500' }}>✓ Facturé</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
