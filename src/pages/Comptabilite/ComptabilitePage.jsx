import { useState, useMemo } from 'react'
import { useFactures }    from '../../hooks/useFactures'
import { useClients }     from '../../hooks/useClients'
import { useParametres }  from '../../hooks/useParametres'
import { formatEuro, formatDate } from '../../utils/formatters'
import { estEnRetard, joursDeRetard as jdr } from '../../utils/calcFacture'
import { generateFEC, downloadFEC }           from '../../utils/exportFEC'
import { envoyerEmailRelance, EMAILJS_FACTURE_CONFIGURE } from '../../utils/emailFacture'
import { useResponsive } from '../../hooks/useResponsive'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import DownloadIcon       from '@mui/icons-material/Download'
import WarningIcon        from '@mui/icons-material/Warning'
import SendIcon           from '@mui/icons-material/Send'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'

const TRIMESTRES = [
  { k: 'T1', label: 'T1 (Jan–Mar)', mois: ['01', '02', '03'] },
  { k: 'T2', label: 'T2 (Avr–Jun)', mois: ['04', '05', '06'] },
  { k: 'T3', label: 'T3 (Jul–Sep)', mois: ['07', '08', '09'] },
  { k: 'T4', label: 'T4 (Oct–Déc)', mois: ['10', '11', '12'] },
]

