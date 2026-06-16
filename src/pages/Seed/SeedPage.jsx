import { useState } from 'react'
import { runSeed, resetSeed } from '../../firebase/seedRunner'
import SeedIcon    from '@mui/icons-material/PlayArrow'
import ResetIcon   from '@mui/icons-material/DeleteSweep'
import CheckIcon   from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'

export default function SeedPage() {
  const [logs,    setLogs]    = useState([])
  const [running, setRunning] = useState(false)
  const [done,    setDone]    = useState(null) // 'seed' | 'reset' | 'exists'

  function log(msg) {
    setLogs(prev => [...prev, msg])
  }

  async function handleSeed() {
    if (!window.confirm('Injecter les données fictives dans Firebase ? (Spark plan — vraie base)')) return
    setLogs([])
    setDone(null)
    setRunning(true)
    try {
      const result = await runSeed(log)
      if (result.alreadySeeded) {
        setDone('exists')
        log('⚠️ Les données de seed sont déjà présentes. Faites un Reset avant de relancer.')
      } else {
        setDone('seed')
      }
    } catch (e) {
      log('❌ Erreur : ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  async function handleReset() {
    if (!window.confirm('Supprimer TOUTES les données marquées _seed:true ? Cette action est irréversible.')) return
    setLogs([])
    setDone(null)
    setRunning(true)
    try {
      await resetSeed(log)
      setDone('reset')
    } catch (e) {
      log('❌ Erreur : ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 32 }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#0d3580', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: '0 0 4px' }}>🌱 Page de Seed — Test</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
            Injecte des données fictives dans Firebase pour les tests. Ne jamais utiliser en production.
          </p>
        </div>

        {/* Comptes de test */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '18px 20px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
            Comptes de test créés
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2e4ea' }}>
                {['Rôle', 'Email', 'Mot de passe'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Patron',    'patron@scaffold-test.fr',    'Test1234!', '#0d3580'],
                ['Chef',      'chef@scaffold-test.fr',      'Test1234!', '#16a34a'],
                ['Ouvrier',   'ouvrier@scaffold-test.fr',   'Test1234!', '#d97706'],
                ['Comptable', 'comptable@scaffold-test.fr', 'Test1234!', '#7c3aed'],
              ].map(([role, email, mdp, color]) => (
                <tr key={role} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px', fontWeight: '600', color }}>{role}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 12 }}>{email}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{mdp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Données injectées */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e2e4ea', padding: '18px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Données injectées</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              ['Clients', '3 (Dupont, Martin, Renaud)'],
              ['Chantiers', '3 (en cours + en attente)'],
              ['Factures', '5 (FAC-2025-001 à 005)'],
              ['Ouvriers', '3 fictifs + 4 comptes Auth'],
              ['Pointages', '7 entrées (lun–mer S24)'],
              ['Stock', '3 articles (2 alertes)'],
              ['Trésorerie', '8 mouvements juin 2026'],
              ['Solde', '24 310 € (38 240 enc. / 13 930 déc.)'],
            ].map(([label, val]) => (
              <div key={label} style={{ background: '#F7F8FA', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 2px', letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: 12, color: '#111111', margin: 0 }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button
            onClick={handleSeed}
            disabled={running}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: running ? '#f3f4f6' : '#0d3580', color: running ? '#9ca3af' : '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: '600', cursor: running ? 'not-allowed' : 'pointer' }}
          >
            <SeedIcon style={{ fontSize: 20 }} />
            {running ? 'En cours…' : 'Injecter les données de test'}
          </button>
          <button
            onClick={handleReset}
            disabled={running}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: running ? '#f3f4f6' : '#fee2e2', color: running ? '#9ca3af' : '#dc2626', border: 'none', borderRadius: 10, padding: '13px 18px', fontSize: 13, fontWeight: '600', cursor: running ? 'not-allowed' : 'pointer' }}
          >
            <ResetIcon style={{ fontSize: 18 }} />Reset
          </button>
        </div>

        {/* Résultat */}
        {done === 'seed' && (
          <div style={{ background: '#dcfce7', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckIcon style={{ color: '#16a34a', fontSize: 22 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: '600', color: '#15803d', margin: 0 }}>Seed injecté avec succès !</p>
              <p style={{ fontSize: 12, color: '#16a34a', margin: '2px 0 0' }}>Connecte-toi avec les comptes de test ci-dessus.</p>
            </div>
          </div>
        )}
        {done === 'reset' && (
          <div style={{ background: '#fef3c7', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <WarningIcon style={{ color: '#d97706', fontSize: 22 }} />
            <p style={{ fontSize: 14, fontWeight: '600', color: '#92400e', margin: 0 }}>Données de seed supprimées.</p>
          </div>
        )}
        {done === 'exists' && (
          <div style={{ background: '#fef9c3', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <WarningIcon style={{ color: '#ca8a04', fontSize: 22 }} />
            <p style={{ fontSize: 14, fontWeight: '600', color: '#713f12', margin: 0 }}>Seed déjà présent — faites un Reset avant de relancer.</p>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div style={{ background: '#0d3580', borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Logs</p>
            {logs.map((l, i) => (
              <p key={i} style={{ fontSize: 12, color: '#a5f3fc', margin: '2px 0', fontFamily: 'monospace' }}>{l}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
