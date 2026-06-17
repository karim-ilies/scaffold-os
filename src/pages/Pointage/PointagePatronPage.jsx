import { useState, useMemo } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useAuth }       from '../../hooks/useAuth'
import { usePointage, exportCSVPointages } from '../../hooks/usePointage'
import { usePersonnel }  from '../../hooks/usePersonnel'
import { useChantiers }  from '../../hooks/useChantiers'
import { formatHeures, formatStatut, dateToString } from '../../utils/formatters'
import { distanceMetres, estSurChantier } from '../../utils/gps'
import { BADGES }        from '../../constants/theme'
import CheckIcon    from '@mui/icons-material/Check'
import CloseIcon    from '@mui/icons-material/Close'
import EditIcon     from '@mui/icons-material/Edit'
import DownloadIcon from '@mui/icons-material/Download'
import LocationOnIcon    from '@mui/icons-material/LocationOn'
import GpsFixedIcon      from '@mui/icons-material/GpsFixed'
import GpsOffIcon        from '@mui/icons-material/GpsOff'
import AccessTimeIcon    from '@mui/icons-material/AccessTime'

const today = dateToString(new Date())

function jours(annee, mois) {
  const nb = new Date(annee, mois, 0).getDate()
  return Array.from({ length: nb }, (_, i) => i + 1)
}

