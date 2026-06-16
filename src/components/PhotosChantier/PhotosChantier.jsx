import { useState, useRef } from 'react'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, STORAGE_ENABLED } from '../../firebase/config'
import { useAuth } from '../../hooks/useAuth'
import { useResponsive } from '../../hooks/useResponsive'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import CloseIcon             from '@mui/icons-material/Close'
import DeleteIcon            from '@mui/icons-material/Delete'
import ZoomInIcon            from '@mui/icons-material/ZoomIn'
import CheckCircleIcon       from '@mui/icons-material/CheckCircle'
import WarningIcon           from '@mui/icons-material/Warning'

const ETAPES = [
  { key: 'debut',    label: 'Début',    minFin: 1 },
  { key: 'en_cours', label: 'En cours', minFin: 1 },
  { key: 'fin',      label: 'Fin',      minFin: 2 },
]

export default function PhotosChantier({ chantier }) {
  const { user, isPatron } = useAuth()
  const { isMobile }       = useResponsive()
  const [etape, setEtape]  = useState('debut')
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const inputRef   = useRef(null)

  const photos = chantier?.photos || []
  const photosByEtape = key => photos.filter(p => p.etape === key)
  const photosFin     = photosByEtape('fin')

  function etapeLabel(key) {
    const count = photosByEtape(key).length
    const cfg   = ETAPES.find(e => e.key === key)
    if (key === 'fin') {
      const ok = count >= 2
      return `${cfg.label} ${ok ? '✓' : '⚠'} ${count} photo${count !== 1 ? 's' : ''}`
    }
    return `${cfg.label} · ${count} photo${count !== 1 ? 's' : ''}`
  }

  function etapeBadgeColor(key) {
    if (key === 'fin') return photosByEtape('fin').length >= 2 ? '#16a34a' : '#dc2626'
    return photosByEtape(key).length >= 1 ? '#16a34a' : '#6b7280'
  }

  async function compressAndUpload(file) {
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo trop grande (max 5 MB)')
      return
    }

    setUploading(true)
    setProgress(10)

    try {
      // Compression canvas
      const compressed = await compressImage(file, 1200, 0.8)
      setProgress(40)

      const path   = `photos/${chantier.id}/${etape}/${Date.now()}_${user.uid}.jpg`
      const storRef = ref(storage, path)
      await uploadBytes(storRef, compressed)
      setProgress(80)
      const url = await getDownloadURL(storRef)
      setProgress(95)

      const photoObj = {
        id:        `${Date.now()}_${user.uid}`,
        url,
        etape,
        auteurId:  user.uid,
        auteurNom: `${user.prenom || ''} ${user.nom || ''}`.trim(),
        date:      new Date().toISOString(),
        note:      null,
        taille:    compressed.size,
      }

      await updateDoc(doc(db, 'chantiers', chantier.id), {
        photos: arrayUnion(photoObj),
      })
      setProgress(100)
    } catch (err) {
      alert('Erreur upload : ' + err.message)
    } finally {
      setUploading(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(photo) {
    const canDelete = isPatron || photo.auteurId === user?.uid
    if (!canDelete) return
    if (!confirm('Supprimer cette photo ?')) return
    await updateDoc(doc(db, 'chantiers', chantier.id), {
      photos: arrayRemove(photo),
    })
    setLightbox(null)
  }

  const currentPhotos = photosByEtape(etape)
  const totalBytes    = photos.reduce((s, p) => s + (p.taille || 0), 0)
  const totalMb       = (totalBytes / (1024 * 1024)).toFixed(1)
  const cols          = isMobile ? 2 : 3

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Onglets étapes */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {ETAPES.map(e => (
          <button
            key={e.key}
            onClick={() => setEtape(e.key)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none',
              fontSize: 12, fontWeight: etape === e.key ? '600' : '500',
              background: etape === e.key ? '#0d3580' : '#f3f4f6',
              color: etape === e.key ? '#fff' : '#374151',
              cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: `2px solid ${etapeBadgeColor(e.key)}`,
            }}
          >
            {etapeLabel(e.key)}
          </button>
        ))}
      </div>

      {/* Alerte fin obligatoire */}
      {etape === 'fin' && photosFin.length < 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626', fontWeight: '500' }}>
          <WarningIcon style={{ fontSize: 18 }} />
          Ajoutez au moins 2 photos de fin pour clôturer le chantier
        </div>
      )}
      {etape === 'fin' && photosFin.length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#dcfce7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#16a34a', fontWeight: '500' }}>
          <CheckCircleIcon style={{ fontSize: 18 }} />
          Photos de fin suffisantes — clôture possible
        </div>
      )}

      {/* Barre de progression upload */}
      {uploading && (
        <div style={{ background: '#e8edf8', borderRadius: 6, height: 6, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#0d3580', width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      )}

      {/* Grille photos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
      }}>
        {currentPhotos.map(photo => (
          <div
            key={photo.id}
            onClick={() => setLightbox(photo)}
            style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#f3f4f6' }}
          >
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              padding: '12px 6px 6px',
            }}>
              <p style={{ fontSize: 10, color: '#fff', margin: 0, fontWeight: '500' }}>{photo.auteurNom}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                {photo.date ? new Date(photo.date).toLocaleDateString('fr-FR') : ''}
              </p>
            </div>
            <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 4, display: 'flex' }}>
              <ZoomInIcon style={{ fontSize: 14, color: '#fff' }} />
            </div>
          </div>
        ))}

        {/* Bouton ajouter */}
        {STORAGE_ENABLED ? (
          <>
            <div
              onClick={() => !uploading && inputRef.current?.click()}
              style={{
                aspectRatio: '1', borderRadius: 10,
                border: '2px dashed #0d3580', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer', gap: 6, background: '#f7f8fa',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <AddPhotoAlternateIcon style={{ fontSize: 28, color: '#0d3580' }} />
              <span style={{ fontSize: 11, color: '#0d3580', fontWeight: '600', textAlign: 'center' }}>
                {uploading ? 'Envoi…' : '+ Ajouter'}
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) compressAndUpload(f) }}
            />
          </>
        ) : (
          <div style={{
            aspectRatio: '1', borderRadius: 10,
            border: '2px dashed #d1d5db', display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, background: '#f9fafb', opacity: 0.7,
          }}>
            <AddPhotoAlternateIcon style={{ fontSize: 28, color: '#9ca3af' }} />
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: '500', textAlign: 'center', padding: '0 6px' }}>
              Photos non disponibles
            </span>
          </div>
        )}
      </div>

      {/* Volume stockage */}
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>
        {photos.length} photo{photos.length !== 1 ? 's' : ''} · {totalMb} MB utilisés
      </p>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setLightbox(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* Header */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: '600', color: '#fff', margin: 0 }}>{lightbox.auteurNom}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                {lightbox.etape} · {lightbox.date ? new Date(lightbox.date).toLocaleDateString('fr-FR') : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(isPatron || lightbox.auteurId === user?.uid) && (
                <button
                  onClick={() => handleDelete(lightbox)}
                  style={{ background: 'rgba(220,38,38,0.2)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}
                >
                  <DeleteIcon style={{ fontSize: 18, color: '#ef4444' }} />
                </button>
              )}
              <button
                onClick={() => setLightbox(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}
              >
                <CloseIcon style={{ fontSize: 18, color: '#fff' }} />
              </button>
            </div>
          </div>

          {/* Image */}
          <img
            src={lightbox.url}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }}
          />
          {lightbox.note && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>{lightbox.note}</p>
          )}
        </div>
      )}
    </div>
  )
}

async function compressImage(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Compression échouée'))
      }, 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
