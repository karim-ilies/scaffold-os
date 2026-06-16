import { useState, useEffect } from 'react'
import { collection, query, orderBy, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, STORAGE_ENABLED } from '../../firebase/config'
import { useAuth }      from '../../hooks/useAuth'
import { useChantiers } from '../../hooks/useChantiers'
import { formatEuro, formatDate, formatStatut } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import AddIcon       from '@mui/icons-material/Add'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import ReceiptIcon   from '@mui/icons-material/Receipt'
import CheckIcon     from '@mui/icons-material/Check'
import CloseIcon     from '@mui/icons-material/Close'

export default function TicketsPage() {
  const { user, isPatron } = useAuth()
  const { chantiers }      = useChantiers()
  const [tickets,   setTickets]  = useState([])
  const [loading,   setLoading]  = useState(true)
  const [formOpen,  setFormOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const constraints = [orderBy('createdAt', 'desc')]
    if (!isPatron && user.role !== 'chef_equipe') {
      constraints.unshift(where('ouvrierId', '==', user.uid))
    }
    const q     = query(collection(db, 'tickets'), ...constraints)
    const unsub = onSnapshot(q,
      snap => { setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      ()   => { setTickets([]); setLoading(false) }
    )
    return unsub
  }, [user?.uid, isPatron, user?.role])

  async function validerTicket(id, statut) {
    await updateDoc(doc(db, 'tickets', id), { statut, updatedAt: serverTimestamp() })
  }

  const total = tickets.filter(t => t.statut === 'valide').reduce((s, t) => s + (t.montant || 0), 0)

  if (formOpen) return <ScanTicket chantiers={chantiers} user={user} onClose={() => setFormOpen(false)} />

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Tickets de caisse</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Total validé : {formatEuro(total)}</p>
        </div>
        <button onClick={() => setFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
          <CameraAltIcon style={{ fontSize: 18 }} />Scanner
        </button>
      </div>

      <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading
          ? <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
          : tickets.length === 0
          ? <div style={{ textAlign: 'center', padding: 64 }}><ReceiptIcon style={{ fontSize: 48, color: '#c8d3ee' }} /><p style={{ color: '#6b7280', marginTop: 10 }}>Aucun ticket</p></div>
          : tickets.map(t => {
              const chantier = chantiers.find(c => c.id === t.chantierId)
              const typeLabel = { carburant: 'Carburant', materiau: 'Matériau', repas: 'Repas', autre: 'Autre' }[t.type] || t.type
              const badge = BADGES?.[t.statut] || { background: '#f3f4f6', color: '#374151' }
              return (
                <div key={t.id} style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '12px 16px', display: 'flex', gap: 12 }}>
                  {t.photoUrl && (
                    <img src={t.photoUrl} alt="Ticket" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #e2e4ea' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#374151' }}>{typeLabel}</span>
                      <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...badge }}>{formatStatut(t.statut)}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: '500', color: '#111111', margin: 0 }}>{t.description || '—'}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{chantier?.nom || '—'} · {formatDate(t.date)}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <p style={{ fontSize: 16, fontWeight: '700', color: '#0d3580', margin: 0 }}>{formatEuro(t.montant)}</p>
                    {isPatron && t.statut === 'en_attente' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => validerTicket(t.id, 'valide')} style={{ background: '#dcfce7', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#16a34a', display: 'flex' }}><CheckIcon style={{ fontSize: 14 }} /></button>
                        <button onClick={() => validerTicket(t.id, 'refuse')} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626', display: 'flex' }}><CloseIcon style={{ fontSize: 14 }} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}

function ScanTicket({ chantiers, user, onClose }) {
  const [photo,       setPhoto]       = useState(null)
  const [photoUrl,    setPhotoUrl]    = useState(null)
  const [montant,     setMontant]     = useState('')
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [type,        setType]        = useState('autre')
  const [chantierId,  setChantierId]  = useState('')
  const [description, setDescription] = useState('')
  const [scanning,    setScanning]    = useState(false)
  const [saving,      setSaving]      = useState(false)

  async function handlePhoto(file) {
    if (!file) return
    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) return

    setScanning(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const mediaType = file.type?.startsWith('image/') ? file.type : 'image/jpeg'

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':  apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'Analyse ce ticket de caisse. Réponds UNIQUEMENT en JSON valide sans markdown : {"montant":"45.90","date":"2024-03-15","type":"repas","description":"nom du commerce"}. Types possibles: carburant, materiau, repas, autre. Date format YYYY-MM-DD. Si une info est introuvable mets null.' },
            ],
          }],
        }),
      })

      const data   = await res.json()
      const result = JSON.parse(data.content?.[0]?.text || '{}')

      if (result.montant)    setMontant(String(result.montant))
      if (result.date)       setDate(result.date)
      if (result.type && ['carburant', 'materiau', 'repas', 'autre'].includes(result.type)) setType(result.type)
      if (result.description) setDescription(result.description)

    } catch (e) {
      console.warn('Scan IA échoué :', e)
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      let uploadedUrl = null
      if (STORAGE_ENABLED && photo) {
        const r = ref(storage, `tickets/${user.uid}/${Date.now()}_${photo.name}`)
        await uploadBytes(r, photo)
        uploadedUrl = await getDownloadURL(r)
      }
      await addDoc(collection(db, 'tickets'), {
        type, chantierId, ouvrierId: user.uid,
        date: new Date(date),
        montant: parseFloat(montant) || 0,
        description,
        photoUrl: uploadedUrl,
        statut:   'en_attente',
        createdAt: serverTimestamp(),
      })
      onClose()
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 20 }}>
      <button onClick={onClose} style={{ marginBottom: 16, background: 'transparent', border: 'none', color: '#0d3580', fontSize: 14, cursor: 'pointer', fontWeight: '500' }}>← Retour</button>
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #0d3580', padding: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: '0 0 16px' }}>Scanner un ticket</h2>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, background: photoUrl ? 'transparent' : '#F0F2F7', border: '2px dashed #0d3580', borderRadius: 12, padding: photoUrl ? 0 : 28, cursor: 'pointer', marginBottom: 14, overflow: 'hidden' }}>
          {photoUrl
            ? <img src={photoUrl} style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 10 }} />
            : <>
                <CameraAltIcon style={{ fontSize: 36, color: '#0d3580' }} />
                <span style={{ fontSize: 14, fontWeight: '500', color: '#0d3580' }}>{scanning ? 'Analyse OCR en cours…' : 'Prendre une photo'}</span>
              </>
          }
          <input type="file" accept="image/*" capture="environment" onChange={e => handlePhoto(e.target.files[0])} style={{ display: 'none' }} />
        </label>

        {scanning && <p style={{ fontSize: 12, color: '#d97706', textAlign: 'center', margin: '0 0 12px' }}>⏳ Analyse IA en cours…</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Montant (€)"><input type="number" step="0.01" value={montant} onChange={e => setMontant(e.target.value)} style={inpS} placeholder="0.00" /></Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inpS} /></Field>
          </div>
          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value)} style={inpS}>
              {[['carburant', 'Carburant'], ['materiau', 'Matériau'], ['repas', 'Repas'], ['autre', 'Autre']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Chantier">
            <select value={chantierId} onChange={e => setChantierId(e.target.value)} style={inpS}>
              <option value="">— Choisir —</option>
              {chantiers.filter(c => c.statut === 'en_cours').map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Description"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Plein de carburant, matériaux…" style={inpS} /></Field>
        </div>

        <button onClick={handleSave} disabled={saving || !montant} style={{ width: '100%', marginTop: 16, background: !montant ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: 14, fontSize: 15, fontWeight: '600', cursor: !montant ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Envoi…' : 'Valider le ticket'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inpS = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', outline: 'none' }
