import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db, STORAGE_ENABLED } from '../../firebase/config'
import { useFactures }   from '../../hooks/useFactures'
import { useModal }      from '../../context/ModalContext'
import { useResponsive } from '../../hooks/useResponsive'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { generateFacturePDF, uploadAndGetPdfUrl } from '../../utils/pdfGenerator'
import { envoyerEmailFacture, EMAILJS_FACTURE_CONFIGURE } from '../../utils/emailFacture'
import { useParametres } from '../../hooks/useParametres'
import { formatEuro, formatDate, formatDateLong, formatStatut, formatTauxTVA } from '../../utils/formatters'
import { estEnRetard, joursDeRetard } from '../../utils/calcFacture'
import { BADGES } from '../../constants/theme'
import ArrowBackIcon       from '@mui/icons-material/ArrowBack'
import PictureAsPdfIcon    from '@mui/icons-material/PictureAsPdf'
import PrintIcon           from '@mui/icons-material/Print'
import ArchiveIcon         from '@mui/icons-material/Archive'
import CheckCircleIcon     from '@mui/icons-material/CheckCircle'
import PaymentsIcon        from '@mui/icons-material/Payments'
import SendIcon            from '@mui/icons-material/Send'
import EditIcon            from '@mui/icons-material/Edit'
import SaveIcon            from '@mui/icons-material/Save'

