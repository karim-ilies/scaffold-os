import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useModal } from '../../context/ModalContext'
import { formatEuro, formatDate } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import ArrowBackIcon     from '@mui/icons-material/ArrowBack'
import EditIcon          from '@mui/icons-material/Edit'
import ArchiveIcon       from '@mui/icons-material/Archive'
import AddIcon           from '@mui/icons-material/Add'
import ConstructionIcon  from '@mui/icons-material/Construction'
import DescriptionIcon   from '@mui/icons-material/Description'
import BusinessIcon      from '@mui/icons-material/Business'
import SaveIcon          from '@mui/icons-material/Save'
import CloseIcon         from '@mui/icons-material/Close'

export default function ClientDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { showModal } = useModal()
  const [client,    setClient]    = useState(null)
  const [chantiers, setChantiers] = useState([])
  const [factures,  setFactures]  = useState([])
  const [editing,   setEditing]   = useState(false)
  const [form,      setForm]      = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [onglet,    setOnglet]    = useState('chantiers')

  useEffect(() => doc(db, 'clients', id) && onSnapshot(doc(db, 'clients', id), snap => {
    if (snap.exists()) { const d = { id: snap.id, ...snap.data() }; setClient(d); setForm(d) }
  }), [id])

  useEffect(() => {
    if (!id) return
    getDocs(query(collection(db, 'chantiers'), where('clientId', '==', id))).then(s => setChantiers(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDocs(query(collection(db, 'factures'),  where('clientId', '==', id))).then(s => setFactures(s.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [id])

  async function handleArchive() {
    const ok = await showModal({ type: 'danger', title: `Archiver ${client.nom} ?`, message: 'Les factures et chantiers liés sont conservés. Ce client n\'apparaîtra plus dans la liste principale.', confirmLabel: 'Archiver', initials: client.nom.slice(0, 2).toUpperCase() })
    if (!ok) return
    await updateDoc(doc(db, 'clients', id), { actif: false, updatedAt: serverTimestamp() })
    navigate('/clients')
  }

  async function handleSave() {
    setSaving(true)
    await updateDoc(doc(db, 'clients', id), { ...form, updatedAt: serverTimestamp() })
    setSaving(false)
    setEditing(false)
    await showModal({ type: 'info', title: 'Client mis à jour !', message: `${form.nom} a été sauvegardé.` })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setAddr = (k, v) => setForm(f => ({ ...f, adresse: { ...f.adresse, [k]: v } }))

  if (!client) return <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Chargement…</div>

  const caTotal = factures.filter(f => f.statut !== 'annulee' && f.statut !== 'brouillon').reduce((s, f) => s + (f.totalHT || 0), 0)

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 24px' }}>
        <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
          <ArrowBackIcon style={{ fontSize: 16 }} />Clients
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: '700', color: '#fff' }}>
              {client.nom.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>{client.nom}</h1>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: '600' }}>{client.type === 'pro' ? 'Professionnel' : 'Particulier'}</span>
                {!client.actif && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: '600' }}>Archivé</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
                  <SaveIcon style={{ fontSize: 16 }} />{saving ? '…' : 'Sauvegarder'}
                </button>
                <button onClick={() => { setEditing(false); setForm(client) }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CloseIcon style={{ fontSize: 16 }} />Annuler
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate(`/factures?clientId=${id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
                  <AddIcon style={{ fontSize: 16 }} />Facture
                </button>
                <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
                  <EditIcon style={{ fontSize: 18, color: '#fff' }} />
                </button>
                {client.actif && (
                  <button onClick={handleArchive} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
                    <ArchiveIcon style={{ fontSize: 18, color: '#fff' }} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* CA Total */}
      <div style={{ background: '#0d3580', paddingBottom: 20, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', display: 'inline-block' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', fontWeight: '600' }}>CA TOTAL HT</p>
          <p style={{ fontSize: 24, fontWeight: '700', color: '#fff', margin: 0 }}>{formatEuro(caTotal)}</p>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Coordonnées */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #0d3580', padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: '0 0 14px' }}>Coordonnées</p>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <F label="Nom / Raison sociale"><input value={form.nom || ''} onChange={e => set('nom', e.target.value)} style={inpS} /></F>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <F label="Type">
                  <select value={form.type || 'pro'} onChange={e => set('type', e.target.value)} style={inpS}>
                    <option value="pro">Professionnel</option>
                    <option value="particulier">Particulier</option>
                  </select>
                </F>
                <F label="Régime TVA">
                  <select value={form.regimeTVADefaut || 'normal'} onChange={e => set('regimeTVADefaut', e.target.value)} style={inpS}>
                    <option value="normal">20%</option>
                    <option value="reduit">10%</option>
                    <option value="autoliquidation">Autoliquidation</option>
                  </select>
                </F>
              </div>
              <F label="Téléphone"><input value={form.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inpS} /></F>
              <F label="Email"><input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} style={inpS} /></F>
              <F label="Adresse"><input value={form.adresse?.rue || ''} onChange={e => setAddr('rue', e.target.value)} placeholder="Rue" style={inpS} /></F>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <F label="CP"><input value={form.adresse?.cp || ''} onChange={e => setAddr('cp', e.target.value)} style={inpS} /></F>
                <F label="Ville"><input value={form.adresse?.ville || ''} onChange={e => setAddr('ville', e.target.value)} style={inpS} /></F>
              </div>
              {form.type === 'pro' && <F label="SIRET"><input value={form.siret || ''} onChange={e => set('siret', e.target.value)} style={inpS} /></F>}
              <F label="Notes"><textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...inpS, resize: 'vertical' }} /></F>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Téléphone', client.telephone],
                ['Email', client.email],
                ['Adresse', [client.adresse?.rue, client.adresse?.cp, client.adresse?.ville].filter(Boolean).join(', ')],
                client.type === 'pro' && client.siret ? ['SIRET', client.siret] : null,
                client.notes ? ['Notes', client.notes] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: '600', minWidth: 80 }}>{k}</span>
                  <span style={{ fontSize: 13, color: '#111111' }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Onglets historique */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {['chantiers', 'factures'].map(t => (
            <button key={t} onClick={() => setOnglet(t)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: onglet === t ? '600' : '400', background: onglet === t ? '#0d3580' : '#fff', color: onglet === t ? '#fff' : '#6b7280', border: onglet === t ? 'none' : '1px solid #e2e4ea', cursor: 'pointer' }}>
              {t === 'chantiers' ? `Chantiers (${chantiers.length})` : `Factures (${factures.length})`}
            </button>
          ))}
        </div>

        {onglet === 'chantiers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chantiers.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 24 }}>Aucun chantier</p> : chantiers.map(c => {
              const badge = BADGES?.[c.statut] || { background: '#f3f4f6', color: '#374151' }
              return (
                <div key={c.id} onClick={() => navigate(`/chantiers/${c.id}`)} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e4ea', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <ConstructionIcon style={{ fontSize: 18, color: '#0d3580' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{c.nom}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{c.adresse?.ville || ''} · Depuis {formatDate(c.dateDebut)}</p>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: '600', ...badge }}>{c.statut}</span>
                </div>
              )
            })}
          </div>
        )}

        {onglet === 'factures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {factures.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 24 }}>Aucune facture</p> : factures.map(f => {
              const badge = BADGES?.[f.statut] || { background: '#f3f4f6', color: '#374151' }
              return (
                <div key={f.id} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e4ea', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <DescriptionIcon style={{ fontSize: 18, color: '#0d3580' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: 0 }}>{f.numero}</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{formatDate(f.dateEmission)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 14, fontWeight: '700', color: '#0d3580', margin: 0 }}>{formatEuro(f.totalTTC)}</p>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: '600', ...badge }}>{f.statut}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function F({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inpS = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', outline: 'none', fontFamily: 'inherit' }
