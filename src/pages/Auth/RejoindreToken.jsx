import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { db, auth } from '../../firebase/config'
import LockIcon          from '@mui/icons-material/Lock'
import CheckCircleIcon   from '@mui/icons-material/CheckCircle'
import WarningIcon       from '@mui/icons-material/Warning'

export default function RejoindreToken() {
  const { token }    = useParams()
  const navigate     = useNavigate()
  const [invitation, setInvitation] = useState(null)
  const [statut,     setStatut]     = useState('loading') // loading | valid | invalide | expire | deja_accepte
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'invitations', token))
        if (!snap.exists()) { setStatut('invalide'); return }
        const inv = snap.data()
        setInvitation(inv)
        if (inv.statut === 'accepte')           { setStatut('deja_accepte'); return }
        const exp = inv.expiresAt?.toDate ? inv.expiresAt.toDate() : new Date(inv.expiresAt)
        if (exp < new Date())                   { setStatut('expire'); return }
        setStatut('valid')
      } catch {
        setStatut('invalide')
      }
    }
    load()
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6)          { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm)         { setError('Les mots de passe ne correspondent pas.'); return }

    setSaving(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, invitation.email, password)

      await updateProfile(cred.user, { displayName: `${invitation.prenom} ${invitation.nom}` })

      await setDoc(doc(db, 'users', cred.user.uid), {
        nom:             invitation.nom,
        prenom:          invitation.prenom,
        email:           invitation.email,
        telephone:       invitation.telephone || null,
        role:            invitation.role,
        actif:           true,
        gpsAutorise:     false,
        dateInscription: serverTimestamp(),
        createdAt:       serverTimestamp(),
        updatedAt:       serverTimestamp(),
      })

      await updateDoc(doc(db, 'invitations', token), {
        statut:    'accepte',
        accepteAt: serverTimestamp(),
        uid:       cred.user.uid,
      })

      navigate('/permission-gps')
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'Ce numéro de téléphone est déjà utilisé.',
        'auth/weak-password':        'Mot de passe trop faible.',
      }
      setError(msgs[err.code] || err.message)
    } finally {
      setSaving(false)
    }
  }

  const ROLE_LABELS = { patron: 'Patron', chef_equipe: 'Chef d\'équipe', ouvrier: 'Ouvrier', comptable: 'Comptable' }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 28, margin: '0 0 4px' }}>🏗</p>
          <h1 style={{ fontSize: 22, fontWeight: '700', color: '#0d3580', margin: 0 }}>Scaffold-OS</h1>
        </div>

        {statut === 'loading' && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Vérification de l'invitation…</div>
        )}

        {statut === 'invalide' && (
          <Card>
            <WarningIcon style={{ fontSize: 40, color: '#dc2626', display: 'block', margin: '0 auto 12px' }} />
            <p style={titleS}>Invitation invalide</p>
            <p style={subS}>Ce lien n'existe pas ou a déjà été utilisé.</p>
          </Card>
        )}

        {statut === 'expire' && (
          <Card>
            <WarningIcon style={{ fontSize: 40, color: '#d97706', display: 'block', margin: '0 auto 12px' }} />
            <p style={titleS}>Invitation expirée</p>
            <p style={subS}>Ce lien n'est valable que 48h. Demandez à votre patron d'en générer un nouveau.</p>
          </Card>
        )}

        {statut === 'deja_accepte' && (
          <Card>
            <CheckCircleIcon style={{ fontSize: 40, color: '#16a34a', display: 'block', margin: '0 auto 12px' }} />
            <p style={titleS}>Compte déjà créé</p>
            <p style={subS}>Vous avez déjà accepté cette invitation. Connectez-vous directement.</p>
            <button onClick={() => navigate('/login')} style={{ ...btnS, marginTop: 16 }}>Se connecter</button>
          </Card>
        )}

        {statut === 'valid' && invitation && (
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8edf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: '700', color: '#0d3580' }}>
                {invitation.prenom?.[0]}{invitation.nom?.[0]}
              </div>
              <p style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>
                Bonjour, {invitation.prenom} !
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                {invitation.entrepriseNom} · {ROLE_LABELS[invitation.role] || invitation.role}
              </p>
            </div>

            <p style={{ fontSize: 14, color: '#3d3d3d', textAlign: 'center', marginBottom: 20 }}>
              Choisissez un mot de passe pour accéder à l'application.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Votre email (identifiant de connexion)">
                <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#6b7280' }}>{invitation.email}</div>
              </Field>
              <Field label="Mot de passe *">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" style={inpS} required autoFocus />
              </Field>
              <Field label="Confirmer le mot de passe *">
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Répéter le mot de passe" style={inpS} required />
              </Field>

              {error && (
                <div style={{ background: '#fee2e2', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WarningIcon style={{ fontSize: 16 }} />{error}
                </div>
              )}

              <button type="submit" disabled={saving} style={{ ...btnS, marginTop: 4, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                <LockIcon style={{ fontSize: 18 }} />
                {saving ? 'Création du compte…' : 'Créer mon compte'}
              </button>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #0d3580', padding: '28px 24px', boxShadow: '0 4px 24px rgba(13,53,128,0.08)', textAlign: 'center' }}>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const titleS = { fontSize: 18, fontWeight: '700', color: '#111111', margin: '0 0 8px' }
const subS   = { fontSize: 13, color: '#6b7280', margin: 0 }
const btnS   = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: '600', cursor: 'pointer' }
const inpS   = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111111', outline: 'none', fontFamily: 'inherit' }
