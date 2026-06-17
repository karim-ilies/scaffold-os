import React, { useState, useMemo, useRef } from 'react'
import { usePersonnel }  from '../../hooks/usePersonnel'
import { useChantiers }  from '../../hooks/useChantiers'
import { usePlanning }   from '../../hooks/usePlanning'
import { useEquipes }    from '../../hooks/useEquipes'
import { useResponsive } from '../../hooks/useResponsive'
import { envoyerEmailPlanning } from '../../utils/emailPlanning'
import { formatDate } from '../../utils/formatters'
import ArrowBackIosIcon    from '@mui/icons-material/ArrowBackIos'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon           from '@mui/icons-material/Close'
import GroupsIcon          from '@mui/icons-material/Groups'
import AddIcon             from '@mui/icons-material/Add'
import ConstructionIcon    from '@mui/icons-material/Construction'
import EmailIcon           from '@mui/icons-material/Email'
import CheckCircleIcon     from '@mui/icons-material/CheckCircle'

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

const COULEURS = ['#4f46e5', '#0d9488', '#c2410c', '#7c3aed', '#d97706', '#1d4ed8', '#16a34a']
const couleurChantier = (id) => COULEURS[parseInt(id?.slice(-2), 16) % COULEURS.length] || '#0d3580'

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function PlanningPage() {
  const { isMobile }   = useResponsive()
  const { personnel }  = usePersonnel()
  const { chantiers }  = useChantiers()
  const { equipes }    = useEquipes()
  const [weekStart,   setWeekStart]   = useState(getMondayOf(new Date()))
  const [modalEquipe, setModalEquipe] = useState(false)
  const [picker,      setPicker]      = useState(null)
  const [addModal,    setAddModal]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [emailStatus, setEmailStatus] = useState(null)
  const dragRef = useRef(null)

  const days    = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })
  const actifs  = personnel.filter(o => o.actif !== false && (o.role === 'ouvrier' || o.role === 'chef_equipe'))
  const enCours = chantiers.filter(c => c.statut === 'en_cours')

  const { planning, affecter, retirer } = usePlanning({
    dateDebut: toISO(weekStart),
    dateFin:   toISO(days[6]),
  })

  const dayData = useMemo(() => {
    return days.slice(0, 6).map((d, i) => {
      const iso = toISO(d)
      const dayPlanning = planning.filter(p => p.date === iso)
      const groups = {}
      dayPlanning.forEach(p => {
        if (!groups[p.chantierId]) groups[p.chantierId] = []
        groups[p.chantierId].push(p)
      })
      const assignedUids = new Set(dayPlanning.map(p => p.ouvrierUid))
      const disponibles = actifs.filter(a => !assignedUids.has(a.id))
      return { date: d, iso, isToday: iso === toISO(new Date()), groups, disponibles, dayIndex: i }
    })
  }, [days, planning, actifs])

  function getOuvrierInfo(uid) {
    return actifs.find(a => a.id === uid) || personnel.find(p => p.id === uid)
  }

  function adresseStr(chantier) {
    return chantier?.adresse ? `${chantier.adresse.rue || ''}, ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`.trim() : '—'
  }

  async function handleAffecter(ouvrierUid, chantierId, dateISO) {
    const ouvrier  = getOuvrierInfo(ouvrierUid)
    const chantier = enCours.find(c => c.id === chantierId)
    if (!ouvrier || !chantier) return

    setSaving(true)
    try {
      const existing = planning.find(p => p.ouvrierUid === ouvrierUid && p.date === dateISO)
      const data = {
        ouvrierUid,
        ouvrierNom:      `${ouvrier.prenom} ${ouvrier.nom}`,
        ouvrierEmail:    ouvrier.email || '',
        chantierId,
        chantierNom:     chantier.nom || '—',
        chantierAdresse: adresseStr(chantier),
        date:            dateISO,
      }
      const result = await affecter(data, existing?.id || null)

      if (ouvrier.email) {
        envoyerEmailPlanning({
          ouvrierNom: data.ouvrierNom, ouvrierEmail: ouvrier.email,
          chantierNom: chantier.nom, chantierAdresse: data.chantierAdresse,
          date: dateISO, action: result.action,
        })
      }
    } finally {
      setSaving(false)
      setPicker(null)
    }
  }

  async function handleRetirer(planningEntry) {
    setSaving(true)
    try {
      await retirer(planningEntry.id)
      const ouvrier = getOuvrierInfo(planningEntry.ouvrierUid)
      if (ouvrier?.email) {
        envoyerEmailPlanning({
          ouvrierNom: planningEntry.ouvrierNom, ouvrierEmail: ouvrier.email,
          chantierNom: planningEntry.chantierNom, chantierAdresse: planningEntry.chantierAdresse,
          date: planningEntry.date, action: 'retire',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRetirerChantierJour(chantierId, dateISO) {
    const entries = planning.filter(p => p.chantierId === chantierId && p.date === dateISO)
    if (entries.length === 0) return
    setSaving(true)
    try {
      for (const entry of entries) {
        await retirer(entry.id)
        const ouvrier = getOuvrierInfo(entry.ouvrierUid)
        if (ouvrier?.email) {
          envoyerEmailPlanning({
            ouvrierNom: entry.ouvrierNom, ouvrierEmail: ouvrier.email,
            chantierNom: entry.chantierNom, chantierAdresse: entry.chantierAdresse,
            date: dateISO, action: 'retire',
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  function handleDragStartCard(chantierId, sourceDateISO) {
    dragRef.current = { type: 'card', chantierId, sourceDateISO }
  }

  async function handleDropOnDay(targetDateISO) {
    if (!dragRef.current) return
    const drag = dragRef.current
    dragRef.current = null

    if (drag.type === 'card') {
      const entries = planning.filter(p => p.chantierId === drag.chantierId && p.date === drag.sourceDateISO)
      if (entries.length === 0 || drag.sourceDateISO === targetDateISO) return
      setSaving(true)
      try {
        for (const entry of entries) {
          const existing = planning.find(p => p.ouvrierUid === entry.ouvrierUid && p.date === targetDateISO)
          await affecter({
            ouvrierUid: entry.ouvrierUid, ouvrierNom: entry.ouvrierNom, ouvrierEmail: entry.ouvrierEmail || '',
            chantierId: entry.chantierId, chantierNom: entry.chantierNom, chantierAdresse: entry.chantierAdresse || '',
            date: targetDateISO, chefNom: entry.chefNom || '', coequipiers: entry.coequipiers || '',
          }, existing?.id || null)
          const ouvrier = getOuvrierInfo(entry.ouvrierUid)
          if (ouvrier?.email) {
            envoyerEmailPlanning({
              ouvrierNom: entry.ouvrierNom, ouvrierEmail: ouvrier.email,
              chantierNom: entry.chantierNom, chantierAdresse: entry.chantierAdresse,
              date: targetDateISO, action: 'ajoute',
            })
          }
        }
        setEmailStatus('sent')
        setTimeout(() => setEmailStatus(null), 3000)
      } finally {
        setSaving(false)
      }
    }
  }

  async function handleAjoutChantierJour(chantierId, ouvrierUids, dateISO) {
    setSaving(true)
    try {
      for (const uid of ouvrierUids) {
        await handleAffecter(uid, chantierId, dateISO)
      }
    } finally {
      setSaving(false)
      setAddModal(null)
    }
  }

  function handleDragStart(ouvrierUid, sourceDateISO, sourceChantierId) {
    dragRef.current = { type: 'worker', ouvrierUid, sourceDateISO, sourceChantierId }
  }

  function handleDrop(targetChantierId, targetDateISO) {
    if (!dragRef.current) return
    const drag = dragRef.current
    dragRef.current = null

    if (drag.type === 'card') {
      const entries = planning.filter(p => p.chantierId === drag.chantierId && p.date === drag.sourceDateISO)
      if (entries.length === 0) return
      entries.forEach(entry => {
        handleAffecter(entry.ouvrierUid, targetChantierId, targetDateISO)
      })
      return
    }

    if (drag.sourceChantierId === targetChantierId && drag.sourceDateISO === targetDateISO) return
    if (drag.sourceChantierId && drag.sourceDateISO) {
      const entry = planning.find(p => p.ouvrierUid === drag.ouvrierUid && p.date === drag.sourceDateISO && p.chantierId === drag.sourceChantierId)
      if (entry) retirer(entry.id)
    }
    handleAffecter(drag.ouvrierUid, targetChantierId, targetDateISO)
  }

  async function affecterEquipe(equipeId, chantierId, joursISO) {
    const equipe   = equipes.find(e => e.id === equipeId)
    const chantier = enCours.find(c => c.id === chantierId)
    if (!equipe || !chantier || !joursISO.length) return
    setSaving(true)

    const addr    = adresseStr(chantier)
    const allUids = [equipe.chefUid, ...(equipe.ouvrierUids || [])]
    const names   = {}
    allUids.forEach(uid => { const p = personnel.find(x => x.id === uid); names[uid] = p ? `${p.prenom} ${p.nom}` : '' })
    const chefNom = names[equipe.chefUid] || '—'

    try {
      for (const uid of allUids) {
        const mem = personnel.find(p => p.id === uid)
        if (!mem) continue
        const coeq = allUids.filter(u => u !== uid).map(u => names[u]).filter(Boolean).join(', ')
        for (const dateISO of joursISO) {
          const existing = planning.find(p => p.ouvrierUid === uid && p.date === dateISO)
          await affecter({
            ouvrierUid: uid, ouvrierNom: `${mem.prenom} ${mem.nom}`, ouvrierEmail: mem.email || '',
            chantierId, chantierNom: chantier.nom || '—', chantierAdresse: addr,
            date: dateISO, chefNom, coequipiers: coeq,
          }, existing?.id || null)
        }
        if (mem.email) {
          envoyerEmailPlanning({
            ouvrierNom: `${mem.prenom} ${mem.nom}`, ouvrierEmail: mem.email,
            chantierNom: chantier.nom, chantierAdresse: addr,
            dates: joursISO, action: 'ajoute', chefNom, coequipiers: allUids.filter(u => u !== uid).map(u => names[u]).filter(Boolean).join(', '),
          })
        }
      }
      setEmailStatus('sent')
      setTimeout(() => setEmailStatus(null), 3000)
    } finally {
      setSaving(false)
      setModalEquipe(false)
    }
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Planning équipe</h1>
            {emailStatus === 'sent' && (
              <span style={{ fontSize: 11, color: '#86efac', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <CheckCircleIcon style={{ fontSize: 12 }} />Emails envoyés
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setModalEquipe(true)} style={{ background: '#fff', color: '#0d3580', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: '700', display: 'flex', alignItems: 'center', gap: 5 }}>
              <GroupsIcon style={{ fontSize: 16 }} />Équipe
            </button>
            <button onClick={prevWeek} style={navBtn}><ArrowBackIosIcon style={{ fontSize: 16 }} /></button>
            <span style={{ fontSize: 13, fontWeight: '600', color: '#fff', whiteSpace: 'nowrap' }}>Sem. du {formatDate(weekStart)}</span>
            <button onClick={nextWeek} style={navBtn}><ArrowForwardIosIcon style={{ fontSize: 16 }} /></button>
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

      {/* Grille jours */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(6, 1fr)`, gap: 0, overflowX: 'auto', padding: '0 8px' }}>
        {dayData.map((day) => (
          <DayColumn
            key={day.iso}
            day={day}
            enCours={enCours}
            getOuvrierInfo={getOuvrierInfo}
            onAffecter={(uid, chId) => handleAffecter(uid, chId, day.iso)}
            onRetirer={handleRetirer}
            onRetirerChantier={(chId) => handleRetirerChantierJour(chId, day.iso)}
            onDragStart={handleDragStart}
            onDragStartCard={handleDragStartCard}
            onDrop={handleDrop}
            onDropOnDay={() => handleDropOnDay(day.iso)}
            picker={picker}
            setPicker={setPicker}
            onAddClick={() => setAddModal({ dateISO: day.iso, date: day.date, disponibles: day.disponibles })}
            saving={saving}
          />
        ))}
      </div>

      {/* Résumé semaine */}
      <div style={{ padding: '8px 16px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Résumé semaine</p>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {enCours.map(c => {
            const uids = [...new Set(planning.filter(p => p.chantierId === c.id).map(p => p.ouvrierUid))].filter(uid => actifs.some(a => a.id === uid))
            if (uids.length === 0) return null
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 10, border: '1.5px solid #e2e4ea', padding: '10px 14px', flexShrink: 0, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: couleurChantier(c.id) }} />
                  <span style={{ fontSize: 12, fontWeight: '600', color: '#111111' }}>{c.nom}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {uids.map(uid => {
                    const o = getOuvrierInfo(uid)
                    return o ? <MiniAvatar key={uid} nom={`${o.prenom} ${o.nom}`} isChef={o.role === 'chef_equipe'} /> : null
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal ajouter chantier à un jour */}
      {addModal && (
        <ModalAjoutChantier
          enCours={enCours}
          disponibles={addModal.disponibles}
          equipes={equipes}
          personnel={personnel}
          date={addModal.date}
          saving={saving}
          onClose={() => setAddModal(null)}
          onSave={(chId, uids) => handleAjoutChantierJour(chId, uids, addModal.dateISO)}
        />
      )}

      {/* Modal équipe */}
      {modalEquipe && (
        <ModalEquipe
          equipes={equipes} chantiers={enCours} days={days}
          saving={saving} onClose={() => setModalEquipe(false)} onSave={affecterEquipe}
        />
      )}
    </div>
  )
}

function DayColumn({ day, enCours, getOuvrierInfo, onAffecter, onRetirer, onRetirerChantier, onDragStart, onDragStartCard, onDrop, onDropOnDay, picker, setPicker, onAddClick, saving }) {
  const { date, iso, isToday, groups, disponibles, dayIndex } = day
  const [dragOver, setDragOver] = React.useState(false)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => { setDragOver(false); onDropOnDay() }}
      style={{
        borderRight: dayIndex < 5 ? '1px solid #e2e4ea' : 'none', minWidth: isMobile ? 140 : 0,
        background: dragOver ? 'rgba(13,53,128,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* En-tête jour */}
      <div style={{ padding: '10px 8px 6px', textAlign: 'center', background: isToday ? '#e8edf8' : dragOver ? 'rgba(13,53,128,0.08)' : '#fff', borderBottom: '1.5px solid #e2e4ea', transition: 'background 0.15s' }}>
        <p style={{ fontSize: 10, fontWeight: '600', color: '#6b7280', margin: 0, textTransform: 'uppercase' }}>{DAYS_FR[dayIndex]}</p>
        <p style={{ fontSize: 16, fontWeight: isToday ? '700' : '500', color: isToday ? '#0d3580' : '#111111', margin: '2px 0 0' }}>{date.getDate()}</p>
        {dragOver && <p style={{ fontSize: 8, color: '#0d3580', margin: '2px 0 0', fontWeight: '600' }}>Déposer ici</p>}
      </div>

      {/* Cartes chantier */}
      <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 160 }}>
        {Object.entries(groups).map(([chId, entries]) => {
          const ch = enCours.find(c => c.id === chId)
          return (
            <div
              key={chId}
              draggable
              onDragStart={(e) => { e.stopPropagation(); onDragStartCard(chId, iso) }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => { e.stopPropagation(); onDrop(chId, iso) }}
              style={{
                background: couleurChantier(chId), borderRadius: 10, padding: '8px 8px 6px',
                cursor: 'grab', transition: 'box-shadow 0.15s',
              }}
              title="Glisser cette carte vers un autre jour pour la copier"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <ConstructionIcon style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }} />
                <span style={{ fontSize: 10, fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {ch?.nom || chId.slice(0, 8)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); !saving && onRetirerChantier(chId) }}
                  title="Retirer ce chantier de ce jour"
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                >
                  <CloseIcon style={{ fontSize: 10, color: '#fff' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {entries.map(entry => {
                  const o = getOuvrierInfo(entry.ouvrierUid)
                  return (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={() => onDragStart(entry.ouvrierUid, iso, chId)}
                      onClick={() => !saving && onRetirer(entry)}
                      title={`${entry.ouvrierNom} — cliquer pour retirer`}
                      style={{
                        background: 'rgba(255,255,255,0.25)', borderRadius: 6, padding: '3px 8px',
                        fontSize: 10, fontWeight: '600', color: '#fff', cursor: 'grab',
                        display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                      }}
                    >
                      {o ? `${o.prenom} ${o.nom?.[0]}.` : '?'}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Zone vide pour drop */}
        {enCours.length > 0 && Object.keys(groups).length === 0 && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragRef.current && enCours[0]) onDrop(enCours[0].id, iso) }}
            style={{ border: '1.5px dashed #d1d5db', borderRadius: 10, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c8d3ee', fontSize: 11 }}
          >
            Glisser ici
          </div>
        )}

        {/* Bouton ajouter chantier */}
        {disponibles.length > 0 && (
          <button
            onClick={onAddClick}
            style={{
              width: '100%', border: '1.5px dashed #0d3580', borderRadius: 8, background: 'transparent',
              padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              cursor: 'pointer', color: '#0d3580', fontSize: 10, fontWeight: '600',
            }}
          >
            <AddIcon style={{ fontSize: 14 }} />Chantier
          </button>
        )}
      </div>

      {/* Disponibles */}
      {disponibles.length > 0 && (
        <div style={{ padding: '4px 6px 10px', borderTop: '1px dashed #e2e4ea' }}>
          <p style={{ fontSize: 8, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px', textAlign: 'center' }}>
            Dispo ({disponibles.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
            {disponibles.map(o => (
              <div
                key={o.id}
                draggable
                onDragStart={() => onDragStart(o.id, null, null)}
                onClick={() => setPicker(picker?.uid === o.id && picker?.date === iso ? null : { uid: o.id, date: iso, nom: `${o.prenom} ${o.nom}`, email: o.email })}
                title={`${o.prenom} ${o.nom} — cliquer pour affecter`}
                style={{
                  width: 28, height: 28, borderRadius: '50%', fontSize: 9, fontWeight: '700',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: picker?.uid === o.id && picker?.date === iso ? '#E8A838' : o.role === 'chef_equipe' ? '#0d3580' : '#e8edf8',
                  color: (picker?.uid === o.id && picker?.date === iso) || o.role === 'chef_equipe' ? '#fff' : '#0d3580',
                  cursor: 'pointer', transition: 'transform 0.1s',
                  transform: picker?.uid === o.id && picker?.date === iso ? 'scale(1.15)' : 'none',
                }}
              >
                {o.prenom?.[0]}{o.nom?.[0]}
              </div>
            ))}
          </div>

          {/* Picker chantier */}
          {picker && picker.date === iso && (
            <div style={{ marginTop: 6, background: '#fff', borderRadius: 8, border: '1.5px solid #0d3580', padding: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 9, fontWeight: '600', color: '#6b7280', margin: '0 0 4px', textAlign: 'center' }}>
                {picker.nom} →
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {enCours.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onAffecter(picker.uid, c.id)}
                    disabled={saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, background: couleurChantier(c.id),
                      border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', width: '100%',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.nom}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MiniAvatar({ nom, isChef }) {
  const parts = nom.split(' ')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', background: isChef ? '#0d3580' : '#e8edf8',
      borderRadius: 12, padding: '3px 10px',
    }}>
      <span style={{ fontSize: 10, fontWeight: '600', color: isChef ? '#fff' : '#0d3580' }}>{parts[0]} {parts[1]?.[0]}.</span>
    </div>
  )
}

function ModalAjoutChantier({ enCours, disponibles, equipes, personnel, date, saving, onClose, onSave }) {
  const [chantierId, setChantierId] = useState('')
  const [selectedUids, setSelectedUids] = useState([])

  const dispoIds = new Set(disponibles.map(o => o.id))

  const equipesAvecDispos = useMemo(() => {
    return equipes.map(eq => {
      const memberUids = [eq.chefUid, ...(eq.ouvrierUids || [])]
      const membersDispos = memberUids.filter(uid => dispoIds.has(uid))
      const members = membersDispos.map(uid => personnel.find(p => p.id === uid)).filter(Boolean)
      return { ...eq, membersDispos, members }
    }).filter(eq => eq.membersDispos.length > 0)
  }, [equipes, personnel, dispoIds])

  const inEquipeSet = useMemo(() => {
    const s = new Set()
    equipes.forEach(eq => { [eq.chefUid, ...(eq.ouvrierUids || [])].forEach(uid => s.add(uid)) })
    return s
  }, [equipes])

  const sansEquipe = disponibles.filter(o => !inEquipeSet.has(o.id))

  function toggleUid(uid) {
    setSelectedUids(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid])
  }

  function toggleEquipe(eq) {
    const allSelected = eq.membersDispos.every(uid => selectedUids.includes(uid))
    if (allSelected) {
      setSelectedUids(prev => prev.filter(uid => !eq.membersDispos.includes(uid)))
    } else {
      setSelectedUids(prev => [...new Set([...prev, ...eq.membersDispos])])
    }
  }

  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={modalOverlay}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: '700', color: '#111111', margin: 0 }}>Ajouter au planning</h2>
          <button onClick={onClose} style={iconBtn}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px', textTransform: 'capitalize' }}>{dateLabel}</p>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Chantier</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enCours.map(c => (
              <button key={c.id} onClick={() => setChantierId(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  border: chantierId === c.id ? '2px solid #0d3580' : '1.5px solid #e2e4ea',
                  borderRadius: 10, background: chantierId === c.id ? '#e8edf8' : '#fff',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: couleurChantier(c.id), flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: '600', color: '#111111' }}>{c.nom}</span>
                {chantierId === c.id && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#0d3580', fontWeight: '700' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {chantierId && (
          <div style={{ marginBottom: 14 }}>
            {/* Équipes */}
            {equipesAvecDispos.length > 0 && (
              <>
                <label style={lbl}>Équipes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {equipesAvecDispos.map(eq => {
                    const allSel = eq.membersDispos.every(uid => selectedUids.includes(uid))
                    const someSel = eq.membersDispos.some(uid => selectedUids.includes(uid))
                    return (
                      <div key={eq.id} style={{
                        border: allSel ? '2px solid #16a34a' : someSel ? '2px solid #d97706' : '1.5px solid #e2e4ea',
                        borderRadius: 10, background: allSel ? '#dcfce7' : '#fff', overflow: 'hidden',
                      }}>
                        <button onClick={() => toggleEquipe(eq)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                            background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                          }}
                        >
                          <GroupsIcon style={{ fontSize: 20, color: allSel ? '#16a34a' : '#0d3580', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: '700', color: '#111111', margin: 0 }}>{eq.nom}</p>
                            <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>{eq.membersDispos.length} dispo sur {1 + (eq.ouvrierUids?.length || 0)}</p>
                          </div>
                          {allSel && <span style={{ fontSize: 14, color: '#16a34a' }}>✓</span>}
                        </button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 12px 8px' }}>
                          {eq.members.map(m => (
                            <button key={m.id} onClick={() => toggleUid(m.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                                borderRadius: 6, border: 'none', fontSize: 10, fontWeight: '600', cursor: 'pointer',
                                background: selectedUids.includes(m.id) ? '#0d3580' : '#e8edf8',
                                color: selectedUids.includes(m.id) ? '#fff' : '#0d3580',
                              }}
                            >
                              {m.prenom} {m.nom?.[0]}.
                              {selectedUids.includes(m.id) && <span style={{ marginLeft: 2 }}>✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Ouvriers sans équipe */}
            {sansEquipe.length > 0 && (
              <>
                <label style={lbl}>{equipesAvecDispos.length > 0 ? 'Ouvriers sans équipe' : 'Ouvriers à affecter'}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                  {sansEquipe.map(o => (
                    <button key={o.id} onClick={() => toggleUid(o.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        border: selectedUids.includes(o.id) ? '2px solid #16a34a' : '1.5px solid #e2e4ea',
                        borderRadius: 8, background: selectedUids.includes(o.id) ? '#dcfce7' : '#fff',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: '700',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: o.role === 'chef_equipe' ? '#0d3580' : '#e8edf8',
                        color: o.role === 'chef_equipe' ? '#fff' : '#0d3580', flexShrink: 0,
                      }}>{o.prenom?.[0]}{o.nom?.[0]}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: '500', color: '#111111', margin: 0 }}>{o.prenom} {o.nom}</p>
                        <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{o.role === 'chef_equipe' ? 'Chef' : 'Ouvrier'}</p>
                      </div>
                      {selectedUids.includes(o.id) && <span style={{ fontSize: 14, color: '#16a34a' }}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {disponibles.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 16 }}>Tous les ouvriers sont déjà affectés</p>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={() => !saving && chantierId && selectedUids.length > 0 && onSave(chantierId, selectedUids)}
            disabled={saving || !chantierId || selectedUids.length === 0}
            style={{
              flex: 2, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12,
              fontSize: 13, fontWeight: '700', cursor: 'pointer',
              opacity: (!chantierId || selectedUids.length === 0) ? 0.5 : 1,
            }}
          >
            {saving ? 'Affectation…' : `Affecter ${selectedUids.length} ouvrier(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEquipe({ equipes, chantiers, days, saving, onClose, onSave }) {
  const [equipeId,   setEquipeId]   = useState('')
  const [chantierId, setChantierId] = useState('')
  const [joursISO,   setJoursISO]   = useState(
    days.slice(0, 6).map(d => toISO(d))
  )

  function toggleJour(iso) { setJoursISO(prev => prev.includes(iso) ? prev.filter(x => x !== iso) : [...prev, iso]) }

  const equipe    = equipes.find(e => e.id === equipeId)
  const nbMembres = equipe ? 1 + (equipe.ouvrierUids?.length || 0) : 0

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={modalOverlay}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: '700', color: '#111111', margin: 0 }}>Affecter une équipe</h2>
          <button onClick={onClose} style={iconBtn}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Équipe</label>
            <select value={equipeId} onChange={e => setEquipeId(e.target.value)} style={{ width: '100%', ...inp }}>
              <option value="">— Choisir une équipe —</option>
              {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
            </select>
            {equipeId && <p style={{ fontSize: 11, color: '#0d3580', margin: '4px 0 0', fontWeight: '600' }}>{nbMembres} membre(s)</p>}
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
                const iso = toISO(d)
                const sel = joursISO.includes(iso)
                const isDim = i >= 6
                return (
                  <button key={i} onClick={() => !isDim && toggleJour(iso)} disabled={isDim}
                    style={{
                      flex: 1, border: 'none', borderRadius: 8, padding: '8px 4px',
                      background: isDim ? '#f9fafb' : sel ? '#0d3580' : '#f0f2f7',
                      color: isDim ? '#d1d5db' : sel ? '#fff' : '#111111',
                      cursor: isDim ? 'default' : 'pointer', fontSize: 11, fontWeight: '600',
                    }}
                  >
                    <div>{DAYS_FR[i] || 'Dim'}</div>
                    <div style={{ fontSize: 10, fontWeight: '400', marginTop: 2 }}>{d.getDate()}</div>
                  </button>
                )
              })}
            </div>
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

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

const navBtn = { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }
const modalOverlay = { position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const lbl = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }
const inp = { background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111111', outline: 'none', boxSizing: 'border-box' }
