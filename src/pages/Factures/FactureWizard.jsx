import { useState, useEffect, useMemo } from 'react'
import { v4 as uuid } from 'uuid'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db, STORAGE_ENABLED } from '../../firebase/config'
import { useFactures }   from '../../hooks/useFactures'
import { useClients }    from '../../hooks/useClients'
import { useChantiers }  from '../../hooks/useChantiers'
import { useParametres } from '../../hooks/useParametres'
import { calculerLigne, calculerTotaux, detecterTauxTVA } from '../../utils/calcFacture'
import { formatEuro, formatTauxTVA, addDays } from '../../utils/formatters'
import { generateFacturePDF, uploadAndGetPdfUrl } from '../../utils/pdfGenerator'
import { envoyerEmailFacture, EMAILJS_FACTURE_CONFIGURE } from '../../utils/emailFacture'
import { MENTION_AUTOLIQUIDATION } from '../../constants/tva'
import { WizardStepper } from '../../components/ui/WizardStepper'
import ArrowBackIcon  from '@mui/icons-material/ArrowBack'
import AddIcon        from '@mui/icons-material/Add'
import DeleteIcon     from '@mui/icons-material/Delete'
import CheckIcon      from '@mui/icons-material/Check'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

const ETAPES = ['Client & Chantier', 'Lignes', 'Dates & Options', 'Aperçu']

const LIGNE_VIDE_REGIE = (tauxJournalier = 0, tauxTVA = 0.20) => ({
  id: uuid(), type: 'regie', description: 'Prestation régie',
  nbOuvriers: 1, nbJours: 1, tauxJournalier,
  quantite: 0, prixUnitaireHT: 0, tauxTVA,
  montantHT: 0, montantTVA: 0, montantTTC: 0,
})

const LIGNE_VIDE_FORFAIT = (type = 'forfait', tauxTVA = 0.20) => ({
  id: uuid(), type, description: '',
  nbOuvriers: 0, nbJours: 0, tauxJournalier: 0,
  quantite: 1, prixUnitaireHT: 0, tauxTVA,
  montantHT: 0, montantTVA: 0, montantTTC: 0,
})

