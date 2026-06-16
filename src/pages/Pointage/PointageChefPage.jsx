import { useMemo } from 'react'
import { useAuth }      from '../../hooks/useAuth'
import { useChantiers } from '../../hooks/useChantiers'
import { usePointage }  from '../../hooks/usePointage'
import { usePersonnel } from '../../hooks/usePersonnel'
import { formatHeures, formatStatut, dateToString } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import ConstructionIcon from '@mui/icons-material/Construction'
import AccessTimeIcon   from '@mui/icons-material/AccessTime'

const today = dateToString(new Date())

export default function PointageChefPage() {
  const { user }       = useAuth()
  const { chantiers }  = useChantiers({ chefEquipeId: user?.uid })
  const { pointages }  = usePointage({ date: today })
  const { personnel }  = usePersonnel()

  const chantierIds = useMemo(() => new Set(chantiers.map(c => c.id)), [chantiers])
  const usersMap    = useMemo(() => Object.fromEntries(personnel.map(p => [p.id, p])), [personnel])
  const chantiersMap = useMemo(() => Object.fromEntries(chantiers.map(c => [c.id, c])), [chantiers])

  // Pointages d'aujourd'hui sur les chantiers de ce chef
  const mesPointages = useMemo(
    () => pointages.filter(p => chantierIds.has(p.chantierId)),
    [pointages, chantierIds]
  )

  // Grouper par chantier
  const parChantier = useMemo(() => {
    const map = {}
    mesPointages.forEach(p => {
      if (!map[p.chantierId]) map[p.chantierId] = []
      map[p.chantierId].push(p)
    })
    return map
  }, [mesPointages])

  const totalOuvriers = mesPointages.length
  const enCours       = mesPointages.filter(p => p.statut === 'en_cours').length

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '16px 20px' }}>
        <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>Mon équipe</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
          Aujourd'hui · {totalOuvriers} pointage(s) · {enCours} en cours
        </p>
      </div>

      <div style={{ padding: '16px 16px 32px' }}>
        {chantiers.length === 0 ? (
          <Vide texte="Aucun chantier ne vous est assigné aujourd'hui" />
        ) : Object.keys(parChantier).length === 0 ? (
          <>
            {/* Chantiers en cours mais sans pointage */}
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Chantiers assignés</p>
            {chantiers.filter(c => c.statut === 'en_cours').map(c => (
              <ChantierVide key={c.id} nom={c.nom} />
            ))}
          </>
        ) : (
          Object.entries(parChantier).map(([chantierId, pts]) => {
            const chantier = chantiersMap[chantierId]
            return (
              <div key={chantierId} style={{ marginBottom: 16 }}>
                {/* En-tête chantier */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ConstructionIcon style={{ fontSize: 16, color: '#0d3580' }} />
                  <p style={{ fontSize: 13, fontWeight: '600', color: '#0d3580', margin: 0 }}>
                    {chantier?.nom || chantierId}
                  </p>
                  <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                    {pts.length} ouvrier(s)
                  </span>
                </div>

                {/* Pointages du chantier */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pts.map(p => {
                    const ouvrier  = usersMap[p.ouvrierId]
                    const badge    = BADGES[p.statut] || {}
                    const nomComplet = ouvrier ? `${ouvrier.prenom} ${ouvrier.nom}` : p.ouvrierId.slice(0, 8) + '…'

                    return (
                      <div key={p.id} style={{
                        background: '#FFFFFF', borderRadius: 12,
                        border: '1.5px solid #0d3580', padding: '12px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        {/* Avatar */}
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: '#e8edf8', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 15, fontWeight: '700',
                          color: '#0d3580', flexShrink: 0,
                        }}>
                          {ouvrier ? `${(ouvrier.prenom || '?')[0]}${(ouvrier.nom || '?')[0]}` : '?'}
                        </div>

                        {/* Infos */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>{nomComplet}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <AccessTimeIcon style={{ fontSize: 13, color: '#6b7280' }} />
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                              {p.heureDebut}
                              {p.heureFin ? ` – ${p.heureFin}` : ' · en cours'}
                            </span>
                            {p.heuresTravaillees > 0 && (
                              <span style={{ fontSize: 12, color: '#0d3580', fontWeight: '500' }}>
                                · {formatHeures(p.heuresTravaillees)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badge statut */}
                        <span style={{
                          fontSize: 11, fontWeight: '600',
                          padding: '3px 10px', borderRadius: 20,
                          whiteSpace: 'nowrap', ...badge,
                        }}>
                          {formatStatut(p.statut)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

        {/* Ouvriers non encore pointés */}
        {chantiers.filter(c => c.statut === 'en_cours' && !parChantier[c.id]).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Pas encore pointés aujourd'hui</p>
            {chantiers
              .filter(c => c.statut === 'en_cours' && !parChantier[c.id])
              .map(c => <ChantierVide key={c.id} nom={c.nom} />)
            }
          </div>
        )}

        <div style={{ background: '#e8edf8', borderRadius: 10, padding: '12px 14px', marginTop: 16 }}>
          <p style={{ fontSize: 12, color: '#0d3580', margin: 0, lineHeight: 1.4 }}>
            Les pointages sont validés par le patron uniquement. Contactez-le pour toute correction.
          </p>
        </div>
      </div>
    </div>
  )
}

function ChantierVide({ nom }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px dashed #c8d3ee', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <ConstructionIcon style={{ fontSize: 16, color: '#c8d3ee' }} />
      <span style={{ fontSize: 13, color: '#9ca3af' }}>{nom} — aucun pointage</span>
    </div>
  )
}

function Vide({ texte }) {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
      <ConstructionIcon style={{ fontSize: 40, color: '#c8d3ee', marginBottom: 10 }} />
      <p style={{ margin: 0, fontSize: 14 }}>{texte}</p>
    </div>
  )
}
