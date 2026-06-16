import { useState, useMemo } from 'react'
import { usePersonnel }  from '../../hooks/usePersonnel'
import { useChantiers }  from '../../hooks/useChantiers'
import { usePlanning }   from '../../hooks/usePlanning'
import { useEquipes }    from '../../hooks/useEquipes'
import { useResponsive } from '../../hooks/useResponsive'
import { envoyerEmailPlanning } from '../../utils/emailPlanning'
import { formatDate } from '../../utils/formatters'
import ArrowBackIosIcon   from '@mui/icons-material/ArrowBackIos'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon          from '@mui/icons-material/Close'
import EmailIcon          from '@mui/icons-material/Email'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import GroupsIcon         from '@mui/icons-material/Groups'

function getWeekDays(startDate) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMondayOf(date) {
  const d   = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

const COULEURS = ['#4f46e5', '#0d9488', '#c2410c', '#7c3aed', '#d97706', '#1d4ed8', '#16a34a']
const couleurChantier = (id) => COULEURS[parseInt(id?.slice(-2), 16) % COULEURS.length] || '#0d3580'

export default function PlanningPage() {
  const { isMobile } = useResponsive()
  const { personnel } = usePersonnel()
  const { chantiers } = useChantiers()
  const { equipes }   = useEquipes()
  const [weekStart,     setWeekStart]     = useState(getMondayOf(new Date()))
  const [modal,         setModal]         = useState(null)
  const [modalEquipe,   setModalEquipe]   = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [emailStatus,   setEmailStatus]   = useState(null)

  const days     = getWeekDays(weekStart)
  const weekEnd  = days[6]
  const actifs   = personnel.filter(o => o.actif !== false && (o.role === 'ouvrier' || o.role === 'chef_equipe'))
  const enCours  = chantiers.filter(c => c.statut === 'en_cours')

  const { planning, affecter, retirer } = usePlanning({
    dateDebut: toISO(weekStart),
    dateFin:   toISO(weekEnd),
  })

  const assignmentsMap = useMemo(() => {
    const map = {}
    planning.forEach(p => { map[`${p.ouvrierUid}_${p.date}`] = p })
    return map
  }, [planning])

  async function affecterEquipe(equipeId, chantierId, joursISO) {
    const equipe  = equipes.find(e => e.id === equipeId)
    const chantier = enCours.find(c => c.id === chantierId)
    if (!equipe || !chantier || !joursISO.length) return
    setSaving(true)

    const adresseStr = chantier.adresse
      ? `${chantier.adresse.rue || ''}, ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`.trim()
      : '—'

    const allUids = [equipe.chefUid, ...(equipe.ouvrierUids || [])]
    const memberNames = {}
    allUids.forEach(uid => {
      const p = personnel.find(x => x.id === uid)
      memberNames[uid] = p ? `${p.prenom} ${p.nom}` : ''
    })
    const chefNom = memberNames[equipe.chefUid] || '—'

    try {
      for (const uid of allUids) {
        const memPers = personnel.find(p => p.id === uid)
        if (!memPers) continue
        const coequipiersStr = allUids.filter(u => u !== uid).map(u => memberNames[u]).filter(Boolean).join(', ')
        for (const dateISO of joursISO) {
          const existingDoc = assignmentsMap[`${uid}_${dateISO}`]
          await affecter({
            ouvrierUid:      uid,
            ouvrierNom:      `${memPers.prenom} ${memPers.nom}`,
            ouvrierEmail:    memPers.email || '',
            chantierId,
            chantierNom:     chantier.nom || '—',
            chantierAdresse: adresseStr,
            date:            dateISO,
            chefNom,
            coequipiers:     coequipiersStr,
          }, existingDoc?.id || null)
        }
        if (memPers.email) {
          await envoyerEmailPlanning({
            ouvrierNom:      `${memPers.prenom} ${memPers.nom}`,
            ouvrierEmail:    memPers.email,
            chantierNom:     chantier.nom,
            chantierAdresse: adresseStr,
            dates:           joursISO,
            action:          'ajoute',
            chefNom,
            coequipiers:     coequipiersStr,
          })
        }
      }
      setEmailStatus('sent')
      setTimeout(() => setEmailStatus(null), 3000)
    } catch (e) {
      console.error('Erreur affectation équipe:', e)
    } finally {
      setSaving(false)
      setModalEquipe(false)
    }
  }

  async function assignerChantier(chantierId) {
    if (!modal) return
    setSaving(true)
    const dateISO     = toISO(modal.date)
    const existingDoc = assignmentsMap[`${modal.ouvrierI}_${dateISO}`]

    try {
      if (chantierId === null) {
        if (existingDoc) {
          await retirer(existingDoc.id)
          setEmailStatus('sending')
          const ok = await envoyerEmailPlanning({
            ouvrierNom:      modal.ouvrierNom,
            ouvrierEmail:    modal.ouvrierEmail,
            chantierNom:     existingDoc.chantierNom,
            chantierAdresse: existingDoc.chantierAdresse,
            date:            dateISO,
            action:          'retire',
          })
          setEmailStatus(ok ? 'sent' : null)
          if (ok) setTimeout(() => setEmailStatus(null), 3000)
        }
      } else {
        const chantier  = enCours.find(c => c.id === chantierId)
        const adresseStr = chantier?.adresse
          ? `${chantier.adresse.rue || ''}, ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`.trim()
          : '—'
        const data = {
          ouvrierUid:      modal.ouvrierI,
          ouvrierNom:      modal.ouvrierNom,
          ouvrierEmail:    modal.ouvrierEmail,
          chantierId,
          chantierNom:     chantier?.nom || '—',
          chantierAdresse: adresseStr,
          date:            dateISO,
        }
        const result = await affecter(data, existingDoc?.id || null)
        setEmailStatus('sending')
        const ok = await envoyerEmailPlanning({
          ouvrierNom:      modal.ouvrierNom,
          ouvrierEmail:    modal.ouvrierEmail,
          chantierNom:     chantier?.nom,
          chantierAdresse: adresseStr,
          date:            dateISO,
          action:          result.action,
        })
        setEmailStatus(ok ? 'sent' : null)
        if (ok) setTimeout(() => setEmailStatus(null), 3000)
      }
    } finally {
      setSaving(false)
      setModal(null)
    }
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Planning équipe</h1>
            {emailStatus === 'sending' && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <EmailIcon style={{ fontSize: 12 }} />Envoi email…
              </span>
            )}
            {emailStatus === 'sent' && (
              <span style={{ fontSize: 11, color: '#86efac', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <CheckCircleIcon style={{ fontSize: 12 }} />Email envoyé
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setModalEquipe(true)}
              style={{ background: '#fff', color: '#0d3580', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: '700', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <GroupsIcon style={{ fontSize: 16 }} />Équipe
            </button>
            <button onClick={prevWeek} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <ArrowBackIosIcon style={{ fontSize: 16 }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: '600', color: '#fff', whiteSpace: 'nowrap' }}>
              Sem. du {formatDate(weekStart)}
            </span>
            <button onClick={nextWeek} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <ArrowForwardIosIcon style={{ fontSize: 16 }} />
            </button>
          </div>
        </div>

        {/* Légende chantiers */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {enCours.slice(0, 6).map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleurChantier(c.id) }} />
              <span style={{ fontSize: 11, color: '#fff', fontWeight: '500' }}>{c.nom}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grille */}
      <div style={{ overflowX: 'auto', padding: '16px 0' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: isMobile ? 600 : '100%', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', width: 130, background: '#fff', position: 'sticky', left: 0, zIndex: 2, borderBottom: '1.5px solid #e2e4ea' }}>
                Équipe
              </th>
              {days.map((d, i) => {
                const isToday = toISO(d) === toISO(new Date())
                return (
                  <th key={i} style={{ padding: '8px 6px', textAlign: 'center', background: isToday ? '#e8edf8' : '#fff', borderBottom: '1.5px solid #e2e4ea', minWidth: 80 }}>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: 0, fontWeight: '600', textTransform: 'uppercase' }}>{DAYS_FR[i]}</p>
                    <p style={{ fontSize: 13, fontWeight: isToday ? '700' : '500', color: isToday ? '#0d3580' : '#111111', margin: '2px 0 0' }}>{d.getDate()}</p>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {actifs.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Aucun ouvrier actif</td></tr>
            ) : actifs.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px 14px', background: '#fff', position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #e2e4ea' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: '700', color: '#0d3580', flexShrink: 0 }}>
                      {o.prenom?.[0]}{o.nom?.[0]}
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: '600', color: '#111111', margin: 0, whiteSpace: 'nowrap' }}>{o.prenom} {o.nom?.[0]}.</p>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{o.role === 'chef_equipe' ? 'Chef' : 'Ouvrier'}</p>
                    </div>
                  </div>
                </td>
                {days.map((d, i) => {
                  const dateISO  = toISO(d)
                  const aff      = assignmentsMap[`${o.id}_${dateISO}`]
                  const chant    = aff ? enCours.find(c => c.id === aff.chantierId) : null
                  const isWE     = i >= 5
                  return (
                    <td
                      key={i}
                      onClick={() => !isWE && setModal({ ouvrierI: o.id, date: d, ouvrierNom: `${o.prenom} ${o.nom}`, ouvrierEmail: o.email || '' })}
                      style={{ padding: 4, textAlign: 'center', background: isWE ? '#f9fafb' : '#fff', cursor: isWE ? 'default' : 'pointer', verticalAlign: 'top' }}
                    >
                      {aff ? (
                        <div
                          style={{ background: couleurChantier(aff.chantierId), borderRadius: 6, padding: '4px 6px', minHeight: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}
                          title={aff.chantierNom}
                        >
                          <span style={{ fontSize: 10, color: '#fff', fontWeight: '700', lineHeight: 1.2, textAlign: 'center' }}>{aff.chantierNom.slice(0, 14)}</span>
                        </div>
                      ) : (
                        !isWE && (
                          <div style={{ border: '1.5px dashed #e2e4ea', borderRadius: 6, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8d3ee', fontSize: 18 }}>+</div>
                        )
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Résumé équipes par chantier */}
      {enCours.length > 0 && (
        <div style={{ padding: '0 16px 24px' }}>
          <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Équipes cette semaine</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {enCours.map(c => {
              const affectations = planning.filter(p => p.chantierId === c.id)
              const ouvriersSemaineIds = [...new Set(affectations.map(p => p.ouvrierUid))]
              if (ouvriersSemaineIds.length === 0) return null
              return (
                <div key={c.id} style={{ background: '#fff', borderRadius: 10, border: '1.5px solid #e2e4ea', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleurChantier(c.id), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{c.nom}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>
                      {ouvriersSemaineIds.map(uid => {
                        const o = actifs.find(a => a.id === uid)
                        return o ? `${o.prenom} ${o.nom}` : null
                      }).filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: '600', color: '#0d3580' }}>{ouvriersSemaineIds.length} pers.</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal affecter une équipe */}
      {modalEquipe && (
        <ModalAffectationEquipe
          equipes={equipes}
          chantiers={enCours}
          days={days}
          saving={saving}
          onClose={() => setModalEquipe(false)}
          onSave={affecterEquipe}
        />
      )}

      {/* Modal assignation individuelle */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }} style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: '700', color: '#111111', margin: 0 }}>{modal.ouvrierNom}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                  {modal.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {!modal.ouvrierEmail && (
                  <p style={{ fontSize: 11, color: '#d97706', margin: '4px 0 0' }}>⚠ Pas d'email — notification non envoyée</p>
                )}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {assignmentsMap[`${modal.ouvrierI}_${toISO(modal.date)}`] && (
                <button
                  onClick={() => !saving && assignerChantier(null)}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#dc2626', fontWeight: '600' }}
                >
                  Retirer l'affectation
                </button>
              )}
              {enCours.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucun chantier en cours</p>
              )}
              {enCours.map(c => {
                const isCurrentChantier = assignmentsMap[`${modal.ouvrierI}_${toISO(modal.date)}`]?.chantierId === c.id
                // Compte d'autres ouvriers déjà sur ce chantier ce jour
                const nbSurCeChantier = planning.filter(p => p.chantierId === c.id && p.date === toISO(modal.date)).length
                return (
                  <button
                    key={c.id}
                    onClick={() => !saving && assignerChantier(c.id)}
                    disabled={saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: isCurrentChantier ? '#e8edf8' : '#f3f4f6',
                      border: isCurrentChantier ? '1.5px solid #0d3580' : '1.5px solid transparent',
                      borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleurChantier(c.id), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{c.nom}</p>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                        {c.adresse?.ville || ''}
                        {nbSurCeChantier > 0 ? ` · ${nbSurCeChantier} déjà affecté(s)` : ''}
                      </p>
                    </div>
                    {isCurrentChantier && <span style={{ fontSize: 10, fontWeight: '700', color: '#0d3580' }}>✓</span>}
                  </button>
                )
              })}
            </div>

            {saving && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', margin: '12px 0 0' }}>Sauvegarde + envoi email…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ModalAffectationEquipe({ equipes, chantiers, days, saving, onClose, onSave }) {
  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const [equipeId,   setEquipeId]   = useState('')
  const [chantierId, setChantierId] = useState('')
  const [joursISO,   setJoursISO]   = useState(
    days.slice(0, 5).map(d => {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), j = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${j}`
    })
  )

  function toISO(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), j = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${j}`
  }

  function toggleJour(iso) {
    setJoursISO(prev => prev.includes(iso) ? prev.filter(x => x !== iso) : [...prev, iso])
  }

  const equipe = equipes.find(e => e.id === equipeId)
  const nbMembres = equipe ? 1 + (equipe.ouvrierUids?.length || 0) : 0

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: '700', color: '#111111', margin: 0 }}>Affecter une équipe</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Équipe</label>
            <select value={equipeId} onChange={e => setEquipeId(e.target.value)} style={{ width: '100%', ...inp }}>
              <option value="">— Choisir une équipe —</option>
              {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
            </select>
            {equipeId && <p style={{ fontSize: 11, color: '#0d3580', margin: '4px 0 0', fontWeight: '600' }}>{nbMembres} membre(s) seront affecté(s)</p>}
            {equipes.length === 0 && <p style={{ fontSize: 11, color: '#d97706', margin: '4px 0 0' }}>⚠ Aucune équipe — créez-en une dans la page Équipes</p>}
          </div>

          <div>
            <label style={lbl}>Chantier</label>
            <select value={chantierId} onChange={e => setChantierId(e.target.value)} style={{ width: '100%', ...inp }}>
              <option value="">— Choisir un chantier —</option>
              {chantiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Jours</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {days.slice(0, 7).map((d, i) => {
                const iso  = toISO(d)
                const sel  = joursISO.includes(iso)
                const isWE = i >= 5
                return (
                  <button
                    key={i}
                    onClick={() => !isWE && toggleJour(iso)}
                    disabled={isWE}
                    style={{
                      flex: 1, border: 'none', borderRadius: 8, padding: '8px 4px',
                      background: isWE ? '#f9fafb' : sel ? '#0d3580' : '#f0f2f7',
                      color:      isWE ? '#d1d5db' : sel ? '#fff' : '#111111',
                      cursor:     isWE ? 'default' : 'pointer',
                      fontSize: 11, fontWeight: '600',
                    }}
                  >
                    <div>{DAYS_FR[i]}</div>
                    <div style={{ fontSize: 10, fontWeight: '400', marginTop: 2 }}>{d.getDate()}</div>
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>{joursISO.length} jour(s) sélectionné(s)</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={() => !saving && onSave(equipeId, chantierId, joursISO)}
            disabled={saving || !equipeId || !chantierId || joursISO.length === 0}
            style={{
              flex: 2, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12,
              fontSize: 13, fontWeight: '700', cursor: 'pointer',
              opacity: (!equipeId || !chantierId || joursISO.length === 0) ? 0.5 : 1,
            }}
          >
            {saving ? 'Affectation…' : `Affecter (${nbMembres} × ${joursISO.length} j)`}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }
const inp = { background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111111', outline: 'none', boxSizing: 'border-box' }