export default function FactureWizard({ onClose, mode = 'facture', devisSource = null, voiceData = null }) {
  const { creerFacture }   = useFactures()
  const { clients }        = useClients()
  const { chantiers }      = useChantiers()
  const { parametres }     = useParametres()

  const [etape,      setEtape]     = useState(voiceData?.clientId ? 1 : 0)
  const [saving,     setSaving]    = useState(false)
  const [clientId,   setClientId]  = useState(devisSource?.clientId || voiceData?.clientId || '')
  const [chantierId, setChantierId]= useState(devisSource?.chantierId || voiceData?.chantierId || '')
  const [estSousTraitance, setEstSousTraitance] = useState(false)

  const voiceLigne = voiceData ? (() => {
    if (voiceData.type === 'regie') {
      return [LIGNE_VIDE_REGIE(voiceData.tauxJournalier || parametres?.tauxJournauxDefaut?.ouvrier || 220, 0.20)]
        .map(l => ({ ...l, description: voiceData.description || l.description, nbOuvriers: voiceData.nbOuvriers || l.nbOuvriers, nbJours: voiceData.nbJours || l.nbJours, tauxJournalier: voiceData.tauxJournalier || l.tauxJournalier }))
    }
    return [LIGNE_VIDE_FORFAIT('forfait', 0.20)]
      .map(l => ({ ...l, description: voiceData.description || '', prixUnitaireHT: voiceData.montantForfait || 0 }))
  })() : null

  const [lignes, setLignes] = useState(devisSource?.lignes || voiceLigne || [])
  const [dateEmission,  setDateEmission]  = useState(new Date().toISOString().split('T')[0])
  const [dateEcheance,  setDateEcheance]  = useState(addDays(new Date(), 30).toISOString().split('T')[0])
  const [dateValidite,  setDateValidite]  = useState(addDays(new Date(), 15).toISOString().split('T')[0])
  const [notes,      setNotes]     = useState('')

  const client   = clients.find(c => c.id === clientId)
  const chantier = chantiers.find(c => c.id === chantierId)

  const chantiersClient = useMemo(
    () => chantiers.filter(c => c.clientId === clientId),
    [chantiers, clientId]
  )

  const tvaDonnees = useMemo(() => {
    if (!client || !chantier) return { tauxTVA: 0.20, regimeTVA: 'normal', mentionLegale: null }
    return detecterTauxTVA({
      typeClient:    client.type,
      typeChantier:  chantier.typeChantier,
      estSousTraitance,
    })
  }, [client, chantier, estSousTraitance])

  const lignesCalculees = useMemo(() => lignes.map(l => calculerLigne({ ...l, tauxTVA: tvaDonnees.tauxTVA })), [lignes, tvaDonnees.tauxTVA])
  const totaux          = useMemo(() => calculerTotaux(lignesCalculees), [lignesCalculees])

  function ajouterLigne(type) {
    const tauxJ = type === 'regie' ? (parametres?.tauxJournauxDefaut?.ouvrier || 220) : 0
    setLignes(prev => [...prev, type === 'regie' ? LIGNE_VIDE_REGIE(tauxJ, tvaDonnees.tauxTVA) : LIGNE_VIDE_FORFAIT(type, tvaDonnees.tauxTVA)])
  }

  function modifierLigne(id, champ, valeur) {
    setLignes(prev => prev.map(l => l.id === id ? { ...l, [champ]: valeur } : l))
  }

  function supprimerLigne(id) {
    setLignes(prev => prev.filter(l => l.id !== id))
  }

  async function sauvegarder(statut) {
    setSaving(true)
    try {
      const data = {
        clientId, chantierId, statut,
        dateEmission:   new Date(dateEmission),
        dateEcheance:   mode === 'devis' ? null : new Date(dateEcheance),
        dateValidite:   mode === 'devis' ? new Date(dateValidite) : null,
        lignes:         lignesCalculees,
        regimeTVA:      tvaDonnees.regimeTVA,
        mentionLegale:  tvaDonnees.mentionLegale,
        notes,
      }
      const id = await creerFacture(data)

      const doitEnvoyer = (statut === 'envoyee' || statut === 'envoye') && client?.email
      if (doitEnvoyer) {
        try {
          const snap       = await getDoc(doc(db, 'factures', id))
          const factureDoc = { id, ...snap.data() }

          const blob = await generateFacturePDF(factureDoc, client, chantier || {}, parametres || {})
          let pdfUrl = null

          if (STORAGE_ENABLED) {
            pdfUrl = await uploadAndGetPdfUrl(blob, `factures/${id}/facture.pdf`)
            await updateDoc(doc(db, 'factures', id), { pdfUrl })
          }

          if (EMAILJS_FACTURE_CONFIGURE) {
            await envoyerEmailFacture({
              facture:    factureDoc,
              client,
              pdfUrl,
              societeNom: parametres?.raisonSociale || 'Scaffold-OS',
            })
          }
        } catch (emailErr) {
          console.warn('Erreur email :', emailErr)
          alert('Facture enregistrée, mais l\'email n\'a pas pu être envoyé. Envoyez manuellement depuis la fiche facture.')
        }
      }

      onClose()
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la sauvegarde : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function telechargerPDF() {
    const blob = await generateFacturePDF(
      { ...totaux, lignes: lignesCalculees, numero: 'APERÇU', dateEmission: new Date(dateEmission), dateEcheance: new Date(dateEcheance), regimeTVA: tvaDonnees.regimeTVA, mentionLegale: tvaDonnees.mentionLegale },
      client || {},
      chantier || {},
      parametres || {}
    )
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const s = { fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F7F8FA', minHeight: '100vh' }

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
          <ArrowBackIcon />
        </button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>
            {mode === 'devis' ? 'Nouveau devis' : 'Nouvelle facture'}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>Étape {etape + 1} / {ETAPES.length}</p>
        </div>
      </div>

      <WizardStepper
        currentStep={etape}
        steps={[
          { label: 'Client', subtitle: client?.nom },
          { label: 'Lignes', subtitle: lignes.length > 0 ? `${lignes.length} ligne(s)` : undefined },
          { label: 'Dates', subtitle: dateEcheance },
          { label: 'Aperçu', subtitle: 'Vérifier' },
        ]}
      />

      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        {etape === 0 && (
          <EtapeClientChantier
            clients={clients} chantiers={chantiersClient}
            clientId={clientId} setClientId={(id) => { setClientId(id); setChantierId('') }}
            chantierId={chantierId} setChantierId={setChantierId}
            estSousTraitance={estSousTraitance} setEstSousTraitance={setEstSousTraitance}
            tvaDonnees={tvaDonnees}
            onNext={() => setEtape(1)} canNext={!!clientId && !!chantierId}
          />
        )}
        {etape === 1 && (
          <EtapeLignes
            lignes={lignes} lignesCalculees={lignesCalculees} totaux={totaux}
            tvaDonnees={tvaDonnees}
            onAjouter={ajouterLigne} onModifier={modifierLigne} onSupprimer={supprimerLigne}
            onPrev={() => setEtape(0)} onNext={() => setEtape(2)}
          />
        )}
        {etape === 2 && (
          <EtapeDates
            mode={mode}
            dateEmission={dateEmission} setDateEmission={setDateEmission}
            dateEcheance={dateEcheance} setDateEcheance={setDateEcheance}
            dateValidite={dateValidite} setDateValidite={setDateValidite}
            notes={notes} setNotes={setNotes}
            onPrev={() => setEtape(1)} onNext={() => setEtape(3)}
          />
        )}
        {etape === 3 && (
          <EtapeApercu
            mode={mode} client={client} chantier={chantier}
            lignesCalculees={lignesCalculees} totaux={totaux}
            tvaDonnees={tvaDonnees} dateEmission={dateEmission}
            dateEcheance={dateEcheance} notes={notes}
            saving={saving}
            onPrev={() => setEtape(2)}
            onSauvegarder={sauvegarder}
            onTelechargerPDF={telechargerPDF}
          />
        )}
      </div>
    </div>
  )
}

function EtapeClientChantier({ clients, chantiers, clientId, setClientId, chantierId, setChantierId, estSousTraitance, setEstSousTraitance, tvaDonnees, onNext, canNext }) {
  const badgeTVA = {
    normal:          { bg: '#dbeafe', color: '#1d4ed8', label: 'TVA 20 %' },
    reduit:          { bg: '#dcfce7', color: '#16a34a', label: 'TVA 10 % (rénovation)' },
    autoliquidation: { bg: '#ffedd5', color: '#c2410c', label: 'Autoliquidation — 0 %' },
  }[tvaDonnees.regimeTVA] || {}

  return (
    <div>
      <Card label="Sélectionner le client">
        <SelectField label="Client" value={clientId} onChange={setClientId} options={clients.map(c => ({ value: c.id, label: c.nom }))} placeholder="Choisir un client…" />
      </Card>

      {clientId && (
        <Card label="Chantier lié" style={{ marginTop: 12 }}>
          {chantiers.length === 0
            ? <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Aucun chantier pour ce client.</p>
            : <SelectField label="Chantier" value={chantierId} onChange={setChantierId} options={chantiers.map(c => ({ value: c.id, label: c.nom }))} placeholder="Choisir un chantier…" />
          }
        </Card>
      )}

      {clientId && chantierId && (
        <Card label="Régime TVA" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={estSousTraitance} onChange={e => setEstSousTraitance(e.target.checked)} />
            <span style={{ fontSize: 13, color: '#111111' }}>Sous-traitance BTP (art. 283-2 nonies)</span>
          </label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: badgeTVA.bg, color: badgeTVA.color, borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: '600' }}>
            {badgeTVA.label}
          </div>
          {tvaDonnees.mentionLegale && (
            <p style={{ fontSize: 11, color: '#c2410c', marginTop: 8, fontStyle: 'italic' }}>{tvaDonnees.mentionLegale}</p>
          )}
        </Card>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button onClick={onNext} disabled={!canNext} style={{ background: canNext ? '#0d3580' : '#c8d3ee', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: '600', cursor: canNext ? 'pointer' : 'not-allowed' }}>
          Suivant →
        </button>
      </div>
    </div>
  )
}

function EtapeLignes({ lignes, lignesCalculees, totaux, tvaDonnees, onAjouter, onModifier, onSupprimer, onPrev, onNext }) {
  return (
    <div>
      {lignesCalculees.map((ligne, idx) => (
        <Card key={ligne.id} label={`Ligne ${idx + 1} — ${ligne.type === 'regie' ? 'Régie' : ligne.type === 'forfait' ? 'Forfait' : 'Location'}`} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TextField label="Description" value={ligne.description} onChange={v => onModifier(ligne.id, 'description', v)} />
            {ligne.type === 'regie' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <NumberField label="Nb ouvriers" value={ligne.nbOuvriers} onChange={v => onModifier(ligne.id, 'nbOuvriers', v)} min={1} />
                <NumberField label="Nb jours" value={ligne.nbJours} onChange={v => onModifier(ligne.id, 'nbJours', v)} step={0.5} min={0.5} />
                <NumberField label="Taux jour (€ HT)" value={ligne.tauxJournalier} onChange={v => onModifier(ligne.id, 'tauxJournalier', v)} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <NumberField label="Quantité" value={ligne.quantite} onChange={v => onModifier(ligne.id, 'quantite', v)} min={0} />
                <NumberField label="Prix unitaire HT (€)" value={ligne.prixUnitaireHT} onChange={v => onModifier(ligne.id, 'prixUnitaireHT', v)} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #e2e4ea' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>TVA : {formatTauxTVA(tvaDonnees.tauxTVA)}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 14, fontWeight: '600', color: '#0d3580' }}>HT : {formatEuro(ligne.montantHT)}</span>
                <span style={{ fontSize: 14, fontWeight: '600', color: '#111111' }}>TTC : {formatEuro(ligne.montantTTC)}</span>
                <button onClick={() => onSupprimer(ligne.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626', display: 'flex' }}>
                  <DeleteIcon style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          </div>
        </Card>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {[['regie', 'Régie'], ['forfait', 'Forfait'], ['location', 'Location']].map(([type, label]) => (
          <button key={type} onClick={() => onAjouter(type)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#e8edf8', color: '#0d3580', border: '1.5px dashed #0d3580', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: '500', cursor: 'pointer' }}>
            <AddIcon style={{ fontSize: 16 }} />+ {label}
          </button>
        ))}
      </div>

      {lignesCalculees.length > 0 && (
        <div style={{ background: '#0d3580', borderRadius: 10, padding: '14px 18px', marginTop: 16 }}>
          {[['Total HT', totaux.totalHT], ['TVA', totaux.totalTVA], ['Total TTC', totaux.totalTTC]].map(([label, val], i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < 2 ? 6 : 0, borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none', marginBottom: i < 2 ? 6 : 0 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
              <span style={{ fontSize: i === 2 ? 18 : 14, fontWeight: i === 2 ? '700' : '500', color: '#fff' }}>{formatEuro(val)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button onClick={onPrev} style={{ background: 'transparent', color: '#0d3580', border: '1.5px solid #0d3580', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>← Retour</button>
        <button onClick={onNext} disabled={lignes.length === 0} style={{ background: lignes.length > 0 ? '#0d3580' : '#c8d3ee', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: '600', cursor: lignes.length > 0 ? 'pointer' : 'not-allowed' }}>
          Suivant →
        </button>
      </div>
    </div>
  )
}

function EtapeDates({ mode, dateEmission, setDateEmission, dateEcheance, setDateEcheance, dateValidite, setDateValidite, notes, setNotes, onPrev, onNext }) {
  return (
    <div>
      <Card label="Dates">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DateField label="Date d'émission" value={dateEmission} onChange={setDateEmission} />
          {mode === 'devis'
            ? <DateField label="Date de validité" value={dateValidite} onChange={setDateValidite} />
            : <DateField label="Date d'échéance" value={dateEcheance} onChange={setDateEcheance} />
          }
        </div>
      </Card>
      <Card label="Notes" style={{ marginTop: 12 }}>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Conditions particulières, remarques…"
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', resize: 'vertical', outline: 'none' }}
        />
      </Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button onClick={onPrev} style={{ background: 'transparent', color: '#0d3580', border: '1.5px solid #0d3580', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>← Retour</button>
        <button onClick={onNext} style={{ background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>Aperçu →</button>
      </div>
    </div>
  )
}

function EtapeApercu({ mode, client, chantier, lignesCalculees, totaux, tvaDonnees, dateEmission, dateEcheance, notes, saving, onPrev, onSauvegarder, onTelechargerPDF }) {
  return (
    <div>
      <Card label="Récapitulatif">
        <Row label="Client"   value={client?.nom || '—'} />
        <Row label="Chantier" value={chantier?.nom || '—'} />
        <Row label="Régime TVA" value={formatTauxTVA(tvaDonnees.tauxTVA)} />
        <Row label="Lignes"   value={`${lignesCalculees.length} ligne(s)`} />
        <div style={{ marginTop: 12, padding: '12px', background: '#F0F2F7', borderRadius: 8 }}>
          {[['Total HT', totaux.totalHT], ['TVA', totaux.totalTVA], ['Total TTC', totaux.totalTTC]].map(([l, v], i) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < 2 ? 4 : 0 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{l}</span>
              <span style={{ fontSize: i === 2 ? 16 : 13, fontWeight: i === 2 ? '700' : '500', color: i === 2 ? '#0d3580' : '#111111' }}>{formatEuro(v)}</span>
            </div>
          ))}
        </div>
        {tvaDonnees.mentionLegale && (
          <p style={{ fontSize: 11, color: '#c2410c', marginTop: 8, fontStyle: 'italic' }}>{tvaDonnees.mentionLegale}</p>
        )}
        {notes && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Note : {notes}</p>}
      </Card>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={onTelechargerPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#e8edf8', color: '#0d3580', border: '1.5px solid #0d3580', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
          <PictureAsPdfIcon style={{ fontSize: 16 }} />Aperçu PDF
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onPrev} style={{ background: 'transparent', color: '#0d3580', border: '1.5px solid #0d3580', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>← Retour</button>
        <button onClick={() => onSauvegarder('brouillon')} disabled={saving} style={{ flex: 1, background: '#F0F2F7', color: '#111111', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer' }}>
          Brouillon
        </button>
        <button onClick={() => onSauvegarder(mode === 'devis' ? 'envoye' : 'envoyee')} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: '600', cursor: 'pointer' }}>
          <CheckIcon style={{ fontSize: 16 }} />
          {saving ? 'Enregistrement…' : `Enregistrer & envoyer`}
        </button>
      </div>
    </div>
  )
}

// ─── Petits composants réutilisables ───
function Card({ label, children, style }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 14, border: 'none', boxShadow: '0 1px 3px rgba(13,53,128,0.08), 0 4px 16px rgba(13,53,128,0.06)', padding: '16px 18px', ...style }}>
      <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>{label}</p>
      {children}
    </div>
  )
}
function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: '500', color: '#111111' }}>{value}</span>
    </div>
  )
}
function TextField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111111', outline: 'none' }} />
    </div>
  )
}
function NumberField({ label, value, onChange, min, step }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} min={min} step={step} style={{ width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111111', outline: 'none' }} />
    </div>
  )
}
function DateField({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#111111', outline: 'none' }} />
    </div>
  )
}
function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: value ? '#111111' : '#9ca3af', outline: 'none', cursor: 'pointer' }}>
        <option value="">{placeholder || 'Sélectionner…'}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
