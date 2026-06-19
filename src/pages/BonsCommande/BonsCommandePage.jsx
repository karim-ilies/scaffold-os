import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import app, { db, storage } from '../../firebase/config'
import { getNextNumero } from '../../firebase/helpers'
import { useBonsCommande } from '../../hooks/useBonsCommande'
import { useClients } from '../../hooks/useClients'
import { useChantiers } from '../../hooks/useChantiers'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useAuth } from '../../hooks/useAuth'
import { formatEuro } from '../../utils/formatters'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'

export default function BonsCommandePage() {
  const { bdcs, loading, creerBDC, supprimerBDC } = useBonsCommande()
  const { clients } = useClients()
  const { personnel } = usePersonnel()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [phase, setPhase] = useState('liste')
  const [extractedData, setExtractedData] = useState(null)
  const [selectedBDC, setSelectedBDC] = useState(null)
  const [saving, setSaving] = useState(false)

  // Config pour le flux unifié
  const [clientId, setClientId] = useState('new')
  const [nbJours, setNbJours] = useState(1)
  const [selectedOuvriers, setSelectedOuvriers] = useState([])

  const actifs = personnel.filter(o => o.actif !== false && (o.role === 'ouvrier' || o.role === 'chef_equipe'))

  function matchClient(nom) {
    const n = (nom || '').toLowerCase()
    return clients.find(c => {
      const cn = (c.nom || '').toLowerCase()
      return cn.includes(n) || n.includes(cn) || n.split(' ').some(w => w.length > 3 && cn.includes(w))
    })
  }

  // ─── IMPORT PDF ──────────────────────────────────────

  async function handleImportPDF(file) {
    if (!file) return
    if (!file.type.includes('pdf') && !file.type.startsWith('image/')) return
    setPhase('uploading')

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

      setPhase('analyzing')
      const functions = getFunctions(app, 'europe-west1')
      const lire = httpsCallable(functions, 'lireBDC', { timeout: 60000 })
      const { data } = await lire({ pdfBase64: base64, mimeType: file.type })

      const ext = { ...data, pdfUrl, pdfNom: file.name }
      setExtractedData(ext)

      const matched = matchClient(data.clientNom)
      setClientId(matched?.id || 'new')
      setNbJours(data.nbJours || 1)
      setSelectedOuvriers([])
      setPhase('confirm')
    } catch (e) {
      console.error('Erreur import BDC:', e)
      setPhase('error')
    }
  }

  // ─── TOUT CRÉER EN 1 CLIC ──────────────────────────────

  async function handleToutCreer() {
    if (!extractedData || selectedOuvriers.length === 0) return
    setSaving(true)
    try {
      let cId = clientId
      const d = extractedData

      // 1. Client
      if (cId === 'new' && d.clientNom) {
        const newRef = await addDoc(collection(db, 'clients'), {
          nom: d.clientNom, type: 'pro',
          adresse: { rue: d.clientAdresse || '', cp: '', ville: '' },
          contact: { nom: '', tel: d.clientTel || '', email: d.clientEmail || '' },
          telephone: d.clientTel || '', email: d.clientEmail || '',
          siret: d.clientSiret || '', actif: true, createdAt: serverTimestamp(),
        })
        cId = newRef.id
      } else if (cId && cId !== 'new') {
        const existing = clients.find(c => c.id === cId)
        const up = {}
        if (d.clientTel && !existing?.telephone) { up.telephone = d.clientTel; up['contact.tel'] = d.clientTel }
        if (d.clientEmail && !existing?.email) { up.email = d.clientEmail; up['contact.email'] = d.clientEmail }
        if (d.clientSiret && !existing?.siret) up.siret = d.clientSiret
        if (Object.keys(up).length > 0) await updateDoc(doc(db, 'clients', cId), up)
      }

      const client = clients.find(c => c.id === cId)
      const dateDebut = d.dateIntervention || new Date().toISOString().split('T')[0]

      // 2. Chantier
      const chantierRef = await addDoc(collection(db, 'chantiers'), {
        nom: d.chantierNom || d.description || '—',
        clientId: cId || null,
        adresse: { rue: d.chantierAdresse || '', cp: '', ville: '' },
        statut: 'en_cours', dateDebut,
        montantBDC: d.montantHT, avancement: 0,
        typeChantier: 'montage_echafaudage',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      // 3. Planning (chaque ouvrier × chaque jour)
      const jours = [dateDebut]
      if (d.dateFin && d.dateFin !== dateDebut) {
        const start = new Date(dateDebut + 'T12:00:00')
        const end = new Date(d.dateFin + 'T12:00:00')
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
          const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
          if (!jours.includes(iso)) jours.push(iso)
        }
      } else if (nbJours > 1) {
        for (let i = 1; i < nbJours; i++) {
          const dt = new Date(dateDebut + 'T12:00:00')
          dt.setDate(dt.getDate() + i)
          jours.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
        }
      }

      for (const uid of selectedOuvriers) {
        const o = actifs.find(a => a.id === uid)
        for (const jour of jours) {
          await addDoc(collection(db, 'planning'), {
            ouvrierUid: uid, ouvrierNom: o ? `${o.prenom} ${o.nom}` : '',
            ouvrierEmail: o?.email || '', chantierId: chantierRef.id,
            chantierNom: d.chantierNom || '', chantierAdresse: d.chantierAdresse || '',
            date: jour, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          })
        }
      }

      // 4. Facture
      const numero = await getNextNumero('factures', 'FAC')
      const factureRef = await addDoc(collection(db, 'factures'), {
        numero, chantierId: chantierRef.id,
        chantierNom: d.chantierNom || d.description,
        clientId: cId || null, clientNom: client?.nom || d.clientNom,
        statut: 'brouillon', dateEmission: serverTimestamp(),
        dateEcheance: (() => { const dt = new Date(); dt.setDate(dt.getDate() + 30); return dt })(),
        lignes: [{ id: '001', type: 'bdc', description: `${d.chantierNom || ''} — Montage démontage`, montantHT: d.montantHT || 0, tauxTVA: d.tauxTVA || 0.20, montantTVA: d.montantTVA || 0, montantTTC: d.montantTTC || 0 }],
        totalHT: d.montantHT || 0, totalTVA: d.montantTVA || 0, totalTTC: d.montantTTC || 0,
        regimeTVA: (d.tauxTVA === 0.10) ? 'reduit' : (d.tauxTVA === 0) ? 'autoliquidation' : 'normal',
        pdfUrl: d.pdfUrl || null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })

      // 5. BDC
      await creerBDC({ ...d, statut: 'accepte', chantierId: chantierRef.id, factureId: factureRef.id, equipeChoisie: selectedOuvriers, joursChoisis: jours })

      setPhase('success')
      setExtractedData(prev => ({ ...prev, factureId: factureRef.id, chantierId: chantierRef.id, numero }))
    } catch (e) {
      console.error('Erreur création:', e)
      alert('Erreur : ' + e.message)
    } finally { setSaving(false) }
  }

  function resetFlow() {
    setPhase('liste'); setExtractedData(null); setClientId('new'); setNbJours(1); setSelectedOuvriers([])
  }

  // ─── RENDER ──────────────────────────────────────────

  // Phase import/confirm/success
  if (phase !== 'liste') {
    return (
      <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <PageHeader title="Nouveau bon de commande" />
        <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>

          {/* Upload */}
          {phase === 'idle' && (
            <div onDragOver={e => { e.preventDefault(); e.stopPropagation() }} onDrop={e => { e.preventDefault(); e.stopPropagation(); handleImportPDF(e.dataTransfer.files[0]) }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16, border: '2px dashed #0d3580', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}
            >
              <UploadFileIcon style={{ fontSize: 48, color: '#0d3580' }} />
              <button onClick={() => fileRef.current?.click()} style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Choisir un PDF</button>
              <span style={{ fontSize: 13, color: '#6b7280' }}>ou glissez-le ici</span>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImportPDF(e.target.files[0]) }} />
            </div>
          )}

          {/* Loading */}
          {(phase === 'uploading' || phase === 'analyzing') && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
              <div style={{ width: 48, height: 48, border: '3px solid #e8edf8', borderTopColor: '#0d3580', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0 }}>{phase === 'uploading' ? 'Envoi du PDF…' : 'L\'IA lit le bon de commande…'}</p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#dc2626' }}>Erreur de lecture</p>
              <button onClick={() => setPhase('idle')} style={{ marginTop: 12, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Réessayer</button>
            </div>
          )}

          {/* ═══ ÉCRAN UNIQUE : tout confirmer ═══ */}
          {phase === 'confirm' && extractedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Résumé BDC */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckIcon style={{ fontSize: 20, color: '#16a34a' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>BDC lu par l'IA</span>
                  {extractedData.pdfUrl && <a href={extractedData.pdfUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', fontSize: 12, color: '#0d3580', fontWeight: 600 }}>📄 PDF</a>}
                </div>
                {[['Chantier', extractedData.chantierNom], ['Adresse chantier', extractedData.chantierAdresse], ['Date', extractedData.dateIntervention], ['Description', extractedData.description],
                  ['Montant HT', extractedData.montantHT ? formatEuro(extractedData.montantHT) : null], ['TTC', extractedData.montantTTC ? formatEuro(extractedData.montantTTC) : null],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f0f2f7' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: v ? '#111' : '#d97706', textAlign: 'right', maxWidth: '60%' }}>{v || '—'}</span>
                  </div>
                ))}
              </div>

              {/* Client */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Client</p>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  style={{ width: '100%', background: '#f0f2f7', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' }}
                >
                  <option value="new">+ Nouveau : {extractedData.clientNom || '—'}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                {clientId === 'new' && extractedData.clientNom && (
                  <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 500, margin: '4px 0 0' }}>
                    ✓ {extractedData.clientNom} sera créé avec {[extractedData.clientEmail, extractedData.clientTel, extractedData.clientSiret].filter(Boolean).join(', ') || 'les infos du BDC'}
                  </p>
                )}
              </div>

              {/* Nombre de jours */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Durée du chantier</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" min="1" max="30" value={nbJours} onChange={e => setNbJours(parseInt(e.target.value) || 1)}
                    style={{ width: 70, background: '#f0f2f7', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '10px 12px', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                  <span style={{ fontSize: 13, color: '#6b7280' }}>jour{nbJours > 1 ? 's' : ''} à partir du {extractedData.dateIntervention || '—'}</span>
                </div>
              </div>

              {/* Équipe */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Équipe ({selectedOuvriers.length} sélectionné{selectedOuvriers.length > 1 ? 's' : ''})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {actifs.map(o => {
                    const sel = selectedOuvriers.includes(o.id)
                    return (
                      <button key={o.id} onClick={() => setSelectedOuvriers(prev => sel ? prev.filter(u => u !== o.id) : [...prev, o.id])}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: sel ? '2px solid #16a34a' : '1.5px solid #e2e4ea', borderRadius: 8, background: sel ? '#dcfce7' : '#fff', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 26, height: 26, borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: o.role === 'chef_equipe' ? '#0d3580' : '#e8edf8', color: o.role === 'chef_equipe' ? '#fff' : '#0d3580', flexShrink: 0 }}>{o.prenom?.[0]}{o.nom?.[0]}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111', margin: 0 }}>{o.prenom} {o.nom}</p>
                          <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>{o.role === 'chef_equipe' ? 'Chef' : 'Ouvrier'}</p>
                        </div>
                        {sel && <span style={{ fontSize: 14, color: '#16a34a' }}>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Aperçu facture */}
              <div style={{ background: '#0d3580', borderRadius: 14, padding: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Facture qui sera créée</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Total HT</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{formatEuro(extractedData.montantHT || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>TVA {Math.round((extractedData.tauxTVA || 0.20) * 100)}%</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{formatEuro(extractedData.montantTVA || 0)}</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Total TTC</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{formatEuro(extractedData.montantTTC || 0)}</span>
                </div>
              </div>

              {/* Boutons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetFlow} style={{ flex: 1, background: '#f0f2f7', color: '#6b7280', border: 'none', borderRadius: 10, padding: 14, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                <button onClick={handleToutCreer} disabled={saving || selectedOuvriers.length === 0}
                  style={{ flex: 3, background: selectedOuvriers.length > 0 ? '#16a34a' : '#c8d3ee', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 700, cursor: selectedOuvriers.length > 0 ? 'pointer' : 'not-allowed' }}
                >{saving ? 'Création en cours…' : `✓ Tout créer (${selectedOuvriers.length} ouvrier${selectedOuvriers.length > 1 ? 's' : ''} × ${nbJours} jour${nbJours > 1 ? 's' : ''})`}</button>
              </div>
            </div>
          )}

          {/* ═══ SUCCÈS ═══ */}
          {phase === 'success' && extractedData && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckIcon style={{ fontSize: 32, color: '#16a34a' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: '0 0 8px' }}>Tout est créé !</h2>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px' }}>Client + Chantier + Planning + Facture {extractedData.numero}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#0d3580', margin: '8px 0 20px' }}>{formatEuro(extractedData.montantTTC || 0)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {extractedData.factureId && (
                    <button onClick={() => navigate(`/factures/${extractedData.factureId}`)}
                      style={{ flex: 1, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >🧾 Facture</button>
                  )}
                  {extractedData.chantierId && (
                    <button onClick={() => navigate(`/chantiers/${extractedData.chantierId}`)}
                      style={{ flex: 1, background: '#e8edf8', color: '#0d3580', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >🏗 Chantier</button>
                  )}
                </div>
                <button onClick={() => navigate('/planning')}
                  style={{ width: '100%', background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >📅 Voir le planning</button>
              </div>
              <button onClick={resetFlow} style={{ marginTop: 12, background: 'transparent', color: '#6b7280', border: 'none', fontSize: 13, cursor: 'pointer' }}>← Importer un autre BDC</button>
            </div>
          )}

          {phase === 'liste' || phase === 'idle' ? null : (
            <button onClick={resetFlow} style={{ display: 'block', margin: '16px auto 0', background: 'transparent', color: '#6b7280', border: 'none', fontSize: 13, cursor: 'pointer' }}>← Retour à la liste</button>
          )}
        </div>
      </div>
    )
  }

  // ─── VUE LISTE ────────────────────────────────────────

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PageHeader title="Bons de commande" subtitle={`${bdcs.length} BDC`} action={{ label: '+ Importer un BDC', onClick: () => setPhase('idle') }} />
      <div style={{ padding: '0 20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1, 2].map(i => <div key={i} style={{ height: 80, background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(13,53,128,0.06)' }} />)}</div>
        ) : bdcs.length === 0 ? (
          <EmptyState icon="📄" title="Aucun bon de commande" subtitle="Importez votre premier BDC" action={{ label: '+ Importer un BDC', onClick: () => setPhase('idle') }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bdcs.map(bdc => (
              <div key={bdc.id} onClick={() => setSelectedBDC(bdc)}
                style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', borderLeft: `4px solid ${bdc.statut === 'accepte' ? '#16a34a' : '#d97706'}`, boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)', transition: 'transform 0.15s', }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{bdc.clientNom || '—'}</span>
                  <StatusBadge statut={bdc.statut} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111', marginBottom: 6 }}>{bdc.chantierNom || '—'}</div>
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
        <div onClick={e => { if (e.target === e.currentTarget) setSelectedBDC(null) }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111', margin: 0 }}>{selectedBDC.clientNom || 'BDC'}</h2>
              <button onClick={() => setSelectedBDC(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
            </div>
            <div style={{ background: '#f7f9ff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              {[['Chantier', selectedBDC.chantierNom], ['Adresse', selectedBDC.chantierAdresse], ['Date', selectedBDC.dateIntervention], ['Description', selectedBDC.description]].map(([l, v]) => v && (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #e2e4ea' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 8, borderTop: '1px solid #e2e4ea' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Total TTC</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0d3580' }}>{formatEuro(selectedBDC.montantTTC || 0)}</span>
              </div>
            </div>
            {selectedBDC.pdfUrl && <a href={selectedBDC.pdfUrl} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 16, fontSize: 13, color: '#0d3580', fontWeight: 600, textAlign: 'center' }}>📄 Voir le PDF original</a>}
            {selectedBDC.statut === 'accepte' && (
              <div>
                <div style={{ background: '#dcfce7', borderRadius: 10, padding: 12, textAlign: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', margin: 0 }}>✓ Accepté</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedBDC.factureId && <button onClick={() => { setSelectedBDC(null); navigate(`/factures/${selectedBDC.factureId}`) }} style={{ flex: 1, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🧾 Facture</button>}
                  {selectedBDC.chantierId && <button onClick={() => { setSelectedBDC(null); navigate(`/chantiers/${selectedBDC.chantierId}`) }} style={{ flex: 1, background: '#e8edf8', color: '#0d3580', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🏗 Chantier</button>}
                </div>
              </div>
            )}
            <button onClick={() => { if (window.confirm('Supprimer ce BDC ?\nLes factures et chantiers ne seront PAS affectés.')) { supprimerBDC(selectedBDC.id); setSelectedBDC(null) } }}
              style={{ width: '100%', marginTop: 16, background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 10, padding: 10, fontSize: 12, cursor: 'pointer' }}>Supprimer ce BDC</button>
          </div>
        </div>
      )}
    </div>
  )
}
