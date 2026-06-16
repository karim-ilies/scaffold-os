import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../hooks/useAuth'
import LocationOnIcon  from '@mui/icons-material/LocationOn'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon      from '@mui/icons-material/Cancel'

export default function PermissionGPS() {
  const navigate      = useNavigate()
  const { user }      = useAuth()
  const [saving, setSaving] = useState(false)

  async function repondre(autorise) {
    setSaving(true)
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), { gpsAutorise: autorise })
      }
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F8FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Icône */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#e8edf8', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <LocationOnIcon style={{ fontSize: 40, color: '#0d3580' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: '700', color: '#0d3580', margin: '0 0 8px' }}>
            Localisation GPS
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            Scaffold-OS utilise votre position pour vérifier la présence sur le chantier lors du pointage.
          </p>
        </div>

        {/* Carte */}
        <div style={{
          background: '#fff', borderRadius: 16,
          border: '1.5px solid #0d3580', padding: '24px 20px',
          boxShadow: '0 4px 24px rgba(13,53,128,0.08)',
        }}>
          {/* Détails */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {[
              { titre: 'Quand ?',   texte: 'Uniquement pendant vos heures de pointage' },
              { titre: 'Pourquoi ?', texte: 'Valider automatiquement votre présence sur chantier' },
              { titre: 'Qui voit ?', texte: 'Uniquement votre patron, jamais partagé à des tiers' },
            ].map(({ titre, texte }) => (
              <div key={titre} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d3580', marginTop: 6, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: '600', color: '#111111' }}>{titre} </span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{texte}</span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: '0 0 20px', fontStyle: 'italic' }}>
            Vous pouvez modifier ce choix à tout moment dans votre profil.
          </p>

          {/* Boutons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => repondre(true)}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#0d3580', color: '#fff', border: 'none',
                borderRadius: 10, padding: 14, fontSize: 15, fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              <CheckCircleIcon style={{ fontSize: 20 }} />
              Autoriser la localisation
            </button>

            <button
              onClick={() => repondre(false)}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#f3f4f6', color: '#6b7280', border: '1.5px solid #e2e4ea',
                borderRadius: 10, padding: 14, fontSize: 15, fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <CancelIcon style={{ fontSize: 20 }} />
              Continuer sans GPS
            </button>

            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '4px 0 0' }}>
              Vous aurez accès à toutes les fonctionnalités dans les deux cas.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
          Scaffold-OS — Vos données restent confidentielles
        </p>
      </div>
    </div>
  )
}
