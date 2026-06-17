import { useState, useMemo } from 'react'
import { useEquipes }   from '../../hooks/useEquipes'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useModal }     from '../../context/ModalContext'
import CloseIcon  from '@mui/icons-material/Close'
import EditIcon   from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import GroupsIcon from '@mui/icons-material/Groups'

export default function EquipesPage() {
  const { equipes, loading, creerEquipe, modifierEquipe, supprimerEquipe } = useEquipes()
  const { personnel } = usePersonnel()
  const { showModal } = useModal()
  const [modal, setModal] = useState(null) // null | 'new' | equipe obj

  const actifs = personnel.filter(p => p.actif !== false)

  function getDisponibles(editingEquipe) {
    const prises = new Set()
    equipes.forEach(eq => {
      if (editingEquipe && eq.id === editingEquipe.id) return
      prises.add(eq.chefUid)
      ;(eq.ouvrierUids || []).forEach(uid => prises.add(uid))
    })
    return actifs.filter(p => !prises.has(p.id))
  }

  function nomComplet(uid) {
    const p = personnel.find(x => x.id === uid)
    return p ? `${p.prenom} ${p.nom}` : '—'
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Équipes</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{equipes.length} équipe(s) configurée(s)</p>
        </div>
        <button
          onClick={() => setModal('new')}
          style={{ background: '#fff', color: '#0d3580', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: '700', cursor: 'pointer' }}
        >
          + Nouvelle équipe
        </button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <p style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>Chargement…</p>}

        {!loading && equipes.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <GroupsIcon style={{ fontSize: 48, color: '#c8d3ee', marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Aucune équipe créée</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>Créez une équipe pour l'affecter rapidement à un chantier</p>
          </div>
        )}

        {equipes.map(eq => {
          const chefNom = nomComplet(eq.chefUid)
          const nbOuvriers = eq.ouvrierUids?.length || 0
          return (
            <div key={eq.id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <GroupsIcon style={{ fontSize: 22, color: '#0d3580' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: '700', color: '#111111', margin: 0 }}>{eq.nom}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 6px' }}>
                    Chef : <strong style={{ color: '#0d3580' }}>{chefNom}</strong>
                  </p>
                  {/* Avatars ouvriers */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(eq.ouvrierUids || []).map(uid => {
                      const o = personnel.find(p => p.id === uid)
                      if (!o) return null
                      return (
                        <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0f2f7', borderRadius: 20, padding: '3px 8px' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0d3580', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: '700', color: '#fff' }}>
                            {o.prenom?.[0]}{o.nom?.[0]}
                          </div>
                          <span style={{ fontSize: 11, color: '#111111', fontWeight: '500' }}>{o.prenom} {o.nom?.[0]}.</span>
                        </div>
                      )
                    })}
                    {nbOuvriers === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>Aucun ouvrier</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setModal(eq)} style={{ background: '#e8edf8', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: '#0d3580', display: 'flex' }}>
                    <EditIcon style={{ fontSize: 16 }} />
                  </button>
                  <button onClick={() => { if (window.confirm(`Supprimer "${eq.nom}" ?`)) supprimerEquipe(eq.id) }} style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
                    <DeleteIcon style={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: '600', background: '#e8edf8', color: '#0d3580', padding: '2px 8px', borderRadius: 20 }}>
                  {1 + nbOuvriers} membre{nbOuvriers > 0 ? 's' : ''}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Chef + {nbOuvriers} ouvrier{nbOuvriers > 1 ? 's' : ''}</span>
              </div>
            </div>
          )
        })}
      </div>

      {modal !== null && (() => {
        const editEq = modal === 'new' ? null : modal
        const disponibles = getDisponibles(editEq)
        return (
          <ModalEquipe
            equipe={editEq}
            chefs={disponibles}
            ouvriers={disponibles}
            onClose={() => setModal(null)}
            onSave={async (data) => {
              if (!data.nom?.trim()) {
                await showModal({ type: 'info', title: 'Information manquante', message: 'Il manque le nom de l\'équipe.' })
                return
              }
              if (!data.chefUid) {
                await showModal({ type: 'info', title: 'Information manquante', message: 'Il manque le chef d\'équipe.' })
                return
              }
              if (!data.ouvrierUids || data.ouvrierUids.length === 0) {
                await showModal({ type: 'info', title: 'Information manquante', message: 'Sélectionnez au moins un ouvrier pour l\'équipe.' })
                return
              }
              const nomExiste = equipes.some(eq => eq.nom.toLowerCase().trim() === data.nom.toLowerCase().trim() && (!editEq || eq.id !== editEq.id))
              if (nomExiste) {
                await showModal({ type: 'info', title: 'Nom déjà utilisé', message: `Une équipe "${data.nom.trim()}" existe déjà. Choisissez un autre nom.` })
                return
              }
              const tousUids = [data.chefUid, ...data.ouvrierUids]
              const doublons = []
              for (const uid of tousUids) {
                for (const eq of equipes) {
                  if (editEq && eq.id === editEq.id) continue
                  const membresEq = [eq.chefUid, ...(eq.ouvrierUids || [])]
                  if (membresEq.includes(uid)) {
                    const p = personnel.find(x => x.id === uid)
                    doublons.push(`${p?.prenom || '?'} ${p?.nom || '?'} est déjà dans l'équipe "${eq.nom}"`)
                  }
                }
              }
              if (doublons.length > 0) {
                await showModal({ type: 'info', title: 'Ouvrier(s) déjà affecté(s)', message: doublons.join('\n') })
                return
              }
              if (modal === 'new') await creerEquipe(data)
              else await modifierEquipe(modal.id, data)
              setModal(null)
            }}
          />
        )
      })()}
    </div>
  )
}