export default function ComptabilitePage() {
  const { factures } = useFactures()
  const { clients }  = useClients()
  const { parametres } = useParametres()
  const { isMobile } = useResponsive()
  const [onglet, setOnglet]     = useState('tva')
  const [tvaEncaissements, setTvaEncaissements] = useState(true)
  const [relanceSending, setRelanceSending] = useState({}) // { [factureId]: 'sending' | 'done' | 'error' }
  const [annee, setAnnee]       = useState(new Date().getFullYear())
  const [trimestreK, setTrimestre] = useState(() => {
    const m = new Date().getMonth() + 1
    if (m <= 3) return 'T1'
    if (m <= 6) return 'T2'
    if (m <= 9) return 'T3'
    return 'T4'
  })

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])

  const trimestre = TRIMESTRES.find(t => t.k === trimestreK)

  const facturesTrimestre = useMemo(() => factures.filter(f => {
    if (f.statut === 'annulee' || f.statut === 'brouillon') return false
    if (tvaEncaissements && f.statut !== 'payee' && f.statut !== 'paye') return false
    const d = f.dateEmission?.toDate ? f.dateEmission.toDate() : f.dateEmission ? new Date(f.dateEmission) : null
    if (!d) return false
    const mois = String(d.getMonth() + 1).padStart(2, '0')
    return d.getFullYear() === annee && trimestre.mois.includes(mois)
  }), [factures, annee, trimestre, tvaEncaissements])

  const tva20   = useMemo(() => facturesTrimestre.filter(f => !f.regimeTVA || f.regimeTVA === 'normal'), [facturesTrimestre])
  const tva10   = useMemo(() => facturesTrimestre.filter(f => f.regimeTVA === 'reduit'), [facturesTrimestre])
  const tva0    = useMemo(() => facturesTrimestre.filter(f => f.regimeTVA === 'autoliquidation'), [facturesTrimestre])

  const getHT = f => f.totalHT || (f.totalTTC || 0) - (f.totalTVA || 0) || 0
  const ca20 = tva20.reduce((s, f) => s + getHT(f), 0)
  const tv20 = tva20.reduce((s, f) => s + (f.totalTVA || 0), 0)
  const ca10 = tva10.reduce((s, f) => s + getHT(f), 0)
  const tv10 = tva10.reduce((s, f) => s + (f.totalTVA || 0), 0)
  const ca0  = tva0.reduce( (s, f) => s + getHT(f), 0)
  const totalTVA = tv20 + tv10

  const impayees = useMemo(() => factures.filter(f => estEnRetard(f) && f.solde > 0), [factures])
    .sort((a, b) => {
      const da = a.dateEcheance?.toDate ? a.dateEcheance.toDate() : new Date(a.dateEcheance)
      const db2 = b.dateEcheance?.toDate ? b.dateEcheance.toDate() : new Date(b.dateEcheance)
      return da - db2
    })

  async function handleRelancer(facture) {
    const client = clientMap[facture.clientId]
    if (!client?.email) {
      alert(`${client?.nom || 'Ce client'} n'a pas d'email renseigné.`)
      return
    }
    setRelanceSending(prev => ({ ...prev, [facture.id]: 'sending' }))
    try {
      await envoyerEmailRelance({
        facture,
        client,
        joursRetard: jdr(facture),
        societeNom:  parametres?.raisonSociale || 'Scaffold-OS',
      })
      setRelanceSending(prev => ({ ...prev, [facture.id]: 'done' }))
    } catch (e) {
      setRelanceSending(prev => ({ ...prev, [facture.id]: 'error' }))
      alert('Erreur envoi : ' + e.message)
    }
  }

  function exporterFEC() {
    const debut = new Date(annee, (trimestre.mois[0] - 1), 1)
    const fin   = new Date(annee, parseInt(trimestre.mois[2]), 0)
    const enrichies = factures.map(f => ({ ...f, clientNom: clientMap[f.clientId]?.nom || f.clientId }))
    const content = generateFEC(enrichies, debut, fin)
    downloadFEC(content, debut)
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '16px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Comptabilité</h1>
        <div style={{ display: 'flex', gap: 4, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {[['tva', 'Récap TVA'], ['fec', 'Export FEC'], ['relances', 'Relances']].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: onglet === k ? '600' : '400', background: onglet === k ? 'rgba(255,255,255,0.2)' : 'transparent', color: onglet === k ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {l}{k === 'relances' && impayees.length > 0 ? ` (${impayees.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? '16px 12px' : 24 }}>
        {/* Sélecteurs communs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input type="number" value={annee} onChange={e => setAnnee(parseInt(e.target.value) || new Date().getFullYear())} style={{ background: '#FFFFFF', border: '1.5px solid #0d3580', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111111', outline: 'none', width: 80 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TRIMESTRES.map(t => (
              <button key={t.k} onClick={() => setTrimestre(t.k)} style={{ padding: '7px 14px', borderRadius: 8, border: trimestreK === t.k ? 'none' : '1px solid #e2e4ea', fontSize: 12, fontWeight: '500', background: trimestreK === t.k ? '#0d3580' : '#FFFFFF', color: trimestreK === t.k ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                {t.k}
              </button>
            ))}
          </div>
        </div>

        {onglet === 'tva' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={() => setTvaEncaissements(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: !tvaEncaissements ? '#0d3580' : '#f0f2f7', color: !tvaEncaissements ? '#fff' : '#6b7280' }}
            >TVA sur débits</button>
            <button onClick={() => setTvaEncaissements(true)}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: tvaEncaissements ? '#0d3580' : '#f0f2f7', color: tvaEncaissements ? '#fff' : '#6b7280' }}
            >TVA sur encaissements</button>
            <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
              {tvaEncaissements ? 'Seules les factures payées sont comptées' : 'Toutes les factures envoyées sont comptées'}
            </span>
          </div>
          <div>
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '18px 20px', maxWidth: 600 }}>
              <p style={{ fontSize: 15, fontWeight: '600', color: '#111111', margin: '0 0 16px' }}>
                Récapitulatif TVA — {trimestreK} {annee}
              </p>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #0d3580' }}>
                    {['Régime', 'CA HT', 'TVA collectée'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdS}>TVA 20% (normal)</td>
                    <td style={{ ...tdS, fontWeight: '500' }}>{formatEuro(ca20)}</td>
                    <td style={{ ...tdS, fontWeight: '500', color: '#0d3580' }}>{formatEuro(tv20)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdS}>TVA 10% (réduit)</td>
                    <td style={{ ...tdS, fontWeight: '500' }}>{formatEuro(ca10)}</td>
                    <td style={{ ...tdS, fontWeight: '500', color: '#0d3580' }}>{formatEuro(tv10)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdS}>Autoliquidation (0%)</td>
                    <td style={{ ...tdS, fontWeight: '500' }}>{formatEuro(ca0)}</td>
                    <td style={{ ...tdS, color: '#6b7280' }}>—</td>
                  </tr>
                  <tr style={{ background: '#e8edf8' }}>
                    <td style={{ ...tdS, fontWeight: '700' }}>Total TVA à reverser</td>
                    <td style={{ ...tdS, fontWeight: '700' }}>{formatEuro(ca20 + ca10 + ca0)}</td>
                    <td style={{ ...tdS, fontWeight: '700', color: '#0d3580', fontSize: 16 }}>{formatEuro(totalTVA)}</td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {onglet === 'fec' && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <AccountBalanceIcon style={{ fontSize: 32, color: '#0d3580' }} />
                <div>
                  <p style={{ fontSize: 15, fontWeight: '600', color: '#111111', margin: 0 }}>Export FEC</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Fichier des Écritures Comptables — Format légal DGFiP</p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#3d3d3d', marginBottom: 16 }}>
                Exporte toutes les écritures comptables du {trimestreK} {annee} au format FEC (pipe-séparé, UTF-8 BOM) conforme à l'article A47 A-1 du LPF.
              </p>
              <div style={{ background: '#F0F2F7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
                <strong>Inclus :</strong> journal VT (ventes), journal BQ (banque), comptes 411, 706, 44571, 512
              </div>
              <button onClick={exporterFEC} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 14, fontWeight: '600', cursor: 'pointer' }}>
                <DownloadIcon style={{ fontSize: 18 }} />
                Télécharger FEC_{annee}_{trimestreK}.txt
              </button>
            </div>
          </div>
        )}

        {onglet === 'relances' && (
          <div style={{ maxWidth: 700 }}>
            {impayees.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>✓ Aucune facture en retard</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {impayees.map(f => {
                    const client = clientMap[f.clientId]
                    const jours  = jdr(f)
                    return (
                      <div key={f.id} style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #dc2626', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <WarningIcon style={{ fontSize: 24, color: '#dc2626', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>{f.numero} · {client?.nom || '—'}</p>
                          <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0', fontWeight: '500' }}>{jours} jours de retard · Échu le {formatDate(f.dateEcheance)}</p>
                          {!client?.email && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0', fontStyle: 'italic' }}>Pas d'email renseigné</p>}
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <p style={{ fontSize: 16, fontWeight: '700', color: '#dc2626', margin: 0 }}>{formatEuro(f.solde)}</p>
                          {EMAILJS_FACTURE_CONFIGURE && client?.email && (() => {
                            const etat = relanceSending[f.id]
                            if (etat === 'done') return (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16a34a', fontWeight: '600' }}>
                                <CheckCircleIcon style={{ fontSize: 14 }} /> Relance envoyée
                              </span>
                            )
                            return (
                              <button
                                onClick={() => handleRelancer(f)}
                                disabled={etat === 'sending'}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: etat === 'sending' ? '#f3f4f6' : '#dc2626', color: etat === 'sending' ? '#9ca3af' : '#fff', border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: '600', cursor: etat === 'sending' ? 'not-allowed' : 'pointer' }}
                              >
                                <SendIcon style={{ fontSize: 13 }} />
                                {etat === 'sending' ? 'Envoi…' : 'Relancer'}
                              </button>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}
      </div>
    </div>
  )
}

const tdS = { padding: '10px 8px', fontSize: 13, color: '#111111', borderBottom: '1px solid #f3f4f6' }
