import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { STORAGE_ENABLED } from '../../firebase/config'
import { useAuth }         from '../../hooks/useAuth'
import { usePointage }     from '../../hooks/usePointage'
import { useChantiers }    from '../../hooks/useChantiers'
import { usePlanning }     from '../../hooks/usePlanning'
import CalendarTodayIcon   from '@mui/icons-material/CalendarToday'
import ConstructionIcon    from '@mui/icons-material/Construction'
import PersonIcon          from '@mui/icons-material/Person'
import GroupIcon           from '@mui/icons-material/Group'
import CloseIcon           from '@mui/icons-material/Close'
import { getCurrentPosition, demarrerTraceGPS } from '../../utils/gps'
import { sauvegarderOffline, syncPendingPointages, getPendingPointages } from '../../utils/offlineSync'
import { formatHeures, formatDate, formatStatut, dateToString } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import AccessTimeIcon  from '@mui/icons-material/AccessTime'
import LocationOnIcon  from '@mui/icons-material/LocationOn'
import LocationOffIcon from '@mui/icons-material/LocationOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WifiOffIcon     from '@mui/icons-material/WifiOff'
import AddAPhotoIcon   from '@mui/icons-material/AddAPhoto'
import GpsOffIcon      from '@mui/icons-material/GpsOff'

function heureActuelle() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

