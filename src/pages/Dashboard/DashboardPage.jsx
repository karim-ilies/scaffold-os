import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs, where, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth }      from '../../hooks/useAuth'
import { useChantiers } from '../../hooks/useChantiers'
import { useClients }  from '../../hooks/useClients'
import { useStock }     from '../../hooks/useStock'
import { usePlanning }  from '../../hooks/usePlanning'
import { useDemandesMateriel } from '../../hooks/useDemandesMateriel'
import WarningAmberIcon  from '@mui/icons-material/WarningAmber'
import { formatEuro, formatDate, dateToString } from '../../utils/formatters'
import { estEnRetard, joursDeRetard } from '../../utils/calcFacture'
import { BADGES }        from '../../constants/theme'
import Skeleton, { SkeletonCard } from '../../components/ui/Skeleton'
import { TresorerieChart } from '../../components/ui/charts/TresorerieChart'
import { CAParClientChart } from '../../components/ui/charts/CAParClientChart'
import { useResponsive } from '../../hooks/useResponsive'
import TrendingUpIcon    from '@mui/icons-material/TrendingUp'
import WarningIcon       from '@mui/icons-material/Warning'
import ConstructionIcon  from '@mui/icons-material/Construction'
import DescriptionIcon   from '@mui/icons-material/Description'
import ChevronRightIcon  from '@mui/icons-material/ChevronRight'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import LocationOnIcon    from '@mui/icons-material/LocationOn'
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore'
import ExpandLessIcon    from '@mui/icons-material/ExpandLess'

function AnimatedAmount({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const steps = 40
    const increment = value / steps
    const stepDuration = duration / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(Math.round(start * 100) / 100)
    }, stepDuration)
    return () => clearInterval(timer)
  }, [value, duration])
  return <span>{formatEuro(display)}</span>
}

const FS = {
  xs:   'clamp(9px, 2.5vw, 11px)',
  sm:   'clamp(10px, 2.8vw, 12px)',
  base: 'clamp(11px, 3.2vw, 13px)',
  md:   'clamp(12px, 3.5vw, 14px)',
  h1:   'clamp(16px, 4.5vw, 20px)',
  kpi:  'clamp(18px, 5vw, 22px)',
}

const today   = dateToString(new Date())
const moisCur = today.slice(0, 7)
const moisPrev = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()