function ModalEquipe({ equipe, chefs, ouvriers, onClose, onSave }) {
  const [nom,        setNom]        = useState(equipe?.nom       || '')
  const [chefUid,    setChefUid]    = useState(equipe?.chefUid   || '')
  const [selection,  setSelection]  = useState(new Set(equipe?.ouvrierUids || []))
  const [saving,     setSaving]     = useState(false)

  function toggleOuvrier(uid) {
    setSelection(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ nom: nom.trim(), chefUid, ouvrierUids: [...selection] })
    setSaving(false)
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: '700', color: '#111111', margin: 0 }}>
            {equipe ? 'Modifier l\'équipe' : 'Nouvelle équipe'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nom de l'équipe</label>
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex : Équipe Ahmed, Équipe toiture..."
              style={{ width: '100%', ...inp }}
            />
          </div>

          <div>
            <label style={lbl}>Chef d'équipe</label>
            <select value={chefUid} onChange={e => setChefUid(e.target.value)} style={{ width: '100%', ...inp }}>
              <option value="">— Choisir un chef —</option>
              {chefs.map(c => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            {chefs.length === 0 && <p style={{ fontSize: 11, color: '#d97706', margin: '4px 0 0' }}>⚠ Aucun membre actif dans le personnel</p>}
          </div>

          <div>
            <label style={lbl}>Ouvriers ({selection.size} sélectionné{selection.size > 1 ? 's' : ''})</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: 10 }}>
              {ouvriers.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, textAlign: 'center', padding: 12 }}>Aucun ouvrier disponible</p>}
              {ouvriers.map(o => (
                <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, background: selection.has(o.id) ? '#e8edf8' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={selection.has(o.id)}
                    onChange={() => toggleOuvrier(o.id)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0d3580', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                    {o.prenom?.[0]}{o.nom?.[0]}
                  </div>
                  <span style={{ fontSize: 13, color: '#111111', fontWeight: selection.has(o.id) ? '600' : '400' }}>{o.prenom} {o.nom}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Sauvegarde…' : equipe ? 'Enregistrer' : 'Créer l\'équipe'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }
const inp = { background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111111', outline: 'none', boxSizing: 'border-box' }