export default function FactureDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { isMobile } = useResponsive()
  const { showModal } = useModal()
  const { ajouterPaiement, archiverFacture } = useFactures()
  const { parametres } = useParametres()
  const copy = useCopyToClipboard()

  const [facture,  setFacture]  = useState(null)
  const [client,   setClient]   = useState(null)
  const [chantier, setChantier] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [paiementModal, setPaiementModal] = useState(false)
  const [sending,       setSending]       = useState(false)
  const [emailModal,    setEmailModal]    = useState(null) // { to, subject, body, pdfUrl }
  const [editing,       setEditing]       = useState(false)
  const [editLignes,    setEditLignes]    = useState(null)

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'factures', id))
      if (!snap.exists()) { navigate('/factures'); return }
      const data = { id: snap.id, ...snap.data() }
      setFacture(data)

      const [cliSnap, chanSnap] = await Promise.all([
        data.clientId   ? getDoc(doc(db, 'clients',   data.clientId))   : null,
        data.chantierId ? getDoc(doc(db, 'chantiers', data.chantierId)) : null,
      ])
      if (cliSnap?.exists())  setClient({ id: cliSnap.id, ...cliSnap.data() })
      if (chanSnap?.exists()) setChantier({ id: chanSnap.id, ...chanSnap.data() })
      setLoading(false)
    }
    load()
  }, [id])

  // Recharge la facture après une action (paiement, archivage)
  async function recharger() {
    const snap = await getDoc(doc(db, 'factures', id))
    if (snap.exists()) setFacture({ id: snap.id, ...snap.data() })
  }

  async function handleArchiver() {
    const ok = await showModal({
      type:         'danger',
      title:        'Archiver cette facture ?',
      message:      `${facture.numero} · ${client?.nom || ''}\nConservée dans les archives, jamais supprimée.`,
      confirmLabel: 'Archiver',
    })
    if (!ok) return
    await archiverFacture(id)
    await recharger()
    await showModal({ type: 'info', title: 'Facture archivée', message: `${facture.numero} déplacée dans les archives.` })
  }

  async function handleMarquerPayee(paiementData) {
    const ok = await showModal({
      type:         'confirm',
      title:        'Confirmer le paiement ?',
      message:      `${facture.numero} · ${formatEuro(paiementData.montant)}\nMode : ${MODES_LABELS[paiementData.mode]}`,
      confirmLabel: 'Confirmer le paiement',
    })
    if (!ok) return
    await ajouterPaiement(id, paiementData)
    await recharger()
    setPaiementModal(false)
    await showModal({ type: 'info', title: 'Paiement enregistré !', message: `${facture.numero} · ${formatEuro(paiementData.montant)} reçu.` })
  }

  async function handleEnvoyer() {
    if (!client?.email) {
      await showModal({ type: 'info', title: 'Email manquant', message: `${client?.nom || 'Ce client'} n'a pas d'adresse email renseignée. Ajoutez-la dans la fiche client.` })
      return
    }
    setSending(true)
    try {
      const blob   = await generateFacturePDF(facture, client, chantier || {}, parametres || {})
      let   pdfUrl = facture.pdfUrl || null

      if (STORAGE_ENABLED) {
        pdfUrl = await uploadAndGetPdfUrl(blob, `factures/${id}/facture.pdf`)
        await updateDoc(doc(db, 'factures', id), { pdfUrl, statut: 'envoyee' })
        await recharger()
      }

      if (EMAILJS_FACTURE_CONFIGURE) {
        await envoyerEmailFacture({
          facture, client, pdfUrl,
          societeNom: parametres?.raisonSociale || 'Scaffold-OS',
        })
        await showModal({ type: 'info', title: 'Email envoyé !', message: `Facture ${facture.numero} envoyée à ${client.email}.` })
      } else {
        const societe = parametres?.raisonSociale || 'Votre prestataire'
        const sujet   = `Facture ${facture.numero} — ${societe}`
        const corps   = `Bonjour,\n\nVeuillez trouver votre facture :\n${pdfUrl || ''}\n\nCordialement,\n${societe}`
        setEmailModal({ to: client.email, subject: sujet, body: corps, pdfUrl })
      }
    } catch (e) {
      alert('Erreur : ' + e.message)
    } finally {
      setSending(false)
    }
  }

  async function handleTelechargerPDF() {
    const blob = await generateFacturePDF(facture, client || {}, chantier || {}, parametres || {})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${facture.numero}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    await showModal({ type: 'info', title: 'PDF généré !', message: `${facture.numero}.pdf téléchargé.` })
  }

  async function handleImprimer() {
    const blob = await generateFacturePDF(facture, client || {}, chantier || {}, parametres || {})
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', fontFamily: 'system-ui' }}>Chargement…</div>
  if (!facture) return null

  const enRetard   = estEnRetard(facture)
  const retardJ    = joursDeRetard(facture)
  const statutEff  = enRetard ? 'en_retard' : facture.statut
  const badge      = BADGES[statutEff] || BADGES.brouillon
  const archivee   = facture.statut === 'archivee'
  const payee      = facture.statut === 'payee'
  const brouillon  = facture.statut === 'brouillon'
  const peutPayer  = !payee && !archivee && !brouillon && (facture.solde || 0) > 0
  const peutArchiver = !archivee

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: isMobile ? '14px 16px' : '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button
            onClick={() => navigate('/factures')}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}
          >
            <ArrowBackIcon style={{ fontSize: 20 }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 onClick={() => copy(facture.numero, 'Numéro')} title="Cliquer pour copier" style={{ fontSize: isMobile ? 17 : 20, fontWeight: '700', color: '#fff', margin: 0, cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)' }}>{facture.numero}</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>
              Émise le {formatDate(facture.dateEmission)}
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: '600', padding: '4px 10px', borderRadius: 20, ...badge }}>
            {enRetard ? `En retard (${retardJ}j)` : formatStatut(facture.statut)}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {peutPayer && (
            <ActionBtn icon={<PaymentsIcon style={{ fontSize: 16 }} />} label="Marquer payée" color="#16a34a" onClick={() => setPaiementModal(true)} />
          )}
          <ActionBtn
            icon={<SendIcon style={{ fontSize: 16 }} />}
            label={sending ? 'Envoi…' : 'Envoyer'}
            color="#E8A838"
            onClick={handleEnvoyer}
            disabled={sending}
          />
          <ActionBtn icon={<PictureAsPdfIcon style={{ fontSize: 16 }} />} label="PDF" color="rgba(255,255,255,0.85)" onClick={handleTelechargerPDF} />
          <ActionBtn icon={<PrintIcon style={{ fontSize: 16 }} />} label="Imprimer" color="rgba(255,255,255,0.85)" onClick={handleImprimer} />
          {facture.statut === 'brouillon' && !editing && (
            <ActionBtn icon={<EditIcon style={{ fontSize: 16 }} />} label="Modifier" color="#60a5fa" onClick={() => { setEditing(true); setEditLignes(JSON.parse(JSON.stringify(facture.lignes || []))) }} />
          )}
          {editing && (
            <ActionBtn icon={<SaveIcon style={{ fontSize: 16 }} />} label="Sauvegarder" color="#16a34a" onClick={async () => {
              const totalHT = editLignes.reduce((s, l) => s + (l.montantHT || 0), 0)
              const totalTVA = editLignes.reduce((s, l) => s + (l.montantTVA || 0), 0)
              await updateDoc(doc(db, 'factures', id), { lignes: editLignes, totalHT, totalTVA, totalTTC: totalHT + totalTVA })
              setFacture(f => ({ ...f, lignes: editLignes, totalHT, totalTVA, totalTTC: totalHT + totalTVA }))
              setEditing(false)
              await showModal({ type: 'info', title: 'Facture modifiée', message: 'Les modifications ont été enregistrées.' })
            }} />
          )}
          {peutArchiver && (
            <ActionBtn icon={<ArchiveIcon style={{ fontSize: 16 }} />} label="Archiver" color="#fca5a5" onClick={handleArchiver} />
          )}
        </div>
      </div>

      <div style={{ padding: isMobile ? '14px 14px 32px' : '20px 24px 40px', maxWidth: 820, margin: '0 auto' }}>

        {/* Client & Chantier */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Card titre="Client">
            <Row label="Nom"     value={client?.nom || '—'} />
            <Row label="Type"    value={client?.type === 'pro' ? 'Professionnel' : 'Particulier'} />
            {client?.adresse && (
              <Row label="Adresse" value={`${client.adresse.rue || ''}, ${client.adresse.cp || ''} ${client.adresse.ville || ''}`} />
            )}
            {client?.siret && <Row label="SIRET" value={client.siret} />}
          </Card>
          <Card titre="Chantier">
            <Row label="Nom"    value={chantier?.nom || '—'} />
            <Row label="Type"   value={{ neuf: 'Neuf', renovation: 'Rénovation', location: 'Location' }[chantier?.typeChantier] || '—'} />
            {chantier?.adresse && (
              <Row label="Adresse" value={`${chantier.adresse.rue || ''}, ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`} />
            )}
          </Card>
        </div>

        {/* Dates */}
        <Card titre="Dates & TVA" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
            <MiniStat label="Émission"  value={formatDate(facture.dateEmission)} />
            <MiniStat label="Échéance"  value={formatDate(facture.dateEcheance)} />
            <MiniStat label="Régime TVA" value={formatTauxTVA(facture.lignes?.[0]?.tauxTVA ?? 0.20)} />
            <MiniStat label="Statut"    value={formatStatut(facture.statut)} />
          </div>
          {facture.mentionLegale && (
            <p style={{ fontSize: 11, color: '#c2410c', margin: '10px 0 0', fontStyle: 'italic' }}>{facture.mentionLegale}</p>
          )}
        </Card>

        {/* Lignes */}
        <Card titre={`Lignes de facturation (${facture.lignes?.length || 0})${editing ? ' — Mode édition' : ''}`} style={{ marginBottom: 12 }}>
          {editing && editLignes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {editLignes.map((l, i) => (
                <div key={l.id || i} style={{ background: '#f7f9ff', borderRadius: 10, padding: '12px 14px', border: '1.5px solid #e2e4ea' }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Description</label>
                  <input value={l.description || ''} onChange={e => { const n = [...editLignes]; n[i] = { ...n[i], description: e.target.value }; setEditLignes(n) }}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#fff', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 12px', fontSize: 14, marginBottom: 8, outline: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Montant HT (€)</label>
                      <input type="number" step="0.01" value={l.montantHT || 0} onChange={e => {
                        const ht = parseFloat(e.target.value) || 0
                        const tva = Math.round(ht * (l.tauxTVA || 0.20) * 100) / 100
                        const n = [...editLignes]; n[i] = { ...n[i], montantHT: ht, montantTVA: tva, montantTTC: ht + tva }; setEditLignes(n)
                      }} style={{ width: '100%', boxSizing: 'border-box', background: '#fff', border: '1.5px solid #e2e4ea', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>TTC</label>
                      <p style={{ fontSize: 16, fontWeight: 700, color: '#0d3580', margin: '8px 0 0' }}>{formatEuro((l.montantHT || 0) + (l.montantTVA || 0))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(facture.lignes || []).map((l, i) => (
                <div key={l.id || i} style={{ background: '#F7F8FA', borderRadius: 8, padding: '10px 12px' }}>
                  <p style={{ fontSize: 13, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>{l.description || `Ligne ${i + 1}`}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
                    {l.type === 'regie'
                      ? `${l.nbOuvriers || 0} ouv. × ${l.nbJours || 0}j × ${formatEuro(l.tauxJournalier)}`
                      : `${l.quantite || 0} × ${formatEuro(l.prixUnitaireHT)}`}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>HT : {formatEuro(l.montantHT)}</span>
                    <span style={{ fontSize: 13, fontWeight: '600', color: '#0d3580' }}>TTC : {formatEuro(l.montantTTC)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e4ea' }}>
                  {['Description', 'Détail', 'HT', 'TVA', 'TTC'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Description' ? 'left' : 'right', padding: '6px 8px', fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(facture.lignes || []).map((l, i) => (
                  <tr key={l.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 8px', color: '#111111', fontWeight: '500' }}>{l.description || `Ligne ${i + 1}`}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
                      {l.type === 'regie'
                        ? `${l.nbOuvriers || 0} × ${l.nbJours || 0}j × ${formatEuro(l.tauxJournalier)}`
                        : `${l.quantite || 0} × ${formatEuro(l.prixUnitaireHT)}`}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#111111' }}>{formatEuro(l.montantHT)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: '#6b7280' }}>{formatEuro(l.montantTVA)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '600', color: '#0d3580' }}>{formatEuro(l.montantTTC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Totaux */}
        <div style={{ background: '#0d3580', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <TotalRow label="Total HT"  value={facture.totalHT}  small />
          <TotalRow label={`TVA (${formatTauxTVA(facture.lignes?.[0]?.tauxTVA ?? 0.20)})`} value={facture.totalTVA} small />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '10px 0' }} />
          <TotalRow label="Total TTC" value={facture.totalTTC} big />
          {(facture.totalPaye || 0) > 0 && <>
            <TotalRow label="Déjà payé"      value={facture.totalPaye} small green />
            <TotalRow label="Solde restant"  value={facture.solde}     small red />
          </>}
        </div>

        {/* Paiements */}
        {(facture.paiements || []).length > 0 && (
          <Card titre="Paiements reçus" style={{ marginBottom: 12 }}>
            {facture.paiements.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < facture.paiements.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: '500', color: '#111111', margin: 0 }}>
                    {MODES_LABELS[p.mode] || p.mode}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '1px 0 0' }}>{formatDate(p.date)}</p>
                </div>
                <span style={{ fontSize: 15, fontWeight: '600', color: '#16a34a' }}>{formatEuro(p.montant)}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Notes */}
        {facture.notes && (
          <Card titre="Notes">
            <p style={{ fontSize: 13, color: '#3d3d3d', margin: 0, lineHeight: 1.5 }}>{facture.notes}</p>
          </Card>
        )}
      </div>

      {/* Modal email */}
      {emailModal && (
        <EmailModal data={emailModal} onClose={() => setEmailModal(null)} />
      )}

      {/* Modal paiement */}
      {paiementModal && (
        <PaiementModal
          solde={facture.solde || facture.totalTTC || 0}
          onClose={() => setPaiementModal(false)}
          onConfirm={handleMarquerPayee}
        />
      )}
    </div>
  )
}

// ─── Modal email ─────────────────────────────────────────────────────────────
function EmailModal({ data, onClose }) {
  const { to, subject, body, pdfUrl } = data
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  function copier(texte) {
    navigator.clipboard.writeText(texte).catch(() => {})
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
        <h2 style={{ fontSize: 17, fontWeight: '700', color: '#111111', margin: '0 0 4px' }}>Envoyer la facture</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>Le PDF est prêt. Cliquez sur le bouton pour ouvrir votre client email.</p>

        <div style={{ background: '#F0F2F7', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destinataire</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: '500', color: '#111111' }}>{to}</span>
            <button onClick={() => copier(to)} style={{ fontSize: 11, color: '#0d3580', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Copier</button>
          </div>
        </div>

        {pdfUrl && (
          <div style={{ background: '#F0F2F7', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lien PDF</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#0d3580', wordBreak: 'break-all', flex: 1 }}>{pdfUrl.slice(0, 50)}…</span>
              <button onClick={() => copier(pdfUrl)} style={{ fontSize: 11, color: '#0d3580', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>Copier</button>
            </div>
          </div>
        )}

        <a
          href={mailto}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box', background: '#0d3580', color: '#fff', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: '600', textDecoration: 'none', marginBottom: 10 }}
        >
          ✉️ Ouvrir mon client email
        </a>

        <button onClick={onClose} style={{ width: '100%', background: '#F0F2F7', color: '#374151', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    </div>
  )
}

// ─── Modal saisie paiement ───────────────────────────────────────────────────
const MODES_LABELS = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', prelevement: 'Prélèvement' }

function PaiementModal({ solde, onClose, onConfirm }) {
  const [montant, setMontant] = useState(String(solde))
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0])
  const [mode,    setMode]    = useState('virement')
  const [saving,  setSaving]  = useState(false)

  async function submit() {
    const m = parseFloat(montant)
    if (!m || m <= 0) return
    setSaving(true)
    await onConfirm({ montant: m, date, mode })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
        <h2 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: '0 0 4px' }}>Enregistrer un paiement</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>Solde restant : {formatEuro(solde)}</p>

        <Label>Montant (€)</Label>
        <input
          type="number" value={montant} onChange={e => setMontant(e.target.value)}
          inputMode="decimal" step="0.01"
          style={inpS}
        />

        <Label style={{ marginTop: 12 }}>Date de réception</Label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inpS} />

        <Label style={{ marginTop: 12 }}>Mode de paiement</Label>
        <select value={mode} onChange={e => setMode(e.target.value)} style={inpS}>
          {Object.entries(MODES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={submit} disabled={saving || !montant || parseFloat(montant) <= 0}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            <CheckCircleIcon style={{ fontSize: 16 }} />
            {saving ? 'Enregistrement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Composants locaux ───────────────────────────────────────────────────────
function Card({ titre, children, style }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '14px 18px', ...style }}>
      <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>{titre}</p>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: '500', color: '#111111', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: '#F7F8FA', borderRadius: 8, padding: '10px 12px' }}>
      <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>{value}</p>
    </div>
  )
}

function TotalRow({ label, value, small, big, green, red }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: big ? 0 : 6 }}>
      <span style={{ fontSize: small ? 12 : 14, color: small ? 'rgba(255,255,255,0.65)' : '#fff', fontWeight: small ? '400' : '600' }}>{label}</span>
      <span style={{ fontSize: big ? 20 : 14, fontWeight: big ? '700' : '500', color: green ? '#86efac' : red ? '#fca5a5' : '#fff' }}>
        {formatEuro(value)}
      </span>
    </div>
  )
}

function ActionBtn({ icon, label, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: '500', color, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.6 : 1 }}
    >
      {icon}{label}
    </button>
  )
}

function Label({ children, style }) {
  return (
    <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px', ...style }}>{children}</p>
  )
}

const inpS = {
  width: '100%', boxSizing: 'border-box',
  background: '#F0F2F7', border: '1.5px solid transparent',
  borderRadius: 8, padding: '10px 12px', fontSize: 14,
  color: '#111111', outline: 'none', display: 'block',
}