export default function PointageOuvrierPage() {
  const today = dateToString(new Date())
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pointages, loading, creerPointage, terminerPointage } = usePointage({
    ouvrierId: user?.uid, date: today,
  })
  const { chantiers } = useChantiers()
  const [onglet, setOnglet] = useState('jour')
  const [moisSel, setMoisSel] = useState(today.slice(0, 7))
  const { pointages: mesHeures } = usePointage({ ouvrierId: user?.uid, mois: moisSel })

  const pointageAujourdhui = pointages.find(p => p.ouvrierId === user?.uid && p.date === today)
  const enCours = pointageAujourdhui?.statut === 'en_cours'

  // Planning semaine
  const lundi = (() => {
    const d = new Date()
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
    return d
  })()
  const dateDebut = dateToString(lundi)
  const dateFin   = dateToString(new Date(lundi.getTime() + 5 * 86400000))
  const { planning: maSemaine, loading: planLoading } = usePlanning({ ouvrierUid: user?.uid, dateDebut, dateFin })

  const [chantierId, setChantierId] = useState('')
  const [heureDebut, setHeureDebut] = useState(heureActuelle())
  const [heureFin,   setHeureFin]   = useState(heureActuelle())
  const [pause,      setPause]      = useState(60)
  const [gpsInfo,    setGpsInfo]    = useState(null)
  const [tracesGPS,  setTracesGPS]  = useState([])
  const [chrono,     setChrono]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [erreur,     setErreur]     = useState(null)
  const [isOffline,  setIsOffline]  = useState(!navigator.onLine)
  const [planDetail, setPlanDetail] = useState(null)
  const [pendingCount, setPendingCount] = useState(getPendingPointages().length)
  const intervalRef = useRef(null)
  const traceRef    = useRef(null)

  useEffect(() => {
    const handleOnline  = () => { setIsOffline(false); syncPendingPointages().then(n => n && setPendingCount(0)) }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  useEffect(() => {
    if (!enCours) return
    intervalRef.current = setInterval(() => {
      const debut = pointageAujourdhui?.heureDebut
      if (!debut) return
      const [dH, dM] = debut.split(':').map(Number)
      const now = new Date()
      const diffMin = (now.getHours() * 60 + now.getMinutes()) - (dH * 60 + dM)
      const h = Math.floor(diffMin / 60)
      const m = diffMin % 60
      setChrono(`${h}h${String(m).padStart(2, '0')}`)
      setHeureFin(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    }, 30000)
    return () => clearInterval(intervalRef.current)
  }, [enCours, pointageAujourdhui])

  async function demarrer() {
    setSaving(true)
    try {
      const pos = await getCurrentPosition()
      if (pos) setGpsInfo(pos)
      const chantier = chantiers.find(c => c.id === chantierId)
      const traces = pos ? [{ ...pos, timestamp: new Date(), type: 'debut' }] : []
      const data = {
        ouvrierId: user.uid, chantierId, date: today, heureDebut, heureFin: null, pause,
        chantierAdresse: chantier?.adresse || {},
        typeHoraire: chantier?.typeHoraire || 'jour',
        tracesGPS: traces,
      }
      if (isOffline) {
        sauvegarderOffline(data)
        setPendingCount(getPendingPointages().length)
      } else {
        await creerPointage(data)
      }
      traceRef.current = demarrerTraceGPS(chantierId, null, (trace) => setTracesGPS(prev => [...prev, trace]))
    } finally {
      setSaving(false)
    }
  }

  async function terminer() {
    if (!pointageAujourdhui) return
    setSaving(true)
    setErreur(null)
    clearInterval(traceRef.current)
    try {
      const pos = await getCurrentPosition()
      const toutesTraces = [...tracesGPS, ...(pos ? [{ ...pos, timestamp: new Date(), type: 'fin' }] : [])]
      const chantier = chantiers.find(c => c.id === pointageAujourdhui.chantierId)
      await terminerPointage(pointageAujourdhui.id, heureFin, pause, toutesTraces, chantier?.adresse || {})
    } catch (e) {
      setErreur('Erreur lors de la sauvegarde. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  const chantierActif = chantiers.find(c => c.id === pointageAujourdhui?.chantierId)

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>Mon pointage</h1>
          {isOffline
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: '600', background: '#ffedd5', color: '#c2410c', padding: '3px 10px', borderRadius: 20 }}><WifiOffIcon style={{ fontSize: 14 }} />Hors ligne{pendingCount > 0 ? ` (${pendingCount})` : ''}</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: '600', background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: 20 }}>Connecté</span>
          }
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {[['jour', 'Aujourd\'hui'], ['heures', 'Mes heures']].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: onglet === k ? '600' : '400', background: onglet === k ? 'rgba(255,255,255,0.2)' : 'transparent', color: onglet === k ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Bandeau GPS désactivé */}
      {user?.gpsAutorise === false && (
        <div style={{ background: '#fff7ed', borderBottom: '1.5px solid #f97316', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <GpsOffIcon style={{ fontSize: 22, color: '#c2410c', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: '700', color: '#c2410c', margin: 0 }}>Localisation GPS désactivée</p>
            <p style={{ fontSize: 12, color: '#9a3412', margin: '2px 0 0' }}>
              Votre présence sur le chantier ne peut pas être vérifiée automatiquement.
            </p>
          </div>
          <button
            onClick={() => navigate('/permission-gps')}
            style={{ background: '#c2410c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Activer le GPS
          </button>
        </div>
      )}

      <div style={{ padding: 20 }}>
        {onglet === 'jour' && (
          <>
            {!pointageAujourdhui || pointageAujourdhui.statut === 'en_cours' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {enCours ? (
                  // Pointage en cours
                  <>
                    <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #0d3580', padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 48, fontWeight: '700', color: '#0d3580', marginBottom: 4 }}>{chrono || '…'}</div>
                      <p style={{ fontSize: 15, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>En cours sur {chantierActif?.nom || '—'}</p>
                      {gpsInfo
                        ? <p style={{ fontSize: 12, color: '#16a34a', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><LocationOnIcon style={{ fontSize: 14 }} />Position enregistrée</p>
                        : <p style={{ fontSize: 12, color: '#d97706', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><LocationOffIcon style={{ fontSize: 14 }} />GPS non disponible</p>
                      }
                    </div>
                    {STORAGE_ENABLED && chantierActif && (
                      <button
                        onClick={() => navigate(`/chantiers/${pointageAujourdhui.chantierId}?tab=photos`)}
                        style={{
                          width: '100%', minHeight: 48, border: '1.5px solid #0d3580',
                          borderRadius: 14, background: '#fff', color: '#0d3580',
                          fontSize: 15, fontWeight: '600', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                      >
                        <AddAPhotoIcon style={{ fontSize: 20 }} />
                        Photos du chantier
                      </button>
                    )}
                  </>
                ) : (
                  // Démarrer
                  <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #0d3580', padding: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>Démarrer ma journée</p>
                    <div style={{ marginBottom: 12 }}>
                      <label style={lblS}>Chantier</label>
                      <select value={chantierId} onChange={e => setChantierId(e.target.value)} style={{ width: '100%', ...inpS }}>
                        <option value="">— Choisir un chantier —</option>
                        {chantiers.filter(c => c.statut === 'en_cours').map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={lblS}>Heure de début</label>
                      <input type="time" value={heureDebut} onChange={e => setHeureDebut(e.target.value)} style={{ width: '100%', ...inpS }} />
                    </div>
                  </div>
                )}

                {enCours && (
                  <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #0d3580', padding: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>Terminer ma journée</p>
                    <div style={{ marginBottom: 12 }}>
                      <label style={lblS}>Heure de fin</label>
                      <input type="time" value={heureFin} onChange={e => setHeureFin(e.target.value)} style={{ width: '100%', ...inpS }} />
                    </div>
                    <div>
                      <label style={lblS}>Pause (minutes)</label>
                      <input type="number" value={pause} onChange={e => setPause(parseInt(e.target.value) || 0)} min={0} step={15} style={{ width: '100%', ...inpS }} />
                    </div>
                  </div>
                )}

                {erreur && (
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', textAlign: 'center' }}>
                    {erreur}
                  </div>
                )}
                <button
                  onClick={enCours ? terminer : demarrer}
                  disabled={saving || (!enCours && !chantierId)}
                  style={{
                    width: '100%', minHeight: 56, border: 'none', borderRadius: 14,
                    background: enCours ? '#dc2626' : '#16a34a',
                    color: '#fff', fontSize: 17, fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <AccessTimeIcon style={{ fontSize: 24 }} />
                  {saving ? 'En cours…' : enCours ? 'Terminer ma journée' : 'Démarrer ma journée'}
                </button>
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #16a34a', padding: 20, textAlign: 'center' }}>
                <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 8 }} />
                <p style={{ fontSize: 16, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>Journée terminée</p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{formatHeures(pointageAujourdhui.heuresTravaillees)} — {formatStatut(pointageAujourdhui.statut)}</p>
              </div>
            )}

            {/* Widget planning semaine */}
            {!planLoading && maSemaine.length > 0 && (
              <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #0d3580', padding: '14px 16px', marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <CalendarTodayIcon style={{ fontSize: 16, color: '#0d3580' }} />
                  <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Mon planning semaine</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                  {Array.from({ length: 6 }, (_, i) => {
                    const d = new Date(lundi.getTime() + i * 86400000)
                    const iso = dateToString(d)
                    const aff = maSemaine.find(p => p.date === iso)
                    const isToday = iso === today
                    const isSelected = planDetail?.date === iso
                    const jourLabel = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
                    const jourNum   = d.getDate()
                    return (
                      <div key={i}
                        onClick={() => aff && setPlanDetail(isSelected ? null : { ...aff, dateObj: d })}
                        style={{
                          borderRadius: 8, padding: '6px 4px', textAlign: 'center',
                          background: isToday ? '#0d3580' : aff ? '#e8edf8' : '#f9fafb',
                          border: isSelected ? '2px solid #E8A838' : isToday ? 'none' : '1px solid #e2e4ea',
                          cursor: aff ? 'pointer' : 'default',
                          transition: 'transform 0.1s',
                          transform: isSelected ? 'scale(1.05)' : 'none',
                        }}>
                        <p style={{ fontSize: 9, fontWeight: '600', color: isToday ? 'rgba(255,255,255,0.7)' : '#9ca3af', margin: 0, textTransform: 'capitalize' }}>{jourLabel}</p>
                        <p style={{ fontSize: 14, fontWeight: '700', color: isToday ? '#fff' : '#111111', margin: '2px 0' }}>{jourNum}</p>
                        {aff ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            <ConstructionIcon style={{ fontSize: 9, color: isToday ? '#E8A838' : '#0d3580' }} />
                            <p style={{ fontSize: 8, fontWeight: '600', color: isToday ? '#E8A838' : '#0d3580', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 50 }}>
                              {aff.chantierNom}
                            </p>
                          </div>
                        ) : (
                          <p style={{ fontSize: 8, color: isToday ? 'rgba(255,255,255,0.4)' : '#d1d5db', margin: 0 }}>—</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Détail jour sélectionné */}
                {planDetail && (
                  <div style={{ marginTop: 10, background: '#f8faff', borderRadius: 10, border: '1px solid #c8d3ee', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: '700', color: '#0d3580', margin: 0, textTransform: 'capitalize' }}>
                        {planDetail.dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <button onClick={() => setPlanDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                        <CloseIcon style={{ fontSize: 16, color: '#9ca3af' }} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <ConstructionIcon style={{ fontSize: 18, color: '#0d3580', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>{planDetail.chantierNom}</p>
                      </div>
                    </div>

                    {planDetail.chantierAdresse && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <LocationOnIcon style={{ fontSize: 16, color: '#6b7280', flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.4 }}>{planDetail.chantierAdresse}</p>
                      </div>
                    )}

                    {planDetail.chefNom && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <PersonIcon style={{ fontSize: 16, color: '#6b7280', flexShrink: 0 }} />
                        <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>Chef : <strong>{planDetail.chefNom}</strong></p>
                      </div>
                    )}

                    {planDetail.coequipiers && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <GroupIcon style={{ fontSize: 16, color: '#6b7280', flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.4 }}>Coéquipiers : {planDetail.coequipiers}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {onglet === 'heures' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <input type="month" value={moisSel} onChange={e => setMoisSel(e.target.value)} style={{ background: '#FFFFFF', border: '1.5px solid #0d3580', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111111', outline: 'none' }} />
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: 16, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Récapitulatif</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontStyle: 'italic' }}>Les heures sont validées par le patron.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mesHeures.map(p => {
                const badge = BADGES[p.statut] || {}
                return (
                  <div key={p.id} style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid #e2e4ea', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: '500', color: '#111111', margin: 0 }}>{p.date}</p>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{p.heureDebut} – {p.heureFin || '…'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 15, fontWeight: '600', color: '#0d3580', margin: 0 }}>{formatHeures(p.heuresTravaillees)}</p>
                      <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...badge }}>{formatStatut(p.statut)}</span>
                    </div>
                  </div>
                )
              })}
              {mesHeures.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>Aucun pointage ce mois-ci</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const lblS = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }
const inpS = { background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '10px 12px', fontSize: 15, color: '#111111', outline: 'none', boxSizing: 'border-box' }
