import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithEmail, resetPassword } from '../../firebase/auth'
import ConstructionIcon from '@mui/icons-material/Construction'
import EmailIcon        from '@mui/icons-material/Email'
import LockIcon         from '@mui/icons-material/Lock'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email, password)
      navigate('/dashboard')
    } catch (err) {
      const messages = {
        'auth/invalid-credential':   'Email ou mot de passe incorrect.',
        'auth/user-not-found':       'Aucun compte trouvé avec cet email.',
        'auth/wrong-password':       'Mot de passe incorrect.',
        'auth/too-many-requests':    'Trop de tentatives. Réessayez plus tard.',
        'Compte désactivé':          'Votre compte a été désactivé.',
      }
      setError(messages[err.code] || err.message || 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     '#F7F8FA',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        24,
      fontFamily:     'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width:          64,
            height:         64,
            background:     '#0d3580',
            borderRadius:   16,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            margin:         '0 auto 16px',
          }}>
            <ConstructionIcon style={{ fontSize: 36, color: '#ffffff' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: '700', color: '#111111', margin: '0 0 4px' }}>
            Scaffold-OS
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            ERP Échafaudage — Connexion
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          <div style={{
            background:    '#FFFFFF',
            borderRadius:  16,
            border:        '1.5px solid #0d3580',
            padding:       '28px 24px',
          }}>
            {error && (
              <div style={{
                background: '#fee2e2', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '10px 14px', marginBottom: 20,
                fontSize: 13, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <EmailIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#0d3580' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#F0F2F7', border: '1.5px solid transparent',
                    borderRadius: 8, padding: '10px 12px 10px 36px',
                    fontSize: 14, color: '#111111', outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <LockIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#0d3580' }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#F0F2F7', border: '1.5px solid transparent',
                    borderRadius: 8, padding: '10px 12px 10px 36px',
                    fontSize: 14, color: '#111111', outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: loading ? '#6b7280' : '#0d3580',
                color: '#ffffff', border: 'none', borderRadius: 8,
                padding: '12px 20px', fontSize: 15, fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
              }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>

            <button
              type="button"
              onClick={async () => {
                setError(''); setResetMsg('')
                if (!email) { setError('Entrez votre email pour réinitialiser.'); return }
                try {
                  await resetPassword(email)
                  setResetMsg('Un email de réinitialisation a été envoyé.')
                } catch {
                  setError('Impossible d\'envoyer l\'email. Vérifiez l\'adresse.')
                }
              }}
              style={{
                width: '100%', marginTop: 10, background: 'transparent',
                color: '#0d3580', border: 'none', fontSize: 13,
                cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Mot de passe oublié ?
            </button>

            {resetMsg && (
              <div style={{
                background: '#dcfce7', border: '1px solid #86efac',
                borderRadius: 8, padding: '10px 14px', marginTop: 12,
                fontSize: 13, color: '#16a34a',
              }}>
                {resetMsg}
              </div>
            )}
          </div>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
          Scaffold-OS v1.0 — Accès réservé au personnel autorisé
        </p>
      </div>
    </div>
  )
}