export default function PointagePatronPage() {
  const { user } = useAuth()
  const [onglet, setOnglet] = useState('valider')
  const [moisSel, setMoisSel] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState([])
  const [modalData, setModalData] = useState(null)

  const { pointages: aVerifier, validerPointage, rejeterPointage, corrigerPointage, validerBatch } = usePointage({ statut: 'a_verifier' })
  const { pointages: tousPointages } = usePointage({ mois: moisSel })
  const { pointages: pointagesJour }  = usePointage({ date: today })
  const { personnel } = usePersonnel()
  const { chantiers } = useChantiers()
  const usersMap     = useMemo(() => Object.fromEntries(personnel.map(p => [p.id, p])), [personnel])
  const chantiersMap = useMemo(() => Object.fromEntries(chantiers.map(c => [c.id, c])), [chantiers])
  const [typesJournee,   setTypesJournee]   = useState({})
  const [ouvrierDetail,  setOuvrierDetail]  = useState(null) // { uid, nom, pointages }

  function getType(id)        { return typesJournee[id] || 'reel' }
  function setType(id, val)   { setTypesJournee(prev => ({ ...prev, [id]: val })) }
  function getHeuresType(p, type) {
    if (type === 'journee') return 8
    if (type === 'demi')    return 4
    return p.heuresTravaillees || 0
  }
  async function validerAvecType(p) {
    const type = getType(p.id)
    const override = type === 'journee' ? 8 : type === 'demi' ? 4 : null
    const note     = type === 'journee' ? 'Journée complète' : type === 'demi' ? 'Demi-journée' : null
    await validerPointage(p.id, user.uid, override, note)
  }

  const [annee, mois] = moisSel.split('-').map(Number)
  const nbJours       = jours(annee, mois)

  const ouvrierIds = useMemo(() => [...new Set(tousPointages.map(p => p.ouvrierId))], [tousPointages])

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function validerSelectionnes() {
    await validerBatch(selected, user.uid)
    setSelected([])
  }

  const celluleColor = (statut, heures) => {
    if (!heures) return '#f3f4f6'
    if (statut === 'rejete') return '#fee2e2'
    if (heures > 8) return '#fef9c3'
    return '#dcfce7'
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '16px 20px' }}>
        <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>Pointage équipe</h1>
        <div style={{ display: 'flex', gap: 4, marginTop: 10, overflowX: 'auto' }}>
          {[['valider', 'À valider'], ['mensuel', 'Tableau mensuel'], ['realtime', 'Temps réel']].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: onglet === k ? '600' : '400', background: onglet === k ? 'rgba(255,255,255,0.2)' : 'transparent', color: onglet === k ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {l}{k === 'valider' && aVerifier.length > 0 ? ` (${aVerifier.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {onglet === 'valider' && (
          <div>
            {selected.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#e8edf8', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, color: '#0d3580', flex: 1 }}>{selected.length} sélectionné(s)</span>
                <button onClick={validerSelectionnes} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: '600', cursor: 'pointer' }}>
                  Tout valider
                </button>
              </div>
            )}
            {aVerifier.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>✓ Aucun pointage à valider</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {aVerifier.map(p => {
                    const ouvrier  = usersMap[p.ouvrierId]
                    const chantier = chantiersMap[p.chantierId]
                    const nomAff   = ouvrier ? `${ouvrier.prenom} ${ouvrier.nom}` : '—'
                    const nbTraces = p.tracesGPS?.length || 0
                    const heuresR  = p.heuresTravaillees || 0
                    const type     = getType(p.id)

                    const dateAff = new Date(p.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

                    return (
                      <div key={p.id} style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', overflow: 'hidden' }}>
                        {/* En-tête ouvrier */}
                        <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: '700', color: '#111111', margin: 0 }}>{nomAff}</p>
                            <p style={{ fontSize: 12, color: '#6b7280', margin: '1px 0 0' }}>{chantier?.nom || '—'}  ·  {dateAff}</p>
                          </div>
                          <button onClick={() => setModalData(p)} style={{ background: '#e8edf8', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#0d3580', display: 'flex', flexShrink: 0 }}>
                            <EditIcon style={{ fontSize: 15 }} />
                          </button>
                        </div>

                        {/* Récap heures + GPS */}
                        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }}>
                          {/* Heures */}
                          <div style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AccessTimeIcon style={{ fontSize: 18, color: '#0d3580', flexShrink: 0 }} />
                            <div>
                              <p style={{ fontSize: 13, fontWeight: '700', color: '#0d3580', margin: 0 }}>{formatHeures(heuresR)}</p>
                              <p style={{ fontSize: 11, color: '#6b7280', margin: '1px 0 0' }}>{p.heureDebut} → {p.heureFin}</p>
                            </div>
                          </div>
                          {/* Séparateur */}
                          <div style={{ width: 1, background: '#f3f4f6' }} />
                          {/* GPS */}
                          <div style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {nbTraces > 0
                              ? <GpsFixedIcon style={{ fontSize: 18, color: '#16a34a', flexShrink: 0 }} />
                              : <GpsOffIcon   style={{ fontSize: 18, color: '#d97706', flexShrink: 0 }} />
                            }
                            <div>
                              <p style={{ fontSize: 13, fontWeight: '700', color: nbTraces > 0 ? '#16a34a' : '#d97706', margin: 0 }}>
                                {nbTraces > 0 ? `${nbTraces} trace${nbTraces > 1 ? 's' : ''}` : 'Aucun GPS'}
                              </p>
                              <p style={{ fontSize: 11, color: '#6b7280', margin: '1px 0 0' }}>
                                {nbTraces > 0 ? 'Position capturée' : 'À vérifier manuellement'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Sélecteur type de journée */}
                        <div style={{ padding: '10px 16px', background: '#fafbff' }}>
                          <p style={{ fontSize: 10, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Compter comme</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {[
                              { k: 'journee', l: 'Journée', sub: '8h' },
                              { k: 'demi',    l: 'Demi-j.', sub: '4h' },
                              { k: 'reel',    l: 'Réel',    sub: formatHeures(heuresR) },
                            ].map(({ k, l, sub }) => (
                              <button
                                key={k}
                                onClick={() => setType(p.id, k)}
                                style={{
                                  flex: 1, padding: '6px 4px', border: `1.5px solid ${type === k ? '#0d3580' : '#e2e4ea'}`,
                                  borderRadius: 8, background: type === k ? '#0d3580' : '#fff',
                                  color: type === k ? '#fff' : '#6b7280',
                                  cursor: 'pointer', textAlign: 'center',
                                }}
                              >
                                <div style={{ fontSize: 12, fontWeight: '700' }}>{l}</div>
                                <div style={{ fontSize: 11, opacity: 0.8 }}>{sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '10px 16px', display: 'flex', gap: 8, borderTop: '1px solid #f3f4f6' }}>
                          <button
                            onClick={() => rejeterPointage(p.id, user.uid, 'Rejeté par le patron')}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}
                          >
                            <CloseIcon style={{ fontSize: 16 }} /> Rejeter
                          </button>
                          <button
                            onClick={() => validerAvecType(p)}
                            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: '700', cursor: 'pointer' }}
                          >
                            <CheckIcon style={{ fontSize: 16 }} />
                            Valider · {formatHeures(getHeuresType(p, type))}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {onglet === 'mensuel' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input type="month" value={moisSel} onChange={e => setMoisSel(e.target.value)} style={{ background: '#FFFFFF', border: '1.5px solid #0d3580', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111111', outline: 'none' }} />
              <button onClick={() => exportCSVPointages(tousPointages, {})} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '500', cursor: 'pointer' }}>
                <DownloadIcon style={{ fontSize: 16 }} />CSV
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 600, fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, width: 120, position: 'sticky', left: 0, background: '#0d3580', color: '#fff' }}>Ouvrier</th>
                    {nbJours.map(j => {
                      const dow = new Date(annee, mois - 1, j).getDay()
                      const isWE = dow === 0 || dow === 6
                      return <th key={j} style={{ ...thS, width: 32, background: isWE ? '#1a4070' : '#0d3580', color: isWE ? 'rgba(255,255,255,0.5)' : '#fff' }}>{j}</th>
                    })}
                    <th style={{ ...thS, background: '#0d3580', color: '#fff' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ouvrierIds.map(uid => {
                    const mesP    = tousPointages.filter(p => p.ouvrierId === uid)
                    const totalH  = mesP.reduce((s, p) => s + (p.heuresTravaillees || 0), 0)
                    const ouvrier = usersMap[uid]
                    const nomAff  = ouvrier ? `${ouvrier.prenom} ${ouvrier.nom}` : uid.slice(0, 8) + '…'
                    return (
                      <tr key={uid}>
                        <td
                          style={{ ...tdS, position: 'sticky', left: 0, background: '#FFFFFF', fontWeight: '500', cursor: 'pointer', color: '#0d3580', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                          onClick={() => setOuvrierDetail({ uid, nom: nomAff, pointages: mesP })}
                        >{nomAff}</td>
                        {nbJours.map(j => {
                          const date = `${moisSel}-${String(j).padStart(2, '0')}`
                          const dow  = new Date(annee, mois - 1, j).getDay()
                          const isWE = dow === 0 || dow === 6
                          const p    = mesP.find(x => x.date === date)
                          const h    = p?.heuresTravaillees || 0
                          return (
                            <td key={j} style={{ ...tdS, background: isWE ? '#f9fafb' : celluleColor(p?.statut, h), textAlign: 'center', color: isWE && h === 0 ? '#e2e4ea' : undefined }}>
                              {h > 0 ? formatHeures(h) : isWE ? '—' : ''}
                            </td>
                          )
                        })}
                        <td style={{ ...tdS, fontWeight: '700', color: '#0d3580', textAlign: 'center' }}>{formatHeures(totalH)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {onglet === 'realtime' && (
          <div>
            {/* Carte GPS Leaflet */}
            <CarteGPS pointages={pointagesJour} usersMap={usersMap} />

            {/* Liste sous la carte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>Équipe aujourd'hui · {pointagesJour.length} pointage(s)</p>
              {pointagesJour.map(p => {
                const badge    = BADGES[p.statut] || {}
                const ouvrier  = usersMap[p.ouvrierId]
                const nomAff   = ouvrier ? `${ouvrier.prenom} ${ouvrier.nom}` : p.ouvrierId.slice(0, 8) + '…'
                const lastGPS  = p.tracesGPS?.[p.tracesGPS.length - 1]
                return (
                  <div key={p.id} style={{ background: '#FFFFFF', borderRadius: 10, border: '1.5px solid #0d3580', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: p.statut === 'en_cours' ? '#16a34a' : p.statut === 'a_verifier' ? '#d97706' : '#c8d3ee' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{nomAff}</p>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                        {p.heureDebut} – {p.heureFin || 'en cours'}{p.heuresTravaillees ? ` · ${formatHeures(p.heuresTravaillees)}` : ''}
                        {lastGPS && (
                          <span style={{ marginLeft: 8, color: '#16a34a' }}>
                            <LocationOnIcon style={{ fontSize: 11, verticalAlign: 'middle' }} /> GPS {new Date(lastGPS.timestamp?.seconds ? lastGPS.timestamp.seconds * 1000 : lastGPS.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...badge }}>{formatStatut(p.statut)}</span>
                    <button onClick={() => setModalData(p)} style={{ background: '#e8edf8', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#0d3580', display: 'flex' }}>
                      <EditIcon style={{ fontSize: 16 }} />
                    </button>
                  </div>
                )
              })}
              {pointagesJour.length === 0 && (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>Aucun pointage aujourd'hui</p>
              )}
            </div>
          </div>
        )}
      </div>

      {ouvrierDetail && (
        <ModalDetailOuvrier
          nom={ouvrierDetail.nom}
          mois={moisSel}
          pointages={ouvrierDetail.pointages}
          chantiersMap={chantiersMap}
          onClose={() => setOuvrierDetail(null)}
        />
      )}

      {modalData && (
        <ModalCorrection
          pointage={modalData}
          nomOuvrier={usersMap[modalData.ouvrierId] ? `${usersMap[modalData.ouvrierId].prenom} ${usersMap[modalData.ouvrierId].nom}` : null}
          patronUid={user.uid}
          onClose={() => setModalData(null)}
          onSave={async (hD, hF, pse, note) => {
            await corrigerPointage(modalData.id, hD, hF, pse, note, user.uid)
            setModalData(null)
          }}
          onReject={async (note) => {
            await rejeterPointage(modalData.id, user.uid, note)
            setModalData(null)
          }}
        />
      )}
    </div>
  )
}

function ModalCorrection({ pointage, nomOuvrier, onClose, onSave, onReject }) {
  const [hD,         setHD]       = useState(pointage.heureDebut || '')
  const [hF,         setHF]       = useState(pointage.heureFin   || '')
  const [pse,        setPse]      = useState(pointage.pause       || 60)
  const [note,       setNote]     = useState('')
  const [noteErreur, setNoteErreur] = useState(false)
  const [saving,     setSaving]   = useState(false)
  const [gpsOpen,    setGpsOpen]  = useState(false)

  const coords    = pointage.chantierAdresse
  const hasCoords = coords?.lat && coords?.lng
  const traces    = pointage.tracesGPS || []

  function formatTrace(t) {
    const ts = t.timestamp?.seconds ? new Date(t.timestamp.seconds * 1000) : new Date(t.timestamp)
    const heure = ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const surPlace = hasCoords ? estSurChantier({ lat: t.lat, lng: t.lng }, coords) : null
    const dist = hasCoords ? Math.round(distanceMetres(t.lat, t.lng, coords.lat, coords.lng)) : null
    return { heure, surPlace, dist, type: t.type }
  }

  const lignesGPS = traces.map(formatTrace)
  const absences  = (() => {
    if (!hasCoords || lignesGPS.length < 2) return []
    const blocs = []
    let debut = null
    for (const l of lignesGPS) {
      if (!l.surPlace && !debut) debut = l.heure
      if (l.surPlace && debut)  { blocs.push({ de: debut, a: l.heure }); debut = null }
    }
    if (debut) blocs.push({ de: debut, a: '?' })
    return blocs
  })()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>Corriger le pointage</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>{nomOuvrier || pointage.ouvrierId} · {pointage.date}</p>

        {/* Résumé absences détectées */}
        {absences.length > 0 && (
          <div style={{ background: '#fff7ed', border: '1.5px solid #f97316', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: '700', color: '#c2410c', margin: '0 0 6px' }}>⚠ Absences détectées</p>
            {absences.map((a, i) => (
              <p key={i} style={{ fontSize: 13, color: '#9a3412', margin: '2px 0' }}>
                Hors chantier de <strong>{a.de}</strong> à <strong>{a.a}</strong>
              </p>
            ))}
          </div>
        )}

        {/* Timeline GPS (dépliable) */}
        {traces.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => setGpsOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f2f7', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: '600', color: '#0d3580', cursor: 'pointer', width: '100%' }}
            >
              <LocationOnIcon style={{ fontSize: 15 }} />
              Timeline GPS ({traces.length} point{traces.length > 1 ? 's' : ''})
              <span style={{ marginLeft: 'auto' }}>{gpsOpen ? '▲' : '▼'}</span>
            </button>
            {gpsOpen && (
              <div style={{ marginTop: 6, border: '1px solid #e2e4ea', borderRadius: 8, overflow: 'hidden' }}>
                {!hasCoords && (
                  <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                    Coordonnées GPS du chantier non renseignées — distances non calculables
                  </p>
                )}
                {lignesGPS.map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: i < lignesGPS.length - 1 ? '1px solid #f3f4f6' : 'none', background: hasCoords && l.surPlace === false ? '#fff7ed' : '#fff' }}>
                    <span style={{ fontSize: 12, fontWeight: '600', color: '#374151', minWidth: 40, fontVariantNumeric: 'tabular-nums' }}>{l.heure}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 52 }}>
                      {l.type === 'debut' ? 'DÉBUT' : l.type === 'fin' ? 'FIN' : '10 min'}
                    </span>
                    {hasCoords ? (
                      <span style={{ fontSize: 12, fontWeight: '600', color: l.surPlace ? '#16a34a' : '#dc2626', flex: 1 }}>
                        {l.surPlace ? '🟢 Sur chantier' : '🔴 Hors chantier'}
                        {l.dist !== null && <span style={{ fontWeight: '400', color: '#6b7280', marginLeft: 6 }}>({l.dist < 1000 ? `${l.dist}m` : `${(l.dist/1000).toFixed(1)}km`})</span>}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af', flex: 1 }}>{l.dist === null ? 'GPS capturé' : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={lblS}>Heure début</label><input type="time" value={hD} onChange={e => setHD(e.target.value)} style={{ width: '100%', ...inpS }} /></div>
          <div><label style={lblS}>Heure fin</label><input type="time" value={hF} onChange={e => setHF(e.target.value)} style={{ width: '100%', ...inpS }} /></div>
        </div>
        <div style={{ marginBottom: 10 }}><label style={lblS}>Pause (min)</label><input type="number" value={pse} onChange={e => setPse(parseInt(e.target.value) || 0)} style={{ width: '100%', ...inpS }} /></div>

        <div style={{ marginBottom: 16 }}>
          <label style={lblS}>Note <span style={{ color: '#9ca3af', fontWeight: '400', textTransform: 'none' }}>(obligatoire pour Rejeter)</span></label>
          <textarea
            value={note}
            onChange={e => { setNote(e.target.value); setNoteErreur(false) }}
            rows={2}
            placeholder="Motif de la correction ou du rejet…"
            style={{ width: '100%', boxSizing: 'border-box', ...inpS, resize: 'vertical', border: noteErreur ? '1.5px solid #dc2626' : '1.5px solid transparent' }}
          />
          {noteErreur && <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0', fontWeight: '500' }}>Une note est requise pour rejeter un pointage.</p>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={() => { if (!note.trim()) { setNoteErreur(true); return } onReject(note) }}
            style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}
          >
            Rejeter
          </button>
          <button
            onClick={async () => { setSaving(true); await onSave(hD, hF, pse, note || null); setSaving(false) }}
            disabled={saving}
            style={{ flex: 1, background: saving ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? '…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CarteGPS({ pointages, usersMap }) {
  // Collecte toutes les positions GPS (dernière trace de chaque ouvrier)
  const marqueurs = useMemo(() => {
    return pointages
      .map(p => {
        const lastGPS = p.tracesGPS?.[p.tracesGPS.length - 1]
        if (!lastGPS?.lat || !lastGPS?.lng) return null
        const ouvrier = usersMap[p.ouvrierId]
        return {
          id:    p.id,
          lat:   lastGPS.lat,
          lng:   lastGPS.lng,
          nom:   ouvrier ? `${ouvrier.prenom} ${ouvrier.nom}` : p.ouvrierId.slice(0, 8),
          statut: p.statut,
          heureDebut: p.heureDebut,
          heureFin:   p.heureFin,
        }
      })
      .filter(Boolean)
  }, [pointages, usersMap])

  const couleur = statut =>
    statut === 'en_cours'    ? '#16a34a' :
    statut === 'a_verifier'  ? '#d97706' : '#9ca3af'

  if (marqueurs.length === 0) {
    return (
      <div style={{ height: 200, background: '#F0F2F7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <LocationOnIcon style={{ fontSize: 36, color: '#c8d3ee' }} />
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Aucune position GPS disponible</p>
      </div>
    )
  }

  const centre = [
    marqueurs.reduce((s, m) => s + m.lat, 0) / marqueurs.length,
    marqueurs.reduce((s, m) => s + m.lng, 0) / marqueurs.length,
  ]

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid #0d3580', height: 260 }}>
      <MapContainer center={centre} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {marqueurs.map(m => (
          <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={10} pathOptions={{ color: couleur(m.statut), fillColor: couleur(m.statut), fillOpacity: 0.8 }}>
            <Popup>
              <div style={{ fontFamily: 'system-ui', fontSize: 13 }}>
                <strong>{m.nom}</strong><br />
                {m.heureDebut} – {m.heureFin || 'en cours'}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

function ModalDetailOuvrier({ nom, mois, pointages, chantiersMap, onClose }) {
  const sorted     = [...pointages].sort((a, b) => a.date.localeCompare(b.date))
  const totalJours = sorted.filter(p => (p.heuresTravaillees || 0) > 0).length
  const totalH     = sorted.reduce((s, p) => s + (p.heuresTravaillees || 0), 0)
  const moisLabel  = new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const statutCfg = {
    valide:     { label: 'Validé',     bg: '#dcfce7', color: '#16a34a' },
    a_verifier: { label: 'À vérifier', bg: '#fef9c3', color: '#d97706' },
    rejete:     { label: 'Rejeté',     bg: '#fee2e2', color: '#dc2626' },
    en_cours:   { label: 'En cours',   bg: '#e8edf8', color: '#0d3580' },
    termine:    { label: 'Terminé',    bg: '#f3f4f6', color: '#374151' },
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px 16px' }}
    >
      <div style={{ background: '#F7F8FA', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ background: '#0d3580', borderRadius: '20px 20px 0 0', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ color: '#fff', fontWeight: '700', fontSize: 16, margin: 0 }}>{nom}</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '2px 0 0', textTransform: 'capitalize' }}>{moisLabel}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 10px', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '14px 16px 0', flexShrink: 0 }}>
          {[
            ['Jours travaillés', totalJours],
            ['Total heures',     formatHeures(totalH)],
          ].map(([l, v]) => (
            <div key={l} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '12px 16px' }}>
              <p style={{ fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{l}</p>
              <p style={{ fontSize: 22, fontWeight: '700', color: '#0d3580', margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Liste des journées */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
          {sorted.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Aucun pointage ce mois</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(p => {
                const cfg      = statutCfg[p.statut] || { label: p.statut, bg: '#f3f4f6', color: '#374151' }
                const chantier = chantiersMap[p.chantierId]
                const dateObj  = new Date(p.date + 'T12:00:00')
                const jourSem  = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })
                const jourNum  = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                const heures   = p.heuresTravaillees || 0
                const isNuit   = p.typeHoraire === 'nuit'

                return (
                  <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e4ea', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Date */}
                    <div style={{ width: 46, textAlign: 'center', flexShrink: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', margin: 0 }}>{jourSem}</p>
                      <p style={{ fontSize: 18, fontWeight: '700', color: '#0d3580', margin: 0, lineHeight: 1.2 }}>{jourNum.split('/')[0]}</p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{jourNum.split('/')[1]}</p>
                    </div>

                    {/* Séparateur */}
                    <div style={{ width: 2, height: 44, background: heures > 0 ? '#0d3580' : '#e2e4ea', borderRadius: 2, flexShrink: 0 }} />

                    {/* Infos */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: '700', color: '#111111', margin: 0 }}>
                          {heures > 0 ? formatHeures(heures) : '—'}
                          {isNuit && <span style={{ fontSize: 11, marginLeft: 4 }}>🌙</span>}
                        </p>
                        <span style={{ fontSize: 10, fontWeight: '600', padding: '1px 6px', borderRadius: 10, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.heureDebut && p.heureFin ? `${p.heureDebut} → ${p.heureFin}` : p.heureDebut ? `Début ${p.heureDebut}` : '—'}
                        {chantier?.nom ? ` · ${chantier.nom}` : ''}
                      </p>
                    </div>

                    {/* Heures supp */}
                    {((p.heuresSupp25 || 0) + (p.heuresSupp50 || 0)) > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 10, color: '#d97706', fontWeight: '600', margin: 0 }}>+{formatHeures((p.heuresSupp25 || 0) + (p.heuresSupp50 || 0))}</p>
                        <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>supp.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const thS = { padding: '8px 6px', textAlign: 'center', fontSize: 11, fontWeight: '600', border: '1px solid rgba(255,255,255,0.2)' }
const tdS = { padding: '6px 4px', border: '1px solid #f3f4f6', fontSize: 11 }
const lblS = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }
const inpS = { background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111111', outline: 'none' }
