import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useDevis }      from '../../hooks/useDevis'
import { useModal }      from '../../context/ModalContext'
import { useResponsive } from '../../hooks/useResponsive'
import { useParametres } from '../../hooks/useParametres'
import { generateFacturePDF } from '../../utils/pdfGenerator'
import { formatEuro, formatDate, formatStatut, formatTauxTVA } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import ArrowBackIcon     from '@mui/icons-material/ArrowBack'
import PictureAsPdfIcon  from '@mui/icons-material/PictureAsPdf'
import CheckCircleIcon   from '@mui/icons-material/CheckCircle'
import CancelIcon        from '@mui/icons-material/Cancel'
import SwapHorizIcon     from '@mui/icons-material/SwapHoriz'

export default function DevisDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { isMobile } = useResponsive()
  const { showModal } = useModal()
  const { mettreAJourDevis, convertirEnFacture } = useDevis()
  const { parametres } = useParametres()

  const [devis,    setDevis]    = useState(null)
  const [client,   setClient]   = useState(null)
  const [chantier, setChantier] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'devis', id))
      if (!snap.exists()) { navigate('/devis'); return }
      const data = { id: snap.id, ...snap.data() }
      setDevis(data)

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

  async function recharger() {
    const snap = await getDoc(doc(db, 'devis', id))
    if (snap.exists()) setDevis({ id: snap.id, ...snap.data() })
  }

  async function handleAccepter() {
    const ok = await showModal({
      type: 'confirm',
      title: 'Marquer ce devis accepté ?',
      message: `${devis.numero} · ${client?.nom || ''}\nLe devis pourra ensuite être converti en facture.`,
      confirmLabel: 'Marquer accepté',
    })
    if (!ok) return
    await mettreAJourDevis(id, { statut: 'accepte' })
    await recharger()
    await showModal({ type: 'info', title: 'Devis accepté !', message: `${devis.numero} marqué comme accepté.` })
  }

  async function handleRefuser() {
    const ok = await showModal({
      type: 'danger',
      title: 'Marquer ce devis refusé ?',
      message: `${devis.numero} · ${client?.nom || ''}`,
      confirmLabel: 'Marquer refusé',
    })
    if (!ok) return
    await mettreAJourDevis(id, { statut: 'refuse' })
    await recharger()
  }

  async function handleConvertir() {
    const ok = await showModal({
      type: 'confirm',
      title: 'Convertir en facture ?',
      message: `${devis.numero} · ${formatEuro(devis.totalTTC)}\nUne nouvelle facture brouillon sera créée avec les mêmes lignes.`,
      confirmLabel: 'Convertir',
    })
    if (!ok) return
    const factureId = await convertirEnFacture(id, devis)
    await showModal({ type: 'info', title: 'Facture créée !', message: `${devis.numero} converti avec succès.` })
    navigate(`/factures/${factureId}`)
  }

  async function handlePDF() {
    const blob = await generateFacturePDF(
      { ...devis, dateEcheance: devis.dateValidite },
      client || {},
      chantier || {},
      parametres || {},
      'devis'
    )
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = `${devis.numero}.pdf`; a.click()
    URL.revokeObjectURL(url)
    await showModal({ type: 'info', title: 'PDF généré !', message: `${devis.numero}.pdf téléchargé.` })
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', fontFamily: 'system-ui' }}>Chargement…</div>
  if (!devis)  return null

  const isExpire = (() => {
    if (!devis.dateValidite || devis.statut !== 'envoye') return false
    const d = devis.dateValidite?.toDate ? devis.dateValidite.toDate() : new Date(devis.dateValidite)
    return d < new Date()
  })()

  const joursRestants = (() => {
    if (!devis.dateValidite) return null
    const d = devis.dateValidite?.toDate ? devis.dateValidite.toDate() : new Date(devis.dateValidite)
    return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24))
  })()

  const statutEff = isExpire ? 'expire' : devis.statut
  const badge     = BADGES[statutEff] || BADGES.brouillon

  const peutAccepter  = ['brouillon', 'envoye'].includes(devis.statut)
  const peutRefuser   = ['brouillon', 'envoye'].includes(devis.statut)
  const peutConvertir = devis.statut === 'accepte' && !devis.factureId

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: isMobile ? '14px 16px' : '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button
            onClick={() => navigate('/devis')}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}
          >
            <ArrowBackIcon style={{ fontSize: 20 }} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: '700', color: '#fff', margin: 0 }}>{devis.numero}</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>
              Émis le {formatDate(devis.dateEmission)}
              {devis.statut === 'envoye' && !isExpire && joursRestants !== null && (
                <span style={{ marginLeft: 8, color: joursRestants <= 3 ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
                  · Expire dans {joursRestants}j
                </span>
              )}
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: '600', padding: '4px 10px', borderRadius: 20, ...badge }}>
            {isExpire ? 'Expiré' : formatStatut(devis.statut)}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {peutConvertir && (
            <ActionBtn icon={<SwapHorizIcon style={{ fontSize: 16 }} />} label="Convertir en facture" color="#86efac" onClick={handleConvertir} />
          )}
          {peutAccepter && (
            <ActionBtn icon={<CheckCircleIcon style={{ fontSize: 16 }} />} label="Accepté" color="rgba(255,255,255,0.85)" onClick={handleAccepter} />
          )}
          {peutRefuser && (
            <ActionBtn icon={<CancelIcon style={{ fontSize: 16 }} />} label="Refusé" color="#fca5a5" onClick={handleRefuser} />
          )}
          <ActionBtn icon={<PictureAsPdfIcon style={{ fontSize: 16 }} />} label="PDF" color="rgba(255,255,255,0.85)" onClick={handlePDF} />
          {devis.factureId && (
            <ActionBtn icon={<SwapHorizIcon style={{ fontSize: 16 }} />} label="Voir la facture" color="#86efac" onClick={() => navigate(`/factures/${devis.factureId}`)} />
          )}
        </div>
      </div>

      <div style={{ padding: isMobile ? '14px 14px 32px' : '20px 24px 40px', maxWidth: 820, margin: '0 auto' }}>

        {/* Client & Chantier */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Card titre="Client">
            <Row label="Nom"    value={client?.nom || '—'} />
            <Row label="Type"   value={client?.type === 'pro' ? 'Professionnel' : 'Particulier'} />
            {client?.adresse && (
              <Row label="Adresse" value={`${client.adresse.rue || ''}, ${client.adresse.cp || ''} ${client.adresse.ville || ''}`} />
            )}
          </Card>
          <Card titre="Chantier">
            <Row label="Nom"  value={chantier?.nom || '—'} />
            <Row label="Type" value={{ neuf: 'Neuf', renovation: 'Rénovation', location: 'Location' }[chantier?.typeChantier] || '—'} />
            {chantier?.adresse && (
              <Row label="Adresse" value={`${chantier.adresse.rue || ''}, ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}`} />
            )}
          </Card>
        </div>

        {/* Dates */}
        <Card titre="Dates & TVA" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10 }}>
            <MiniStat label="Émission"   value={formatDate(devis.dateEmission)} />
            <MiniStat label="Validité"   value={formatDate(devis.dateValidite)} />
            <MiniStat label="Régime TVA" value={formatTauxTVA(devis.lignes?.[0]?.tauxTVA ?? 0.20)} />
          </div>
          {devis.mentionLegale && (
            <p style={{ fontSize: 11, color: '#c2410c', margin: '10px 0 0', fontStyle: 'italic' }}>{devis.mentionLegale}</p>
          )}
        </Card>

        {/* Lignes */}
        <Card titre={`Lignes (${devis.lignes?.length || 0})`} style={{ marginBottom: 12 }}>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(devis.lignes || []).map((l, i) => (
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
                {(devis.lignes || []).map((l, i) => (
                  <tr key={l.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', color: '#111111', fontWeight: '500' }}>{l.description || `Ligne ${i + 1}`}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
                      {l.type === 'regie'
                        ? `${l.nbOuvriers || 0} × ${l.nbJours || 0}j × ${formatEuro(l.tauxJournalier)}`
                        : `${l.quantite || 0} × ${formatEuro(l.prixUnitaireHT)}`}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatEuro(l.montantHT)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280' }}>{formatEuro(l.montantTVA)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#0d3580' }}>{formatEuro(l.montantTTC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Totaux */}
        <div style={{ background: '#0d3580', borderRadius: 12, padding: '16px 20px', marginBottom: 12 }}>
          <TotalRow label="Total HT"  value={devis.totalHT}  small />
          <TotalRow label={`TVA (${formatTauxTVA(devis.lignes?.[0]?.tauxTVA ?? 0.20)})`} value={devis.totalTVA} small />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', margin: '10px 0' }} />
          <TotalRow label="Total TTC" value={devis.totalTTC} big />
        </div>

        {/* Notes */}
        {devis.notes && (
          <Card titre="Notes">
            <p style={{ fontSize: 13, color: '#3d3d3d', margin: 0, lineHeight: 1.5 }}>{devis.notes}</p>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Composants locaux ────────────────────────────────────────────────────────
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

function TotalRow({ label, value, small, big }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: big ? 0 : 6 }}>
      <span style={{ fontSize: small ? 12 : 14, color: small ? 'rgba(255,255,255,0.65)' : '#fff', fontWeight: small ? '400' : '600' }}>{label}</span>
      <span style={{ fontSize: big ? 20 : 14, fontWeight: big ? '700' : '500', color: '#fff' }}>{formatEuro(value)}</span>
    </div>
  )
}

function ActionBtn({ icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: '500', color, cursor: 'pointer', whiteSpace: 'nowrap' }}
    >
      {icon}{label}
    </button>
  )
}
