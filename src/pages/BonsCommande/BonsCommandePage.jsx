import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import app, { db, storage } from '../../firebase/config'
import { useBonsCommande } from '../../hooks/useBonsCommande'
import { useClients } from '../../hooks/useClients'
import { useChantiers } from '../../hooks/useChantiers'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useEquipes } from '../../hooks/useEquipes'
import { useAuth } from '../../hooks/useAuth'
import { formatEuro, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import CloseIcon from '@mui/icons-material/Close'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckIcon from '@mui/icons-material/Check'
import GroupsIcon from '@mui/icons-material/Groups'

export default function BonsCommandePage() {
  const { bdcs, loading, creerBDC, accepterBDC, refuserBDC, bdcsNouveaux } = useBonsCommande()
  const { clients } = useClients()
  const { chantiers } = useChantiers()
  const { personnel } = usePersonnel()
  const { equipes } = useEquipes()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState('liste')
  const [selectedBDC, setSelectedBDC] = useState(null)
  const [importPhase, setImportPhase] = useState('idle')
  const [extractedData, setExtractedData] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  const actifs = personnel.filter(o => o.actif !== false && (o.role === 'ouvrier' || o.role === 'chef_equipe'))

  async function handleImportPDF(file) {
    if (!file || !file.type.includes('pdf')) return
    setImportPhase('uploading')

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      setImportPhase('analyzing')
      const functions = getFunctions(app, 'europe-west1')
      const lire = httpsCallable(functions, 'lireBDC')
      const { data } = await lire({ pdfBase64: base64 })

      const storRef = ref(storage, `bdc/${Date.now()}_${file.name}`)
      await uploadBytes(storRef, file)
      const pdfUrl = await getDownloadURL(storRef)

      setExtractedData({ ...data, pdfUrl, pdfNom: file.name })
      setImportPhase('review')
    } catch (e) {
      console.error('Erreur import BDC:', e)
      setImportPhase('error')
    }
  }

  async function handleSaveBDC() {
    if (!extractedData) return
    setSaving(true)
    try {
      const ref = await creerBDC(extractedData)
      setView('liste')
      setImportPhase('idle')
      setExtractedData(null)
    } finally { setSaving(false) }
  }

  async function handleAccepter(bdc) {
    setSaving(true)
    try {
      const chantierRef = await addDoc(collection(db, 'chantiers'), {
        nom: bdc.chantierNom || bdc.description || '—',
        adresse: { rue: bdc.chantierAdresse || '', cp: '', ville: '' },
        statut: 'en_cours',
        dateDebut: bdc.dateIntervention || new Date().toISOString().split('T')[0],
        bdcId: bdc.id,
        montantBDC: bdc.montantHT,
        avancement: 0,
        typeChantier: 'montage_echafaudage',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      const factureRef = await addDoc(collection(db, 'factures'), {
        chantierId: chantierRef.id,
        chantierNom: bdc.chantierNom || bdc.description,
        clientNom: bdc.clientNom,
        bdcId: bdc.id,
        statut: 'brouillon',
        dateEmission: serverTimestamp(),
        lignes: [{
          id: '001', type: 'bdc',
          description: `${bdc.chantierNom || ''} — Montage démontage`,
          montantHT: bdc.montantHT || 0, tauxTVA: bdc.tauxTVA || 0.20,
          montantTVA: bdc.montantTVA || 0, montantTTC: bdc.montantTTC || 0,
        }],
        totalHT: bdc.montantHT || 0, totalTVA: bdc.montantTVA || 0, totalTTC: bdc.montantTTC || 0,
        regimeTVA: (bdc.tauxTVA === 0.10) ? 'reduit' : (bdc.tauxTVA === 0) ? 'autoliquidation' : 'normal',
        pdfUrl: bdc.pdfUrl || null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      await accepterBDC(bdc.id, { chantierId: chantierRef.id, factureId: factureRef.id, equipe: [], jours: [] })
      setSelectedBDC(null)
    } finally { setSaving(false) }
  }

  // ─── RENDER ──────────────────────────────────────────────

  if (view === 'import' || importPhase !== 'idle') {
    return (
      <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <PageHeader title="Importer un BDC" subtitle="Déposez le PDF du bon de commande" />
        <div style={{ padding: 20, maxWidth: 560, margin: '0 auto' }}>

          {importPhase === 'idle' && (
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 16, border: '2px dashed #0d3580', padding: '48px 24px',
              cursor: 'pointer', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)',
            }}>
              <UploadFileIcon style={{ fontSize: 48, color: '#0d3580' }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#0d3580' }}>Choisir un PDF</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>ou glissez-le ici</span>
              <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                onChange={e => handleImportPDF(e.target.files[0])} />
            </label>
          )}

          {(importPhase === 'uploading' || importPhase === 'analyzing') && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
              <div style={{ width: 48, height: 48, border: '3px solid #e8edf8', borderTopColor: '#0d3580', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>
                {importPhase === 'uploading' ? 'Envoi du PDF…' : 'L\'IA lit le bon de commande…'}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Quelques secondes</p>
            </div>
          )}

          {importPhase === 'error' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#dc2626' }}>Erreur de lecture</p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Le PDF n'a pas pu être analysé. Réessayez.</p>
              <button onClick={() => { setImportPhase('idle'); setExtractedData(null) }}
                style={{ marginTop: 12, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >Réessayer</button>
            </div>
          )}

          {importPhase === 'review' && extractedData && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <CheckIcon style={{ fontSize: 20, color: '#16a34a' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>BDC lu par l'IA</span>
              </div>

              {[
                ['Client', extractedData.clientNom],
                ['Chantier', extractedData.chantierNom],
                ['Adresse chantier', extractedData.chantierAdresse],
                ['Date intervention', extractedData.dateIntervention],
                ['Description', extractedData.description],
                ['Montant HT', extractedData.montantHT ? formatEuro(extractedData.montantHT) : null],
                ['TVA', extractedData.tauxTVA ? `${Math.round(extractedData.tauxTVA * 100)}%` : null],
                ['Montant TTC', extractedData.montantTTC ? formatEuro(extractedData.montantTTC) : null],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f0f2f7' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: value ? '#111' : '#d97706' }}>{value || 'Non détecté'}</span>
                </div>
              ))}

              {extractedData.pdfUrl && (
                <a href={extractedData.pdfUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginTop: 12, fontSize: 13, color: '#0d3580', fontWeight: 600, textAlign: 'center' }}
                >📄 Voir le PDF original</a>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => { setImportPhase('idle'); setExtractedData(null); setView('liste') }}
                  style={{ flex: 1, background: '#f0f2f7', color: '#6b7280', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, cursor: 'pointer' }}
                >Annuler</button>
                <button onClick={handleSaveBDC} disabled={saving}
                  style={{ flex: 2, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >{saving ? 'Enregistrement…' : 'Enregistrer le BDC'}</button>
              </div>
            </div>
          )}

          {importPhase === 'idle' && (
            <button onClick={() => { setView('liste'); setImportPhase('idle') }}
              style={{ marginTop: 16, background: 'transparent', color: '#6b7280', border: 'none', fontSize: 13, cursor: 'pointer', display: 'block', margin: '16px auto 0' }}
            >← Retour à la liste</button>
          )}
        </div>
      </div>
    )
  }

  // ─── VUE DÉTAIL BDC (modal) ──────────────────────────

  // ─── VUE LISTE ────────────────────────────────────────

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PageHeader
        title="Bons de commande"
        subtitle={`${bdcs.length} BDC${bdcsNouveaux.length > 0 ? ` · ${bdcsNouveaux.length} à traiter` : ''}`}
        action={{ label: '+ Importer un BDC', onClick: () => setView('import') }}
      />

      <div style={{ padding: '0 20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height="80px" borderRadius="14px" />)}
          </div>
        ) : bdcs.length === 0 ? (
          <EmptyState icon="📄" title="Aucun bon de commande" subtitle="Importez votre premier BDC pour commencer" action={{ label: '+ Importer un BDC', onClick: () => setView('import') }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bdcs.map(bdc => (
              <div key={bdc.id}
                onClick={() => setSelectedBDC(bdc)}
                style={{
                  background: '#fff', borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
                  borderLeft: `4px solid ${bdc.statut === 'nouveau' ? '#dc2626' : bdc.statut === 'accepte' ? '#16a34a' : bdc.statut === 'refuse' ? '#6b7280' : '#d97706'}`,
                  boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,53,128,0.14)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{bdc.clientNom || '—'}</span>
                  <StatusBadge statut={bdc.statut} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 6 }}>{bdc.chantierNom || bdc.description || '—'}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
                  {bdc.dateIntervention && <span>📅 {bdc.dateIntervention}</span>}
                  {bdc.montantHT && <span style={{ fontWeight: 600, color: '#0d3580' }}>{formatEuro(bdc.montantHT)} HT</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal détail BDC */}
      {selectedBDC && (
        <div onClick={e => { if (e.target === e.currentTarget) setSelectedBDC(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111', margin: 0 }}>{selectedBDC.clientNom || 'BDC'}</h2>
              <button onClick={() => setSelectedBDC(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} />
              </button>
            </div>

            <div style={{ background: '#f7f9ff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              {[
                ['Chantier', selectedBDC.chantierNom],
                ['Adresse', selectedBDC.chantierAdresse],
                ['Date', selectedBDC.dateIntervention],
                ['Description', selectedBDC.description],
              ].map(([l, v]) => v && (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #e2e4ea' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 8, borderTop: '1px solid #e2e4ea' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Total TTC</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0d3580' }}>{formatEuro(selectedBDC.montantTTC || 0)}</span>
              </div>
            </div>

            {selectedBDC.pdfUrl && (
              <a href={selectedBDC.pdfUrl} target="_blank" rel="noreferrer"
                style={{ display: 'block', marginBottom: 16, fontSize: 13, color: '#0d3580', fontWeight: 600, textAlign: 'center' }}
              >📄 Voir le PDF original</a>
            )}

            {selectedBDC.statut === 'nouveau' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { refuserBDC(selectedBDC.id, 'Refusé'); setSelectedBDC(null) }}
                  style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >✕ Refuser</button>
                <button onClick={() => handleAccepter(selectedBDC)} disabled={saving}
                  style={{ flex: 2, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >{saving ? 'Création…' : '✓ Accepter — créer chantier + facture'}</button>
              </div>
            )}

            {selectedBDC.statut === 'accepte' && (
              <div style={{ background: '#dcfce7', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: 0 }}>✓ Accepté — chantier et facture créés</p>
              </div>
            )}

            {selectedBDC.statut === 'refuse' && (
              <div style={{ background: '#fee2e2', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: 0 }}>✕ Refusé{selectedBDC.motifRefus ? ` — ${selectedBDC.motifRefus}` : ''}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
