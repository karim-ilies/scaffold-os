import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
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
  const { bdcs, loading, creerBDC, accepterBDC, refuserBDC, supprimerBDC, bdcsNouveaux } = useBonsCommande()
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
    if (!file) return
    const isValid = file.type.includes('pdf') || file.type.startsWith('image/')
    if (!isValid) return
    setImportPhase('uploading')

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const storRef = ref(storage, `bdc/${Date.now()}_${file.name}`)
      await uploadBytes(storRef, file)
      const pdfUrl = await getDownloadURL(storRef)

      setImportPhase('analyzing')
      const functions = getFunctions(app, 'europe-west1')
      const lire = httpsCallable(functions, 'lireBDC', { timeout: 60000 })
      const { data } = await lire({ pdfBase64: base64, mimeType: file.type })

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

  const [acceptConfig, setAcceptConfig] = useState(null)

  function openAcceptFlow(bdc) {
    const bdcNom = (bdc.clientNom || '').toLowerCase()
    const matchedClient = clients.find(c => {
      const cNom = (c.nom || '').toLowerCase()
      return cNom.includes(bdcNom) || bdcNom.includes(cNom) || bdcNom.split(' ').some(w => w.length > 3 && cNom.includes(w))
    })
    setAcceptConfig({
      bdc,
      clientId: matchedClient?.id || 'new',
      nbJours: bdc.nbJours || 1,
      selectedOuvriers: [],
    })
  }

  async function handleAccepter() {
    if (!acceptConfig) return
    let { bdc, clientId, selectedOuvriers, nbJours: nbJoursConfig } = acceptConfig

    // Créer le client s'il est nouveau, ou compléter les infos manquantes
    if (clientId === 'new' && bdc.clientNom) {
      const newRef = await addDoc(collection(db, 'clients'), {
        nom: bdc.clientNom,
        type: 'pro',
        adresse: { rue: bdc.clientAdresse || '', cp: '', ville: '' },
        contact: { nom: '', tel: bdc.clientTel || '', email: bdc.clientEmail || '' },
        telephone: bdc.clientTel || '',
        email: bdc.clientEmail || '',
        siret: bdc.clientSiret || '',
        actif: true,
        createdAt: serverTimestamp(),
      })
      clientId = newRef.id
    } else if (clientId && clientId !== 'new') {
      const existingClient = clients.find(c => c.id === clientId)
      const updates = {}
      if (bdc.clientTel && !existingClient?.telephone) { updates.telephone = bdc.clientTel; updates['contact.tel'] = bdc.clientTel }
      if (bdc.clientEmail && !existingClient?.email) { updates.email = bdc.clientEmail; updates['contact.email'] = bdc.clientEmail }
      if (bdc.clientSiret && !existingClient?.siret) updates.siret = bdc.clientSiret
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'clients', clientId), updates)
      }
    }
    setSaving(true)
    try {
      const client = clients.find(c => c.id === clientId)
      const dateDebut = bdc.dateIntervention || new Date().toISOString().split('T')[0]

      const chantierRef = await addDoc(collection(db, 'chantiers'), {
        nom: bdc.chantierNom || bdc.description || '—',
        clientId: clientId || null,
        adresse: { rue: bdc.chantierAdresse || '', cp: '', ville: '' },
        statut: 'en_cours',
        dateDebut,
        bdcId: bdc.id,
        montantBDC: bdc.montantHT,
        avancement: 0,
        typeChantier: 'montage_echafaudage',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      const factureRef = await addDoc(collection(db, 'factures'), {
        chantierId: chantierRef.id,
        chantierNom: bdc.chantierNom || bdc.description,
        clientId: clientId || null,
        clientNom: client?.nom || bdc.clientNom,
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

      // Calculer les jours du chantier
      const jours = [dateDebut]
      const nbJoursIA = nbJoursConfig || bdc.nbJours || 1
      if (bdc.dateFin && bdc.dateFin !== dateDebut) {
        const start = new Date(dateDebut + 'T12:00:00')
        const end = new Date(bdc.dateFin + 'T12:00:00')
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          if (!jours.includes(iso)) jours.push(iso)
        }
      } else if (nbJoursIA > 1) {
        for (let i = 1; i < nbJoursIA; i++) {
          const d = new Date(dateDebut + 'T12:00:00')
          d.setDate(d.getDate() + i)
          jours.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
        }
      }

      // Créer le planning pour chaque ouvrier × chaque jour
      for (const uid of selectedOuvriers) {
        const o = actifs.find(a => a.id === uid)
        for (const jour of jours) {
          await addDoc(collection(db, 'planning'), {
            ouvrierUid: uid,
            ouvrierNom: o ? `${o.prenom} ${o.nom}` : '',
            ouvrierEmail: o?.email || '',
            chantierId: chantierRef.id,
            chantierNom: bdc.chantierNom || bdc.description || '',
            chantierAdresse: bdc.chantierAdresse || '',
            date: jour,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          })
        }
      }

      await accepterBDC(bdc.id, { chantierId: chantierRef.id, factureId: factureRef.id, equipe: selectedOuvriers, jours })
      setAcceptConfig(null)
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
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.background = '#f0fdf4' }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '#0d3580'; e.currentTarget.style.background = '#fff' }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderColor = '#0d3580'; e.currentTarget.style.background = '#fff'; const f = e.dataTransfer.files[0]; if (f) handleImportPDF(f) }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                background: '#fff', borderRadius: 16, border: '2px dashed #0d3580', padding: '48px 24px',
                textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
                boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)',
              }}
            >
              <UploadFileIcon style={{ fontSize: 48, color: '#0d3580' }} />
              <button onClick={() => fileRef.current?.click()}
                style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >Choisir un PDF</button>
              <span style={{ fontSize: 13, color: '#6b7280' }}>ou glissez-le ici</span>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleImportPDF(e.target.files[0]) }} />
            </div>
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

            {selectedBDC.statut === 'nouveau' && !acceptConfig && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { refuserBDC(selectedBDC.id, 'Refusé'); setSelectedBDC(null) }}
                  style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >✕ Refuser</button>
                <button onClick={() => openAcceptFlow(selectedBDC)}
                  style={{ flex: 2, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >✓ Accepter ce BDC →</button>
              </div>
            )}

            {acceptConfig && acceptConfig.bdc.id === selectedBDC.id && (
              <div style={{ borderTop: '1px solid #e2e4ea', paddingTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Client</p>
                <select value={acceptConfig.clientId} onChange={e => setAcceptConfig(c => ({ ...c, clientId: e.target.value }))}
                  style={{ width: '100%', background: '#f0f2f7', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 4, outline: 'none' }}
                >
                  <option value="new">+ Nouveau client : {acceptConfig.bdc.clientNom || '—'}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                {acceptConfig.clientId === 'new' && (
                  <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 500, margin: '0 0 12px' }}>
                    ✓ "{acceptConfig.bdc.clientNom}" sera créé automatiquement
                  </p>
                )}

                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Nombre de jours</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <input type="number" min="1" max="30" value={acceptConfig.nbJours}
                    onChange={e => setAcceptConfig(c => ({ ...c, nbJours: parseInt(e.target.value) || 1 }))}
                    style={{ width: 70, background: '#f0f2f7', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '10px 12px', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                  />
                  <span style={{ fontSize: 13, color: '#6b7280' }}>
                    jour{acceptConfig.nbJours > 1 ? 's' : ''} à partir du {acceptConfig.bdc.dateIntervention || '—'}
                  </span>
                </div>

                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Équipe pour ce chantier</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
                  {actifs.map(o => {
                    const sel = acceptConfig.selectedOuvriers.includes(o.id)
                    return (
                      <button key={o.id}
                        onClick={() => setAcceptConfig(c => ({
                          ...c,
                          selectedOuvriers: sel ? c.selectedOuvriers.filter(u => u !== o.id) : [...c.selectedOuvriers, o.id]
                        }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          border: sel ? '2px solid #16a34a' : '1.5px solid #e2e4ea',
                          borderRadius: 8, background: sel ? '#dcfce7' : '#fff',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: o.role === 'chef_equipe' ? '#0d3580' : '#e8edf8',
                          color: o.role === 'chef_equipe' ? '#fff' : '#0d3580', flexShrink: 0,
                        }}>{o.prenom?.[0]}{o.nom?.[0]}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{o.prenom} {o.nom}</p>
                          <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{o.role === 'chef_equipe' ? 'Chef' : 'Ouvrier'}</p>
                        </div>
                        {sel && <span style={{ fontSize: 14, color: '#16a34a' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>

                <button onClick={handleAccepter} disabled={saving || acceptConfig.selectedOuvriers.length === 0}
                  style={{
                    width: '100%', background: acceptConfig.selectedOuvriers.length > 0 ? '#16a34a' : '#c8d3ee',
                    color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >{saving ? 'Création en cours…' : `✓ Créer chantier + facture + planning (${acceptConfig.selectedOuvriers.length} ouvrier${acceptConfig.selectedOuvriers.length > 1 ? 's' : ''})`}</button>
              </div>
            )}

            {selectedBDC.statut === 'accepte' && (
              <div>
                <div style={{ background: '#dcfce7', borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: 0 }}>✓ Accepté</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedBDC.factureId && (
                    <button onClick={() => { setSelectedBDC(null); navigate(`/factures/${selectedBDC.factureId}`) }}
                      style={{ flex: 1, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >🧾 Voir / modifier la facture</button>
                  )}
                  {selectedBDC.chantierId && (
                    <button onClick={() => { setSelectedBDC(null); navigate(`/chantiers/${selectedBDC.chantierId}`) }}
                      style={{ flex: 1, background: '#e8edf8', color: '#0d3580', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >🏗 Voir le chantier</button>
                  )}
                </div>
              </div>
            )}

            {selectedBDC.statut === 'refuse' && (
              <div style={{ background: '#fee2e2', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: 0 }}>✕ Refusé{selectedBDC.motifRefus ? ` — ${selectedBDC.motifRefus}` : ''}</p>
              </div>
            )}

            <button
              onClick={() => {
                if (window.confirm('Supprimer ce bon de commande ?\n\nLes factures et chantiers existants ne seront PAS affectés.')) {
                  supprimerBDC(selectedBDC.id)
                  setSelectedBDC(null)
                }
              }}
              style={{ width: '100%', marginTop: 16, background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 10, padding: 10, fontSize: 12, cursor: 'pointer' }}
            >Supprimer ce BDC</button>
          </div>
        </div>
      )}
    </div>
  )
}