export default function DashboardPage() {
  const { user, role, isPatron, isComptable, isChefEquipe } = useAuth()
  const { chantiers }  = useChantiers()
  const { clients }    = useClients(isPatron || isComptable)
  const { stock }      = useStock({}, isPatron)
  const navigate       = useNavigate()

  const [factures,    setFactures]    = useState([])
  const [pointagesJ,  setPointagesJ]  = useState([])
  const [activite,    setActivite]    = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!role) return
    async function load() {
      try {
        if (isPatron || isComptable) {
          const sixMonthsAgo = new Date()
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
          const [fSnap, aSnap] = await Promise.all([
            getDocs(query(collection(db, 'factures'), where('dateEmission', '>=', Timestamp.fromDate(sixMonthsAgo)), orderBy('dateEmission', 'desc'))),
            getDocs(query(collection(db, 'factures'), orderBy('createdAt', 'desc'), limit(5))),
          ])
          setFactures(fSnap.docs.map(d => ({ id: d.id, ...d.data() })))
          setActivite(aSnap.docs.map(d => ({ id: d.id, type: 'facture', ...d.data() })))
        }
        if (isPatron || isChefEquipe) {
          const pSnap = await getDocs(query(collection(db, 'pointages'), where('date', '==', today)))
          setPointagesJ(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      } catch (e) {
        console.warn('Dashboard load:', e.code)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [role])

  const facturesCeMois = useMemo(() => factures.filter(f => {
    const d = f.dateEmission?.toDate ? f.dateEmission.toDate() : f.dateEmission ? new Date(f.dateEmission) : null
    return d && d.toISOString().slice(0, 7) === moisCur && f.statut !== 'annulee'
  }), [factures])

  const facturesMoisPrec = useMemo(() => factures.filter(f => {
    const d = f.dateEmission?.toDate ? f.dateEmission.toDate() : f.dateEmission ? new Date(f.dateEmission) : null
    return d && d.toISOString().slice(0, 7) === moisPrev && f.statut !== 'annulee'
  }), [factures])

  const caMois     = useMemo(() => facturesCeMois.reduce((s, f)  => s + (f.totalHT || 0), 0), [facturesCeMois])
  const caMoisPrec = useMemo(() => facturesMoisPrec.reduce((s, f) => s + (f.totalHT || 0), 0), [facturesMoisPrec])
  const evol       = caMoisPrec > 0 ? Math.round(((caMois - caMoisPrec) / caMoisPrec) * 100) : null

  const impayees    = useMemo(() => factures.filter(f => f.solde > 0 && f.statut !== 'annulee' && f.statut !== 'brouillon'), [factures])
  const enRetard    = useMemo(() => factures.filter(estEnRetard), [factures])
  const alertesStock = useMemo(() => stock.filter(s => s.quantiteDisponible < s.quantiteMin), [stock])

  const { isMobile } = useResponsive()
  const chantiersEnCours = chantiers.filter(c => c.statut === 'en_cours')

  const tresorerieData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('fr-FR', { month: 'short' })
      const fMois = factures.filter(f => {
        const fd = f.dateEmission?.toDate ? f.dateEmission.toDate() : f.dateEmission ? new Date(f.dateEmission) : null
        return fd && fd.toISOString().slice(0, 7) === mois && f.statut !== 'annulee'
      })
      const enc = fMois.filter(f => f.statut === 'payee' || f.statut === 'paye').reduce((s, f) => s + (f.totalTTC || 0), 0)
      const dec = fMois.reduce((s, f) => s + ((f.totalTTC || 0) - (f.solde || 0)), 0) * 0.6
      return { mois: label, encaisse: Math.round(enc), decaisse: Math.round(dec) }
    })
  }, [factures])

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients])

  const caParClientData = useMemo(() => {
    const map = {}
    factures.filter(f => f.statut !== 'annulee' && f.statut !== 'brouillon').forEach(f => {
      const nom = clientMap[f.clientId]?.nom || f.clientId?.slice(0, 8) || '—'
      map[nom] = (map[nom] || 0) + (f.totalHT || 0)
    })
    return Object.entries(map).map(([nom, ca]) => ({ nom, ca })).sort((a, b) => b.ca - a.ca).slice(0, 6)
  }, [factures, clientMap])
  const ouvrierActifs    = [...new Set(pointagesJ.filter(p => p.statut === 'en_cours').map(p => p.ouvrierId))].length

  if (loading) return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: '#0d3580', padding: '20px 24px' }}>
        <Skeleton width="200px" height="24px" borderRadius="8px" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <Skeleton width="100px" height="14px" borderRadius="6px" style={{ marginTop: 8, background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <SkeletonCard height={200} />
      </div>
    </div>
  )

  const afficherCA      = isPatron || isComptable
  const afficherFactures = isPatron || isComptable
  const afficherStock   = isPatron
  const afficherEquipe  = isPatron || isChefEquipe

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px' }}>
        <h1 style={{ fontSize: FS.h1, fontWeight: '700', color: '#fff', margin: 0 }}>
          Bonjour, {user?.prenom || user?.email?.split('@')[0] || '—'} 👋
        </h1>
        <p style={{ fontSize: FS.base, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>{today}</p>
      </div>

      <div style={{ padding: 20 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          {afficherCA && (
            <KPI
              label="CA ce mois (HT)"
              value={<AnimatedAmount value={caMois} />}
              sub={evol !== null ? `${evol > 0 ? '+' : ''}${evol}% vs mois préc.` : 'Pas de comparatif'}
              subColor={evol > 0 ? '#16a34a' : evol < 0 ? '#dc2626' : '#6b7280'}
              bg="#f0fdf4" accent="#16a34a" valueColor="#16a34a"
            />
          )}
          {afficherFactures && (
            <KPI
              label="Factures impayées"
              value={<AnimatedAmount value={impayees.reduce((s, f) => s + (f.solde || 0), 0)} />}
              sub={`${impayees.length} facture(s)`}
              subColor={impayees.length > 0 ? '#c2410c' : '#6b7280'}
              onClick={() => navigate('/factures')}
              bg="#fff1f2" accent="#dc2626" valueColor="#dc2626"
            />
          )}
          <KPI
            label="Chantiers en cours"
            value={chantiersEnCours.length}
            sub="actifs"
            onClick={() => navigate('/chantiers')}
            bg="#eff6ff" accent="#0d3580" valueColor="#0d3580"
          />
          {afficherEquipe && (
            <KPI
              label="Ouvriers actifs"
              value={ouvrierActifs}
              sub="aujourd'hui"
              bg="#f9fafb" accent="#6b7280" valueColor="#374151"
            />
          )}
        </div>

        {/* Chantiers en cours */}
        {chantiersEnCours.length > 0 && (
          <Section titre="Chantiers en cours" lienLabel="Voir tous" onLien={() => navigate('/chantiers')}>
            {chantiersEnCours.slice(0, 5).map(c => (
              <div key={c.id} onClick={() => navigate(`/chantiers/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                <div style={{ width: 32, height: 32, background: '#e8edf8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ConstructionIcon style={{ fontSize: 16, color: '#0d3580' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: 0 }}>{c.nom}</p>
                  <p style={{ fontSize: FS.xs, color: '#6b7280', margin: '1px 0 0' }}>Depuis {formatDate(c.dateDebut)}</p>
                </div>
                <ChevronRightIcon style={{ fontSize: 18, color: '#c8d3ee' }} />
              </div>
            ))}
          </Section>
        )}

        {/* Factures en retard */}
        {afficherFactures && enRetard.length > 0 && (
          <Section titre={`Factures en retard (${enRetard.length})`} lienLabel="Gérer" onLien={() => navigate('/factures')} style={{ marginTop: 14 }}>
            {enRetard.slice(0, 4).map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                <DescriptionIcon style={{ fontSize: 18, color: '#c2410c' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: 0 }}>{f.numero}</p>
                  <p style={{ fontSize: FS.xs, color: '#c2410c', margin: '1px 0 0' }}>{joursDeRetard(f)} jours de retard</p>
                </div>
                <p style={{ fontSize: FS.md, fontWeight: '600', color: '#c2410c', margin: 0 }}>{formatEuro(f.solde)}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Alertes stock */}
        {afficherStock && alertesStock.length > 0 && (
          <Section titre={`Alertes stock (${alertesStock.length})`} lienLabel="Stock" onLien={() => navigate('/stock')} style={{ marginTop: 14 }}>
            {alertesStock.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <WarningIcon style={{ fontSize: 16, color: '#c2410c' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: 0 }}>{s.nom}</p>
                  <p style={{ fontSize: FS.xs, color: '#c2410c', margin: 0 }}>Stock : {s.quantiteDisponible} / min {s.quantiteMin}</p>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Graphiques — desktop uniquement */}
        {!isMobile && afficherCA && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <TresorerieChart data={tresorerieData} />
            <CAParClientChart data={caParClientData} />
          </div>
        )}

        {/* Terrain en direct — patron et chef */}
        {afficherEquipe && (
          <TerrainLiveWidget chantiers={chantiers} style={{ marginTop: 14 }} />
        )}

        {/* Demandes matériel en attente — patron uniquement */}
        {isPatron && <DemandesWidget style={{ marginTop: 14 }} onNavigate={navigate} />}

        {/* Planning ouvrier / chef */}
        {(role === 'ouvrier' || role === 'chef_equipe') && user?.uid && (
          <MonPlanningWidget userId={user.uid} style={{ marginTop: 14 }} />
        )}
      </div>
    </div>
  )
}

function DemandesWidget({ style, onNavigate }) {
  const { demandes, loading } = useDemandesMateriel({ statut: 'nouvelle' })

  if (loading || demandes.length === 0) return null

  function formatDate(ts) {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #dc2626', padding: '14px 16px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WarningAmberIcon style={{ fontSize: 16, color: '#dc2626' }} />
        </div>
        <p style={{ fontSize: FS.base, fontWeight: '700', color: '#dc2626', margin: 0 }}>
          {demandes.length} demande(s) de matériel en attente
        </p>
      </div>

      {demandes.slice(0, 4).map(d => (
        <div
          key={d.id}
          onClick={() => onNavigate(`/chantiers/${d.chantierId}?tab=materiel`)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: 0 }}>{d.chantierNom}</p>
            <p style={{ fontSize: FS.xs, color: '#6b7280', margin: '2px 0 0' }}>
              {d.articles?.length || 0} article(s) · par {d.creeParNom}
            </p>
          </div>
          <span style={{ fontSize: FS.xs, color: '#6b7280', flexShrink: 0 }}>{formatDate(d.createdAt)}</span>
          <ChevronRightIcon style={{ fontSize: 16, color: '#c8d3ee', flexShrink: 0 }} />
        </div>
      ))}

      {demandes.length > 4 && (
        <p style={{ fontSize: FS.sm, color: '#6b7280', margin: '8px 0 0', textAlign: 'center' }}>
          + {demandes.length - 4} autre(s) demande(s)
        </p>
      )}
    </div>
  )
}

function MonPlanningWidget({ userId, style }) {
  const todayStr = dateToString(new Date())
  const nextWeek = dateToString(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000))
  const { planning, loading } = usePlanning({ ouvrierUid: userId, dateDebut: todayStr, dateFin: nextWeek })

  if (loading) return null

  const sorted = [...planning].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)', padding: '14px 16px', ...style }}>
      <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: '0 0 10px' }}>Mon planning</p>

      {sorted.length === 0 ? (
        <p style={{ fontSize: FS.base, color: '#9ca3af', textAlign: 'center', padding: '16px 0', margin: 0 }}>
          Aucune affectation prévue — contactez votre patron
        </p>
      ) : sorted.map(p => {
        const isToday = p.date === todayStr
        const dateAff = new Date(p.date + 'T12:00:00').toLocaleDateString('fr-FR', {
          weekday: 'short', day: 'numeric', month: 'short',
        })
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: isToday ? '#0d3580' : '#e8edf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarTodayIcon style={{ fontSize: 16, color: isToday ? '#fff' : '#0d3580' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: FS.base, fontWeight: '700', color: '#111111', margin: 0 }}>{p.chantierNom}</p>
              <p style={{ fontSize: FS.xs, color: '#6b7280', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <LocationOnIcon style={{ fontSize: 12 }} />{p.chantierAdresse !== '—' ? p.chantierAdresse : 'Adresse non précisée'}
              </p>
              {p.chefNom && (
                <p style={{ fontSize: FS.xs, color: '#0d3580', margin: '2px 0 0', fontWeight: '500' }}>
                  Chef : {p.chefNom}
                </p>
              )}
              {p.coequipiers && (
                <p style={{ fontSize: FS.xs, color: '#6b7280', margin: '2px 0 0' }}>
                  Avec : {p.coequipiers}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{
                fontSize: FS.xs, fontWeight: '700', padding: '3px 8px', borderRadius: 20,
                background: isToday ? '#0d3580' : '#e8edf8',
                color: isToday ? '#fff' : '#0d3580',
              }}>
                {isToday ? "Aujourd'hui" : dateAff}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function tempsEcoule(heureDebut) {
  if (!heureDebut) return ''
  const [h, m] = heureDebut.split(':').map(Number)
  const debut = new Date()
  debut.setHours(h, m, 0, 0)
  const diff = Date.now() - debut.getTime()
  if (diff < 0) return ''
  const totalMin = Math.floor(diff / 60000)
  const heures = Math.floor(totalMin / 60)
  const mins   = totalMin % 60
  return `${heures}h${mins > 0 ? String(mins).padStart(2, '0') : ''}`
}

function TerrainLiveWidget({ chantiers, style }) {
  const [actifs,   setActifs]   = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [open,     setOpen]     = useState({})

  useEffect(() => {
    const q = query(collection(db, 'pointages'), where('statut', '==', 'en_cours'))
    return onSnapshot(q, snap => {
      setActifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, () => {})
  }, [])

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setUsersMap(map)
    })
  }, [])

  const chantiersMap = useMemo(() => Object.fromEntries(chantiers.map(c => [c.id, c])), [chantiers])

  const parChantier = useMemo(() => {
    const groups = {}
    actifs.forEach(p => {
      const cid = p.chantierId || 'inconnu'
      if (!groups[cid]) groups[cid] = []
      groups[cid].push(p)
    })
    return groups
  }, [actifs])

  if (actifs.length === 0) return null

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)', padding: '14px 16px', ...style }}>
      <style>{`@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'livePulse 1.5s infinite' }} />
          <p style={{ fontSize: FS.base, fontWeight: '700', color: '#111111', margin: 0 }}>Terrain en direct</p>
        </div>
        <span style={{ fontSize: FS.xs, fontWeight: '600', background: '#e8edf8', color: '#0d3580', padding: '3px 10px', borderRadius: 20 }}>
          {actifs.length} actif{actifs.length > 1 ? 's' : ''}
        </span>
      </div>

      {Object.entries(parChantier).map(([chantierId, pts], idx, arr) => {
        const chantier = chantiersMap[chantierId]
        const isOpen   = !!open[chantierId]
        const isLast   = idx === arr.length - 1
        return (
          <div key={chantierId} style={{ borderBottom: isLast && !isOpen ? 'none' : '1px solid #f3f4f6' }}>
            <div
              onClick={() => setOpen(o => ({ ...o, [chantierId]: !o[chantierId] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer' }}
            >
              <div style={{ width: 32, height: 32, background: '#e8edf8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ConstructionIcon style={{ fontSize: 16, color: '#0d3580' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chantier?.nom || 'Chantier inconnu'}
                </p>
                <p style={{ fontSize: FS.xs, color: '#6b7280', margin: '1px 0 0' }}>
                  {pts.length} ouvrier{pts.length > 1 ? 's' : ''}
                </p>
              </div>
              <span style={{ fontSize: FS.xs, fontWeight: '600', background: '#e8edf8', color: '#0d3580', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                👷 {pts.length}
              </span>
              {isOpen
                ? <ExpandLessIcon style={{ fontSize: 18, color: '#0d3580' }} />
                : <ExpandMoreIcon style={{ fontSize: 18, color: '#0d3580' }} />
              }
            </div>

            {isOpen && (
              <div style={{ paddingBottom: 8, paddingLeft: 42 }}>
                {pts.map((p, i) => {
                  const u   = usersMap[p.ouvrierId]
                  const nom = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : '—'
                  const dur = tempsEcoule(p.heureDebut)
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < pts.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                      <p style={{ fontSize: FS.sm, fontWeight: '500', color: '#374151', margin: 0, flex: 1 }}>{nom}</p>
                      {dur && (
                        <span style={{ fontSize: FS.xs, color: '#6b7280', background: '#f3f4f6', padding: '1px 7px', borderRadius: 20 }}>
                          {dur}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KPI({ label, value, sub, subColor = '#6b7280', onClick, bg = '#FFFFFF', accent = '#0d3580', valueColor = '#0d3580' }) {
  return (
    <div onClick={onClick} style={{
      background: bg, borderRadius: 12, border: 'none',
      boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)',
      padding: '14px 16px', cursor: onClick ? 'pointer' : 'default',
      borderLeft: `4px solid ${accent}`,
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 2px 8px rgba(13,53,128,0.12), 0 8px 24px rgba(13,53,128,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)'; e.currentTarget.style.transform = 'none' } }}
    >
      <p style={{ fontSize: FS.xs, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: FS.kpi, fontWeight: '700', color: valueColor, margin: '0 0 4px', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: FS.xs, color: subColor, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>{sub}</p>
    </div>
  )
}

function Section({ titre, lienLabel, onLien, children, style }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: 'none', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)', padding: '14px 16px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: FS.base, fontWeight: '600', color: '#111111', margin: 0 }}>{titre}</p>
        {onLien && <button onClick={onLien} style={{ fontSize: FS.xs, fontWeight: '600', color: '#0d3580', background: 'transparent', border: 'none', cursor: 'pointer' }}>{lienLabel} →</button>}
      </div>
      {children}
    </div>
  )
}
