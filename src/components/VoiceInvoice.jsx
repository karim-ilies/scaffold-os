import { useState, useRef } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '../firebase/config'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import CloseIcon from '@mui/icons-material/Close'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

export function VoiceButton({ onClick }) {
  if (!SpeechRecognition) return null

  return (
    <button
      onClick={onClick}
      style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg, #0d3580, #1a4ba0)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(13,53,128,0.35)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(13,53,128,0.45)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,53,128,0.35)' }}
      title="Facture vocale"
    >
      <MicIcon style={{ fontSize: 26, color: '#fff' }} />
    </button>
  )
}

export function VoiceInvoiceModal({ clients, chantiers, onClose, onResult }) {
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const listeningRef = useRef(false)
  const allTextRef = useRef('')

  function startListening() {
    setError(null)
    const prevText = phase === 'idle' ? '' : transcript.trim()
    if (phase === 'idle') { setTranscript(''); setResult(null) }
    setPhase('listening')

    const recognition = new SpeechRecognition()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setTranscript(prevText ? (prevText + ' ' + text).trim() : text.trim())
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed') setError('Microphone non autorisé.')
      else setError(`Erreur : ${e.error}`)
      setPhase('idle')
    }

    recognition.onend = () => {
      setPhase('stopped')
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopListening() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    setPhase('stopped')
  }

  async function analyser() {
    if (!transcript.trim()) return
    setPhase('analyzing')
    setError(null)

    try {
      const functions = getFunctions(app, 'europe-west1')
      const analyse = httpsCallable(functions, 'factureVocale')
      const clientsSimple = clients.map(c => ({ nom: c.nom }))
      const chantiersSimple = chantiers.map(c => ({ nom: c.nom, clientNom: clients.find(cl => cl.id === c.clientId)?.nom || '' }))
      const { data } = await analyse({ transcription: transcript.trim(), clients: clientsSimple, chantiers: chantiersSimple })
      setResult(data)
      setPhase('result')
    } catch (e) {
      setError('Erreur d\'analyse : ' + (e.message || 'réessayez'))
      setPhase('stopped')
    }
  }

  function confirmer() {
    if (result) {
      const clientMatch = clients.find(c => c.nom?.toLowerCase() === result.clientNom?.toLowerCase())
      const chantierMatch = chantiers.find(c => c.nom?.toLowerCase() === result.chantierNom?.toLowerCase())
      onResult({
        ...result,
        clientId: clientMatch?.id || null,
        chantierId: chantierMatch?.id || null,
      })
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Facture vocale</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} />
          </button>
        </div>

        {/* Phase idle */}
        {phase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
              Appuyez sur le micro et dictez votre facture.<br />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Ex: "Facture pour Dupont, 3 ouvriers pendant 4 jours sur le chantier Ravalement"
              </span>
            </p>
            <button onClick={startListening} style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0d3580, #1a4ba0)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto', boxShadow: '0 4px 20px rgba(13,53,128,0.3)',
            }}>
              <MicIcon style={{ fontSize: 36, color: '#fff' }} />
            </button>
          </div>
        )}

        {/* Phase listening */}
        {phase === 'listening' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: '#dc2626',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', cursor: 'pointer',
              animation: 'pulse-dot 1.5s infinite',
              boxShadow: '0 0 0 8px rgba(220,38,38,0.15)',
            }} onClick={stopListening}>
              <MicOffIcon style={{ fontSize: 36, color: '#fff' }} />
            </div>
            <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginBottom: 12 }}>Écoute en cours…</p>
            <div style={{
              background: '#f7f8fa', borderRadius: 12, padding: '14px 16px',
              minHeight: 60, fontSize: 14, color: '#111', lineHeight: 1.5, textAlign: 'left',
            }}>
              {transcript || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>En attente de votre voix…</span>}
            </div>
            <button onClick={stopListening} style={{
              marginTop: 16, background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Arrêter ■
            </button>
          </div>
        )}

        {/* Phase stopped — transcription éditable */}
        {phase === 'stopped' && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Transcription (modifiable)</p>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#f7f8fa', borderRadius: 12, padding: '14px 16px',
                fontSize: 14, color: '#111', lineHeight: 1.5, marginBottom: 12,
                border: '1.5px solid #e2e4ea', outline: 'none', resize: 'vertical',
                fontFamily: 'inherit',
              }}
              placeholder="Modifiez le texte si besoin…"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => startListening()} title="Ajouter du texte par la voix" style={{
                width: 40, height: 40, borderRadius: '50%', background: '#e8edf8', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}>
                <MicIcon style={{ fontSize: 20, color: '#0d3580' }} />
              </button>
              <button onClick={analyser} disabled={!transcript.trim()} style={{
                flex: 2, background: transcript.trim() ? '#0d3580' : '#c8d3ee', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: transcript.trim() ? 'pointer' : 'not-allowed',
              }}>Analyser avec IA</button>
            </div>
          </div>
        )}

        {/* Phase analyzing */}
        {phase === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 48, height: 48, border: '3px solid #e8edf8', borderTopColor: '#0d3580',
              borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: '#6b7280' }}>Claude analyse votre dictée…</p>
          </div>
        )}

        {/* Phase result */}
        {phase === 'result' && result && (
          <div>
            <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '16px', marginBottom: 16, border: '1px solid #dcfce7' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Facture détectée</p>
              {[
                ['Client', result.clientNom],
                ['Chantier', result.chantierNom],
                ['Type', result.type === 'regie' ? 'Régie' : 'Forfait'],
                ['Description', result.description],
                result.type === 'regie' ? ['Ouvriers', result.nbOuvriers] : null,
                result.type === 'regie' ? ['Jours', result.nbJours] : null,
                result.type === 'regie' ? ['Taux/jour', result.tauxJournalier ? `${result.tauxJournalier} €` : null] : null,
                result.type === 'forfait' ? ['Montant', result.montantForfait ? `${result.montantForfait} €` : null] : null,
                result.notes ? ['Notes', result.notes] : null,
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid #e2e4ea' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: value ? '#111' : '#d97706' }}>{value || 'Non détecté'}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setPhase('idle'); setTranscript(''); setResult(null) }} style={{
                flex: 1, background: '#f0f2f7', color: '#6b7280', border: 'none',
                borderRadius: 10, padding: '10px', fontSize: 13, cursor: 'pointer',
              }}>Recommencer</button>
              <button onClick={confirmer} style={{
                flex: 2, background: '#0d3580', color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>Ouvrir la facture →</button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#dc2626' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
