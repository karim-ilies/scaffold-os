import { useState, useEffect, useRef } from 'react'
import { collection, query, orderBy, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, STORAGE_ENABLED } from '../../firebase/config'
import CameraAltIcon   from '@mui/icons-material/CameraAlt'
import DeleteIcon      from '@mui/icons-material/Delete'
import AddPhotoIcon    from '@mui/icons-material/AddPhotoAlternate'
import CloseIcon       from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'

export default function TabPhotos({ chantierId, chantierNom, user, isPatron }) {
  const [photos,    setPhotos]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview,   setPreview]   = useState(null) // photo agrandie
  const inputRef = useRef()

  useEffect(() => {
    const q     = query(
      collection(db, 'photos_chantier'),
      where('chantierId', '==', chantierId),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q,
      snap => { setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      ()   => { setPhotos([]); setLoading(false) }
    )
    return unsub
  }, [chantierId])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      let photoUrl = null
      let storagePath = null
      if (STORAGE_ENABLED) {
        storagePath = `photos_chantier/${chantierId}/${Date.now()}_${file.name}`
        const r = ref(storage, storagePath)
        await uploadBytes(r, file)
        photoUrl = await getDownloadURL(r)
      } else {
        // Aperçu local uniquement (pas de stockage cloud)
        photoUrl = URL.createObjectURL(file)
      }
      await addDoc(collection(db, 'photos_chantier'), {
        chantierId,
        chantierNom,
        auteurId:   user.uid,
        auteurNom:  `${user.prenom || ''} ${user.nom || ''}`.trim(),
        photoUrl,
        storagePath: storagePath || null,
        createdAt:  serverTimestamp(),
      })
    } catch (err) {
      alert('Erreur upload : ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(photo) {
    if (!window.confirm('Supprimer cette photo ?')) return
    try {
      if (STORAGE_ENABLED && photo.storagePath) {
        await deleteObject(ref(storage, photo.storagePath))
      }
      await deleteDoc(doc(db, 'photos_chantier', photo.id))
    } catch (err) {
      alert('Erreur suppression : ' + err.message)
    }
  }

  if (!STORAGE_ENABLED) return (
    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
      <CloudUploadIcon style={{ fontSize: 52, color: '#c8d3ee', marginBottom: 12 }} />
      <p style={{ fontSize: 15, fontWeight: '600', color: '#374151', margin: '0 0 6px' }}>Photos non disponibles</p>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
        Activez le plan Blaze Firebase et passez <code>STORAGE_ENABLED = true</code> dans <code>src/firebase/config.js</code> pour activer les photos.
      </p>
    </div>
  )

  return (
    <div style={{ padding: '16px 0 80px' }}>
      {/* Bouton ajouter */}
      <div style={{ padding: '0 16px 16px' }}>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', background: uploading ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: '600', cursor: uploading ? 'not-allowed' : 'pointer' }}
        >
          <CameraAltIcon style={{ fontSize: 20 }} />
          {uploading ? 'Envoi en cours…' : 'Prendre / Ajouter une photo'}
        </button>
      </div>

      {/* Grille photos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>Chargement…</div>
      ) : photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <AddPhotoIcon style={{ fontSize: 48, color: '#c8d3ee', marginBottom: 8 }} />
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>Aucune photo pour ce chantier</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '0 16px' }}>
          {photos.map(p => (
            <div key={p.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1.5px solid #e2e4ea', background: '#f3f4f6' }}>
              <img
                src={p.photoUrl}
                alt="Photo chantier"
                onClick={() => setPreview(p)}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
              />
              <div style={{ padding: '6px 8px', background: '#fff' }}>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{p.auteurNom}</p>
                <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
                  {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
              </div>
              {(isPatron || p.auteurId === user?.uid) && (
                <button
                  onClick={() => handleDelete(p)}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <DeleteIcon style={{ fontSize: 16, color: '#fff' }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <button onClick={() => setPreview(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
            <CloseIcon style={{ fontSize: 24, color: '#fff' }} />
          </button>
          <img src={preview.photoUrl} alt="Aperçu" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 10 }} />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            {preview.auteurNom} · {preview.createdAt?.toDate ? preview.createdAt.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}
          </p>
        </div>
      )}
    </div>
  )
}
