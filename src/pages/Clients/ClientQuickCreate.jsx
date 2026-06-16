import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import CloseIcon from '@mui/icons-material/Close'

export default function ClientQuickCreate({ onCreated, onClose }) {
  const [form, setForm] = useState({
    nom: '', type: 'pro', telephone: '',
    adresse: { rue: '', cp: '', ville: '' },
    email: '', siret: '', regimeTVADefaut: 'normal',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setAddr = (k, v) => setForm(f => ({ ...f, adresse: { ...f.adresse, [k]: v } }))

  async function submit(e) {
    e.preventDefault()
    if (!form.nom || !form.telephone) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db, 'clients'), {
        ...form, actif: true, nbFactures: 0, nbChantiers: 0, caTotalHT: 0,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      onCreated?.({ id: ref.id, ...form })
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <form onSubmit={submit} style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: 0 }}>Nouveau client</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['pro', 'particulier'].map(t => (
            <button type="button" key={t} onClick={() => set('type', t)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: form.type === t ? '600' : '400', background: form.type === t ? '#0d3580' : '#f3f4f6', color: form.type === t ? '#fff' : '#6b7280', cursor: 'pointer' }}>
              {t === 'pro' ? 'Professionnel' : 'Particulier'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <F label="Nom / Raison sociale *"><input value={form.nom} onChange={e => set('nom', e.target.value)} style={inp} required /></F>
          <F label="Téléphone *"><input value={form.telephone} onChange={e => set('telephone', e.target.value)} style={inp} required inputMode="tel" /></F>
          <F label="Adresse"><input value={form.adresse.rue} onChange={e => setAddr('rue', e.target.value)} placeholder="Rue" style={inp} /></F>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <F label="CP"><input value={form.adresse.cp} onChange={e => setAddr('cp', e.target.value)} style={inp} inputMode="numeric" /></F>
            <F label="Ville"><input value={form.adresse.ville} onChange={e => setAddr('ville', e.target.value)} style={inp} /></F>
          </div>
          <F label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} /></F>
          {form.type === 'pro' && <F label="SIRET"><input value={form.siret} onChange={e => set('siret', e.target.value)} style={inp} inputMode="numeric" /></F>}
          <F label="Régime TVA par défaut">
            <select value={form.regimeTVADefaut} onChange={e => set('regimeTVADefaut', e.target.value)} style={inp}>
              <option value="normal">TVA 20% (normal)</option>
              <option value="reduit">TVA 10% (réduit)</option>
              <option value="autoliquidation">Autoliquidation</option>
            </select>
          </F>
        </div>

        <button type="submit" disabled={saving} style={{ width: '100%', marginTop: 20, background: saving ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Création…' : 'Créer et utiliser'}
        </button>
      </form>
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

const inp = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', outline: 'none', fontFamily: 'inherit' }
