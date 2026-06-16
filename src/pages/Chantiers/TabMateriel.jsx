import { useState } from 'react'
import { useDemandesMateriel } from '../../hooks/useDemandesMateriel'
import { useAuth } from '../../hooks/useAuth'
import AddIcon    from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon  from '@mui/icons-material/Close'
import SendIcon   from '@mui/icons-material/Send'
import InventoryIcon from '@mui/icons-material/Inventory'

const STATUTS = {
  nouvelle:    { label: 'Nouvelle',    bg: '#fee2e2', color: '#dc2626' },
  en_commande: { label: 'En commande', bg: '#fef9c3', color: '#a16207' },
  livree:      { label: 'Livrée',      bg: '#dcfce7', color: '#16a34a' },
}

const UNITES = ['pcs', 'ml', 'm²', 'kg', 'rouleau']

function articleVide() {
  return { nom: '', quantite: 1, unite: 'pcs' }
}

export default function TabMateriel({ chantierId, chantierNom, isPatron }) {
  const { user } = useAuth()
  const { demandes, loading, creerDemande, changerStatut, supprimerDemande } = useDemandesMateriel({ chantierId })
  const [modalOuvert, setModalOuvert] = useState(false)
  const [articles,    setArticles]    = useState([articleVide()])
  const [note,        setNote]        = useState('')
  const [saving,      setSaving]      = useState(false)

  function ajouterLigne() {
    setArticles(prev => [...prev, articleVide()])
  }

  function supprimerLigne(i) {
    setArticles(prev => prev.filter((_, idx) => idx !== i))
  }

  function setArticle(i, champ, val) {
    setArticles(prev => prev.map((a, idx) => idx === i ? { ...a, [champ]: val } : a))
  }

  async function handleSoumettre() {
    const valides = articles.filter(a => a.nom.trim())
    if (!valides.length) return
    setSaving(true)
    try {
      await creerDemande({
        chantierId,
        chantierNom,
        creePar:    user.uid,
        creeParNom: `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email,
        articles:   valides,
        note:       note.trim(),
      })
      setArticles([articleVide()])
      setNote('')
      setModalOuvert(false)
    } finally {
      setSaving(false)
    }
  }

  function formatDate(ts) {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const nouvelles   = demandes.filter(d => d.statut === 'nouvelle')
  const enCommande  = demandes.filter(d => d.statut === 'en_commande')
  const livrees     = demandes.filter(d => d.statut === 'livree')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header + bouton */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: '700', color: '#111111', margin: 0 }}>Matériel manquant</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
            {nouvelles.length > 0
              ? <span style={{ color: '#dc2626', fontWeight: '600' }}>{nouvelles.length} demande(s) en attente</span>
              : 'Aucune demande en attente'
            }
          </p>
        </div>
        <button
          onClick={() => setModalOuvert(true)}
          style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <AddIcon style={{ fontSize: 18 }} />Signaler un manque
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>Chargement…</p>}

      {!loading && demandes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, border: '1.5px solid #e2e4ea' }}>
          <InventoryIcon style={{ fontSize: 40, color: '#c8d3ee', marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Aucune demande de matériel</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>Signalez les articles manquants au patron</p>
        </div>
      )}

      {/* Demandes nouvelles */}
      {nouvelles.map(d => <CarteDemande key={d.id} demande={d} isPatron={isPatron} onStatut={changerStatut} onSupprimer={supprimerDemande} formatDate={formatDate} />)}

      {/* Demandes en commande */}
      {enCommande.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: '600', color: '#a16207', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0' }}>En commande</p>
          {enCommande.map(d => <CarteDemande key={d.id} demande={d} isPatron={isPatron} onStatut={changerStatut} onSupprimer={supprimerDemande} formatDate={formatDate} />)}
        </>
      )}

      {/* Livrées */}
      {livrees.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0' }}>Livrées</p>
          {livrees.map(d => <CarteDemande key={d.id} demande={d} isPatron={isPatron} onStatut={changerStatut} onSupprimer={supprimerDemande} formatDate={formatDate} />)}
        </>
      )}

      {/* Modal nouvelle demande */}
      {modalOuvert && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalOuvert(false) }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: '700', color: '#111111', margin: 0 }}>Signaler du matériel manquant</h2>
              <button onClick={() => setModalOuvert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
              Chantier : <strong style={{ color: '#0d3580' }}>{chantierNom}</strong>
            </p>

            {/* Liste articles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {articles.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    placeholder="Article (ex: moise, poteau 2m…)"
                    value={a.nom}
                    onChange={e => setArticle(i, 'nom', e.target.value)}
                    style={{ flex: 1, background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}
                  />
                  <input
                    type="number"
                    min="1"
                    value={a.quantite}
                    onChange={e => setArticle(i, 'quantite', parseInt(e.target.value) || 1)}
                    style={{ width: 60, background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 8px', fontSize: 13, outline: 'none', textAlign: 'center' }}
                  />
                  <select
                    value={a.unite}
                    onChange={e => setArticle(i, 'unite', e.target.value)}
                    style={{ background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 8px', fontSize: 13, outline: 'none' }}
                  >
                    {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {articles.length > 1 && (
                    <button onClick={() => supprimerLigne(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '8px', cursor: 'pointer', display: 'flex', color: '#dc2626', flexShrink: 0 }}>
                      <DeleteIcon style={{ fontSize: 16 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={ajouterLigne} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e8edf8', color: '#0d3580', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '600', cursor: 'pointer', marginBottom: 14 }}>
              <AddIcon style={{ fontSize: 16 }} />Ajouter un article
            </button>

            <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Note (optionnel)
            </label>
            <textarea
              placeholder="Précisions, urgence, où le placer…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ width: '100%', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 18 }}
            />

            <button
              onClick={handleSoumettre}
              disabled={saving || !articles.some(a => a.nom.trim())}
              style={{
                width: '100%', background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10,
                padding: '13px', fontSize: 14, fontWeight: '700', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: (!articles.some(a => a.nom.trim())) ? 0.5 : 1,
              }}
            >
              <SendIcon style={{ fontSize: 18 }} />
              {saving ? 'Envoi…' : 'Envoyer la demande au patron'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CarteDemande({ demande, isPatron, onStatut, onSupprimer, formatDate }) {
  const st = STATUTS[demande.statut] || STATUTS.nouvelle

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${demande.statut === 'nouvelle' ? '#fca5a5' : '#e2e4ea'}`, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            <strong style={{ color: '#111111' }}>{demande.creeParNom}</strong> · {formatDate(demande.createdAt)}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: '700', padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color, flexShrink: 0 }}>
          {st.label}
        </span>
      </div>

      {/* Articles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: demande.note ? 10 : 0 }}>
        {(demande.articles || []).map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F7F8FA', borderRadius: 8, padding: '7px 12px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d3580', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: '500', color: '#111111' }}>{a.nom}</span>
            <span style={{ fontSize: 13, fontWeight: '700', color: '#0d3580' }}>{a.quantite} {a.unite}</span>
          </div>
        ))}
      </div>

      {demande.note && (
        <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0', padding: '8px 12px', background: '#fef9c3', borderRadius: 8, borderLeft: '3px solid #a16207' }}>
          {demande.note}
        </p>
      )}

      {/* Actions patron */}
      {isPatron && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {demande.statut === 'nouvelle' && (
            <button onClick={() => onStatut(demande.id, 'en_commande')} style={{ flex: 1, background: '#fef9c3', color: '#a16207', border: '1.5px solid #a16207', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: '600', cursor: 'pointer' }}>
              Marquer "En commande"
            </button>
          )}
          {demande.statut === 'en_commande' && (
            <button onClick={() => onStatut(demande.id, 'livree')} style={{ flex: 1, background: '#dcfce7', color: '#16a34a', border: '1.5px solid #16a34a', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: '600', cursor: 'pointer' }}>
              Marquer "Livré"
            </button>
          )}
          {demande.statut !== 'livree' && (
            <button onClick={() => onStatut(demande.id, 'livree')} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
              Livré ✓
            </button>
          )}
          <button onClick={() => window.confirm('Supprimer cette demande ?') && onSupprimer(demande.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <DeleteIcon style={{ fontSize: 15 }} />
          </button>
        </div>
      )}
    </div>
  )
}
