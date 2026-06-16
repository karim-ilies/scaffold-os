import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import emailjs from '@emailjs/browser'
import { db } from '../../firebase/config'
import { useParametres } from '../../hooks/useParametres'
import ArrowBackIcon   from '@mui/icons-material/ArrowBack'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon       from '@mui/icons-material/Check'
import SendIcon        from '@mui/icons-material/Send'
import EmailIcon       from '@mui/icons-material/Email'
import WarningIcon     from '@mui/icons-material/Warning'

// ─── Clés EmailJS ────────────────────────────────────────────────────────────
// Créer un compte sur emailjs.com (gratuit), puis remplacer ces 3 valeurs.
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || ''
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || ''
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || ''
const EMAILJS_CONFIGURED  = EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY

const ROLES = [
  { value: 'ouvrier',     label: 'Ouvrier' },
  { value: 'chef_equipe', label: "Chef d'équipe" },
  { value: 'comptable',   label: 'Comptable' },
]

export default function InviterPage() {
  const navigate           = useNavigate()
  const { parametres }     = useParametres()
  const [prenom,    setPrenom]    = useState('')
  const [nom,       setNom]       = useState('')
  const [telephone, setTelephone] = useState('')
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState('ouvrier')
  const [saving,    setSaving]    = useState(false)
  const [lien,      setLien]      = useState(null)
  const [token,     setToken]     = useState(null)
  const [copie,     setCopie]     = useState(false)
  const [emailStatut, setEmailStatut] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [error,     setError]     = useState('')

  const entrepriseNom = parametres?.nom || 'Scaffold-OS'

  async function handleInviter() {
    if (!prenom.trim() || !nom.trim() || !email.trim()) {
      setError('Prénom, nom et email sont obligatoires.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const t         = crypto.randomUUID().replace(/-/g, '')
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)
      const lienGen   = `${window.location.origin}/rejoindre/${t}`

      await setDoc(doc(db, 'invitations', t), {
        prenom:        prenom.trim(),
        nom:           nom.trim(),
        telephone:     telephone.trim(),
        email:         email.trim() || null,
        role,
        entrepriseNom,
        statut:        'en_attente',
        expiresAt,
        createdAt:     serverTimestamp(),
      })

      setToken(t)
      setLien(lienGen)
    } catch (err) {
      setError('Erreur : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  function copierLien() {
    navigator.clipboard.writeText(lien)
    setCopie(true)
    setTimeout(() => setCopie(false), 2500)
  }

  async function envoyerEmail() {
    if (!email.trim()) return
    setEmailStatut('sending')
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email:  email.trim(),
          to_name:   `${prenom} ${nom}`,
          from_name: entrepriseNom,
          sujet:     `Invitation à rejoindre ${entrepriseNom}`,
          corps:     `Vous avez été invité(e) à rejoindre l'équipe en tant que ${ROLES.find(r => r.value === role)?.label || role}.\n\nVotre lien d'invitation (valide 48 heures) :\n${lien}`,
        },
        EMAILJS_PUBLIC_KEY,
      )

      await updateDoc(doc(db, 'invitations', token), {
        emailEnvoye:   true,
        emailEnvoyeAt: serverTimestamp(),
      })

      setEmailStatut('sent')
    } catch (err) {
      console.error('EmailJS error:', err)
      setEmailStatut('error')
    }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: '#F0F2F7', border: '1.5px solid transparent',
    borderRadius: 8, padding: '11px 14px', fontSize: 14,
    color: '#111111', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 20px 20px' }}>
        <button
          onClick={() => navigate('/personnel')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', marginBottom: 14 }}
        >
          <ArrowBackIcon style={{ fontSize: 16 }} />Personnel
        </button>
        <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Inviter un employé</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
          Un lien d'invitation valable 48h sera généré.
        </p>
      </div>

      <div style={{ padding: 20 }}>
        {!lien ? (
          /* ── Formulaire ── */
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #0d3580', padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelS}>Prénom *</label>
                  <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Mohamed" style={inp} />
                </div>
                <div>
                  <label style={labelS}>Nom *</label>
                  <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont" style={inp} />
                </div>
              </div>

              <div>
                <label style={labelS}>Email * (identifiant de connexion)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="employe@email.fr" type="email" style={inp} />
              </div>

              <div>
                <label style={labelS}>Téléphone (optionnel)</label>
                <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="0612345678" type="tel" style={inp} />
              </div>

              <div>
                <label style={labelS}>Rôle</label>
                <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {error && (
                <div style={{ background: '#fee2e2', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: '500', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <WarningIcon style={{ fontSize: 16 }} />{error}
                </div>
              )}

              <button
                onClick={handleInviter}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: saving ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4 }}
              >
                <SendIcon style={{ fontSize: 18 }} />
                {saving ? 'Génération…' : "Générer l'invitation"}
              </button>
            </div>
          </div>

        ) : (
          /* ── Après génération ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Bandeau succès */}
            <div style={{ background: '#dcfce7', borderRadius: 12, border: '1.5px solid #16a34a', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckIcon style={{ fontSize: 26, color: '#16a34a', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 15, fontWeight: '700', color: '#15803d', margin: 0 }}>Invitation créée !</p>
                <p style={{ fontSize: 13, color: '#166534', margin: '2px 0 0' }}>
                  Pour <strong>{prenom} {nom}</strong> — valable 48h
                </p>
              </div>
            </div>

            {/* Envoi par email */}
            {email && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #0d3580', padding: 18 }}>
                <p style={labelS}>Envoyer par email</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <EmailIcon style={{ fontSize: 18, color: '#6b7280' }} />
                  <span style={{ fontSize: 14, color: '#374151' }}>{email}</span>
                </div>

                {emailStatut === null && EMAILJS_CONFIGURED && (
                  <button
                    onClick={envoyerEmail}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: '600', cursor: 'pointer' }}
                  >
                    <EmailIcon style={{ fontSize: 18 }} />Envoyer l'invitation par email
                  </button>
                )}

                {emailStatut === null && !EMAILJS_CONFIGURED && (
                  <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#854d0e' }}>
                    <p style={{ margin: '0 0 6px', fontWeight: '600' }}>EmailJS non configuré</p>
                    <p style={{ margin: 0 }}>Ajoutez <code>VITE_EMAILJS_SERVICE_ID</code>, <code>VITE_EMAILJS_TEMPLATE_ID</code> et <code>VITE_EMAILJS_PUBLIC_KEY</code> dans votre <code>.env.local</code>.</p>
                  </div>
                )}

                {emailStatut === 'sending' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 16px', background: '#e8edf8', borderRadius: 8, fontSize: 14, color: '#0d3580', fontWeight: '500' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #0d3580', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Envoi en cours…
                  </div>
                )}

                {emailStatut === 'sent' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#dcfce7', border: '1.5px solid #16a34a', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#15803d', fontWeight: '600' }}>
                    <CheckIcon style={{ fontSize: 20 }} />
                    Email envoyé avec succès à {email}
                  </div>
                )}

                {emailStatut === 'error' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#dc2626', fontWeight: '500' }}>
                      <WarningIcon style={{ fontSize: 18 }} />Échec de l'envoi — vérifiez la configuration EmailJS
                    </div>
                    <button
                      onClick={envoyerEmail}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#f3f4f6', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}
                    >
                      Réessayer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Lien à copier */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e4ea', padding: 18 }}>
              <p style={labelS}>Lien d'invitation (copier / partager)</p>
              <div style={{ background: '#F0F2F7', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#374151', wordBreak: 'break-all', marginBottom: 12 }}>
                {lien}
              </div>
              <button
                onClick={copierLien}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: copie ? '#dcfce7' : '#e8edf8', color: copie ? '#16a34a' : '#0d3580', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: '600', cursor: 'pointer' }}
              >
                {copie ? <CheckIcon style={{ fontSize: 18 }} /> : <ContentCopyIcon style={{ fontSize: 18 }} />}
                {copie ? 'Copié !' : 'Copier le lien'}
              </button>
            </div>

            {/* Instructions */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e4ea', padding: 18 }}>
              <p style={{ fontSize: 13, fontWeight: '600', color: '#374151', margin: '0 0 10px' }}>Comment ça marche ?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  "L'employé reçoit le lien par email ou SMS/WhatsApp",
                  "Il clique le lien et choisit son mot de passe",
                  "Son compte est créé automatiquement avec le bon rôle",
                  "Il se connecte avec son email + mot de passe",
                ].map((txt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d3580', color: '#fff', fontSize: 12, fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{txt}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate('/personnel')}
              style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: '600', cursor: 'pointer' }}
            >
              Retour à la liste
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const labelS = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }
