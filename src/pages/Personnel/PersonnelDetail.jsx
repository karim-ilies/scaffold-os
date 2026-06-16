import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { decaisserAuto } from '../../firebase/helpers'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, STORAGE_ENABLED } from '../../firebase/config'
import { useModal } from '../../context/ModalContext'
import { usePersonnel, dechiffrer } from '../../hooks/usePersonnel'
import { formatDate, formatEuro } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import ArrowBackIcon        from '@mui/icons-material/ArrowBack'
import VisibilityIcon       from '@mui/icons-material/Visibility'
import VisibilityOffIcon    from '@mui/icons-material/VisibilityOff'
import UploadFileIcon       from '@mui/icons-material/UploadFile'
import EditIcon             from '@mui/icons-material/Edit'
import SaveIcon             from '@mui/icons-material/Save'
import AddIcon              from '@mui/icons-material/Add'
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth'
import WarningIcon          from '@mui/icons-material/Warning'
import PersonIcon           from '@mui/icons-material/Person'
import CloseIcon            from '@mui/icons-material/Close'
import EmojiEventsIcon      from '@mui/icons-material/EmojiEvents'

export default function PersonnelDetail() {
  const { id }          = useParams()
  const navigate        = useNavigate()
  const { showModal }   = useModal()
  const { mettreAJourOuvrier } = usePersonnel()

  const [ouvrier,     setOuvrier]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [onglet,      setOnglet]      = useState('infos')
  const [showConfid,  setShowConfid]  = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [form,        setForm]        = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [acompteOpen, setAcompteOpen] = useState(false)
  const [primeOpen,   setPrimeOpen]   = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'users', id)).then(snap => {
      if (snap.exists()) { const d = { id: snap.id, ...snap.data() }; setOuvrier(d); setForm(d) }
      setLoading(false)
    })
  }, [id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setAddr = (k, v) => setForm(f => ({ ...f, adresse: { ...f.adresse, [k]: v } }))

  async function handleSave() {
    setSaving(true)
    await mettreAJourOuvrier(id, form)
    setOuvrier(f => ({ ...f, ...form }))
    setSaving(false)
    setEditing(false)
    await showModal({ type: 'info', title: 'Ouvrier mis à jour !', message: `${form.prenom} ${form.nom} sauvegardé.` })
  }

  async function handleUploadDoc(file, type) {
    if (!file) return
    const path    = `documents/${id}/${Date.now()}_${file.name}`
    const storRef = ref(storage, path)
    await uploadBytes(storRef, file)
    const url = await getDownloadURL(storRef)
    const newDoc = { type, nom: file.name, url, dateAjout: new Date().toISOString(), dateExpiration: null }
    await updateDoc(doc(db, 'users', id), { documents: arrayUnion(newDoc), updatedAt: serverTimestamp() })
    setOuvrier(o => ({ ...o, documents: [...(o.documents || []), newDoc] }))
  }

  async function sauvegarderSurFiche(champ, valeur) {
    const moisCourant = new Date().toISOString().slice(0, 7)
    const ficheRef    = doc(db, 'fiches_mensuelles', `${id}_${moisCourant}`)
    const snap        = await getDoc(ficheRef)
    if (snap.exists()) {
      await updateDoc(ficheRef, { [champ]: arrayUnion(valeur) })
    } else {
      const bulletinInit = { statut: 'brouillon', acomptes: [], primes: [], ajustementsPatron: [] }
      if (champ === 'bulletin.acomptes') bulletinInit.acomptes = [valeur]
      if (champ === 'bulletin.primes')   bulletinInit.primes   = [valeur]
      await setDoc(ficheRef, {
        ouvrierId: id, mois: moisCourant, bulletin: bulletinInit,
        jours: {}, totalJoursTravailles: 0, totalHeuresNormales: 0, totalHeuresSupp25: 0, totalHeuresSupp50: 0,
        updatedAt: serverTimestamp(),
      })
    }
    return moisCourant
  }

  async function handleAcompte(montant, note) {
    const montantNum  = parseFloat(montant)
    const acompte     = { date: new Date().toISOString().split('T')[0], montant: montantNum, note }
    const moisCourant = await sauvegarderSurFiche('bulletin.acomptes', acompte)
    await decaisserAuto({
      label:       `Acompte — ${ouvrier.prenom} ${ouvrier.nom}`,
      montant:     montantNum,
      categorie:   'acompte',
      referenceId: id,
      date:        acompte.date,
    })
    setAcompteOpen(false)
    await showModal({ type: 'info', title: 'Acompte enregistré !', message: `${formatEuro(montantNum)} enregistré sur la fiche de ${moisCourant} et ajouté en trésorerie.` })
  }

  async function handlePrime(label, montant) {
    const montantNum  = parseFloat(montant)
    const prime       = { label, montant: montantNum }
    const moisCourant = await sauvegarderSurFiche('bulletin.primes', prime)
    await decaisserAuto({
      label:       `Prime — ${ouvrier.prenom} ${ouvrier.nom} · ${label}`,
      montant:     montantNum,
      categorie:   'acompte',
      referenceId: id,
      date:        new Date().toISOString().split('T')[0],
    })
    setPrimeOpen(false)
    await showModal({ type: 'info', title: 'Prime enregistrée !', message: `${label} · ${formatEuro(montantNum)} sur la fiche de ${moisCourant} et ajouté en trésorerie.` })
  }

  async function handleToggleActif() {
    const ok = await showModal({
      type: ouvrier.actif ? 'danger' : 'confirm',
      title: `${ouvrier.actif ? 'Désactiver' : 'Réactiver'} ${ouvrier.prenom} ${ouvrier.nom} ?`,
      message: ouvrier.actif ? 'Son accès sera révoqué immédiatement. Réactivable à tout moment.' : 'L\'accès sera restauré.',
      confirmLabel: ouvrier.actif ? 'Désactiver' : 'Réactiver',
      initials: `${ouvrier.prenom?.[0] || ''}${ouvrier.nom?.[0] || ''}`,
    })
    if (!ok) return
    await updateDoc(doc(db, 'users', id), { actif: !ouvrier.actif, updatedAt: serverTimestamp() })
    setOuvrier(o => ({ ...o, actif: !o.actif }))
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Chargement…</div>
  if (!ouvrier) return <div style={{ padding: 48, textAlign: 'center', color: '#dc2626' }}>Ouvrier introuvable</div>

  const initiales   = `${ouvrier.prenom?.[0] || ''}${ouvrier.nom?.[0] || ''}`.toUpperCase()
  const ROLE_LABELS = { patron: 'Patron', chef_equipe: 'Chef d\'équipe', ouvrier: 'Ouvrier', comptable: 'Comptable' }
  const docs        = ouvrier.documents || []
  const docsEnAlerte = docs.filter(d => d.dateExpiration && (new Date(d.dateExpiration) - new Date()) < 30 * 86400000)

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 20px' }}>
        <button onClick={() => navigate('/personnel')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
          <ArrowBackIcon style={{ fontSize: 16 }} />Personnel
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {ouvrier.photo
            ? <img src={ouvrier.photo} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
            : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: '700', color: '#fff' }}>{initiales}</div>
          }
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>{ouvrier.prenom} {ouvrier.nom}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: '600' }}>{ROLE_LABELS[ouvrier.role]}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: ouvrier.actif ? '#dcfce7' : '#fee2e2', color: ouvrier.actif ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                {ouvrier.actif ? 'Actif' : 'Inactif'}
              </span>
              {ouvrier.typeContrat && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#e8edf8', color: '#0d3580', fontWeight: '600' }}>{ouvrier.typeContrat}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate(`/personnel/${id}/fiches`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff', cursor: 'pointer' }}>
              <CalendarMonthIcon style={{ fontSize: 16 }} />Fiches
            </button>
            {editing ? (
              <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8A838', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '600', color: '#fff', cursor: 'pointer' }}>
                <SaveIcon style={{ fontSize: 16 }} />{saving ? '…' : 'Sauvegarder'}
              </button>
            ) : (
              <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
                <EditIcon style={{ fontSize: 18, color: '#fff' }} />
              </button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14, overflowX: 'auto' }}>
          {[['infos', 'Infos'], ['contrat', 'Contrat'], ['documents', `Documents${docsEnAlerte.length ? ' ⚠' : ''}`], ['actions', 'Actions']].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: onglet === k ? '600' : '400', background: onglet === k ? 'rgba(255,255,255,0.2)' : 'transparent', color: onglet === k ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─── INFOS ─── */}
        {onglet === 'infos' && (
          <Card titre="Informations personnelles">
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <F label="Prénom"><input value={form.prenom || ''} onChange={e => set('prenom', e.target.value)} style={inpS} /></F>
                  <F label="Nom"><input value={form.nom || ''} onChange={e => set('nom', e.target.value)} style={inpS} /></F>
                </div>
                <F label="Téléphone"><input value={form.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inpS} /></F>
                <F label="Email"><input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} style={inpS} /></F>
                <F label="Date de naissance"><input type="date" value={form.dateNaissance || ''} onChange={e => set('dateNaissance', e.target.value)} style={inpS} /></F>
                <F label="Adresse"><input value={form.adresse?.rue || ''} onChange={e => setAddr('rue', e.target.value)} style={inpS} placeholder="Rue" /></F>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <F label="CP"><input value={form.adresse?.cp || ''} onChange={e => setAddr('cp', e.target.value)} style={inpS} /></F>
                  <F label="Ville"><input value={form.adresse?.ville || ''} onChange={e => setAddr('ville', e.target.value)} style={inpS} /></F>
                </div>
                <p style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', margin: '8px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact urgence</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <F label="Nom"><input value={form.contactUrgence?.nom || ''} onChange={e => set('contactUrgence', { ...form.contactUrgence, nom: e.target.value })} style={inpS} /></F>
                  <F label="Téléphone"><input value={form.contactUrgence?.telephone || ''} onChange={e => set('contactUrgence', { ...form.contactUrgence, telephone: e.target.value })} style={inpS} /></F>
                </div>
              </div>
            ) : (
              <div>
                {[
                  ['Téléphone',         ouvrier.telephone],
                  ['Email',             ouvrier.email],
                  ['Né(e) le',          ouvrier.dateNaissance ? formatDate(ouvrier.dateNaissance) : null],
                  ['Adresse',           [ouvrier.adresse?.rue, ouvrier.adresse?.cp, ouvrier.adresse?.ville].filter(Boolean).join(', ')],
                  ouvrier.contactUrgence?.nom ? ['Contact urgence', `${ouvrier.contactUrgence.nom} — ${ouvrier.contactUrgence.telephone}`] : null,
                ].filter(Boolean).map(([k, v]) => v ? <Row key={k} l={k} v={v} /> : null)}

                {/* Infos confidentielles */}
                <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Infos confidentielles</p>
                    <button onClick={() => setShowConfid(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0d3580', fontWeight: '600' }}>
                      {showConfid ? <VisibilityOffIcon style={{ fontSize: 16 }} /> : <VisibilityIcon style={{ fontSize: 16 }} />}
                      {showConfid ? 'Masquer' : 'Révéler'}
                    </button>
                  </div>
                  {showConfid ? (
                    <>
                      <Row l="N° Sécu" v={ouvrier.numeroSecu ? dechiffrer(ouvrier.numeroSecu) : '—'} />
                      <Row l="IBAN"    v={ouvrier.iban        ? dechiffrer(ouvrier.iban)        : '—'} />
                    </>
                  ) : (
                    <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Cliquez sur « Révéler » pour afficher les données confidentielles</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ─── CONTRAT ─── */}
        {onglet === 'contrat' && (
          <Card titre="Informations contrat">
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <F label="Type de contrat">
                  <select value={form.typeContrat || 'CDI'} onChange={e => set('typeContrat', e.target.value)} style={inpS}>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="interim">Intérim</option>
                  </select>
                </F>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <F label="Date de début"><input type="date" value={form.dateDebut || ''} onChange={e => set('dateDebut', e.target.value)} style={inpS} /></F>
                  {form.typeContrat !== 'CDI' && <F label="Date de fin"><input type="date" value={form.dateFin || ''} onChange={e => set('dateFin', e.target.value)} style={inpS} /></F>}
                </div>
                <F label="Mode de paiement">
                  <select value={form.modePaiement || 'mensuel'} onChange={e => set('modePaiement', e.target.value)} style={inpS}>
                    <option value="mensuel">Salaire mensuel</option>
                    <option value="journalier">Taux journalier</option>
                  </select>
                </F>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <F label={form.modePaiement === 'journalier' ? 'Taux journalier (€)' : 'Salaire brut mensuel (€)'}>
                    <input type="number" step="0.01" value={form.salaireBrut || ''} onChange={e => set('salaireBrut', parseFloat(e.target.value))} style={inpS} inputMode="decimal" />
                  </F>
                  <F label="Taux fact. journalier (€)">
                    <input type="number" step="0.01" value={form.tauxJournalier || ''} onChange={e => set('tauxJournalier', parseFloat(e.target.value))} style={inpS} inputMode="decimal" />
                  </F>
                </div>
                {form.modePaiement === 'journalier' && (
                  <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontSize: 11, fontWeight: '600', color: '#92400e', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🌙 Taux nuit (chantiers de nuit)</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <F label="Salaire nuit (€/j)">
                        <input type="number" step="0.01" value={form.salaireBrutNuit || ''} onChange={e => set('salaireBrutNuit', parseFloat(e.target.value) || null)} style={inpS} inputMode="decimal" />
                      </F>
                      <F label="Taux fact. nuit (€/j)">
                        <input type="number" step="0.01" value={form.tauxJournalierNuit || ''} onChange={e => set('tauxJournalierNuit', parseFloat(e.target.value) || null)} style={inpS} inputMode="decimal" />
                      </F>
                    </div>
                  </div>
                )}
                <F label="IBAN (sera chiffré)"><input value={form.iban || ''} onChange={e => set('iban', e.target.value)} style={inpS} placeholder="FR76 xxxx xxxx xxxx xxxx" /></F>
                <F label="N° Sécurité Sociale (sera chiffré)"><input value={form.numeroSecu || ''} onChange={e => set('numeroSecu', e.target.value)} style={inpS} /></F>
              </div>
            ) : (
              <>
                <Row l="Type contrat"   v={ouvrier.typeContrat} />
                <Row l="Début contrat"  v={ouvrier.dateDebut ? formatDate(ouvrier.dateDebut) : '—'} />
                {ouvrier.dateFin && <Row l="Fin contrat"   v={formatDate(ouvrier.dateFin)} />}
                <Row l="Mode paiement"  v={ouvrier.modePaiement === 'journalier' ? 'Taux journalier' : 'Salaire mensuel'} />
                {ouvrier.modePaiement === 'journalier'
                  ? <Row l="Taux/jour"    v={formatEuro(ouvrier.salaireBrut || 0) + '/j'} />
                  : <Row l="Salaire brut" v={formatEuro(ouvrier.salaireBrut || 0) + '/mois'} />
                }
                <Row l="Taux fact."     v={formatEuro(ouvrier.tauxJournalier || 0) + '/j'} />
                {ouvrier.salaireBrutNuit    && <Row l="Salaire nuit"    v={formatEuro(ouvrier.salaireBrutNuit)    + '/j 🌙'} />}
                {ouvrier.tauxJournalierNuit && <Row l="Taux fact. nuit" v={formatEuro(ouvrier.tauxJournalierNuit) + '/j 🌙'} />}
              </>
            )}
          </Card>
        )}

        {/* ─── DOCUMENTS ─── */}
        {onglet === 'documents' && (
          <Card titre="Documents">
            {docsEnAlerte.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fee2e2', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#dc2626', fontWeight: '600' }}>
                <WarningIcon style={{ fontSize: 16 }} />{docsEnAlerte.length} document(s) expirant bientôt
              </div>
            )}

            {STORAGE_ENABLED ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e8edf8', border: '1.5px dashed #0d3580', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', marginBottom: 14, fontSize: 13, color: '#0d3580', fontWeight: '600' }}>
                <UploadFileIcon style={{ fontSize: 18 }} />Ajouter un document
                <input type="file" style={{ display: 'none' }} onChange={e => handleUploadDoc(e.target.files[0], 'autre')} />
              </label>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1.5px dashed #d1d5db', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#9ca3af', fontWeight: '500' }}>
                <UploadFileIcon style={{ fontSize: 18 }} />Upload de documents non disponible (forfait Spark)
              </div>
            )}

            {docs.length === 0
              ? <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24 }}>Aucun document</p>
              : docs.map((d, i) => {
                  const expiring = d.dateExpiration && (new Date(d.dateExpiration) - new Date()) < 30 * 86400000
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: '500', color: '#111111', margin: 0 }}>{d.nom}</p>
                        <p style={{ fontSize: 11, color: expiring ? '#dc2626' : '#6b7280', margin: '2px 0 0' }}>
                          {d.type} · {d.dateExpiration ? `Expire le ${formatDate(d.dateExpiration)}` : 'Pas de date d\'expiration'}
                        </p>
                      </div>
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#0d3580', fontWeight: '600', textDecoration: 'none' }}>Ouvrir</a>
                    </div>
                  )
                })
            }
          </Card>
        )}

        {/* ─── ACTIONS ─── */}
        {onglet === 'actions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card titre="Actions rapides">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setAcompteOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                  <AddIcon style={{ fontSize: 22, color: '#0d3580' }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>Enregistrer un acompte</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Déduction sur le bulletin du mois</p>
                  </div>
                </button>
                <button onClick={() => setPrimeOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                  <EmojiEventsIcon style={{ fontSize: 22, color: '#d97706' }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>Enregistrer une prime</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Ajout au bulletin du mois</p>
                  </div>
                </button>
                <button onClick={() => navigate(`/personnel/${id}/fiches`)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                  <CalendarMonthIcon style={{ fontSize: 22, color: '#0d3580' }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>Voir les fiches mensuelles</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Bulletins de paie et historique</p>
                  </div>
                </button>
                <button onClick={handleToggleActif} style={{ display: 'flex', alignItems: 'center', gap: 10, background: ouvrier.actif ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
                  <PersonIcon style={{ fontSize: 22, color: ouvrier.actif ? '#dc2626' : '#16a34a' }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: '600', color: ouvrier.actif ? '#dc2626' : '#16a34a', margin: 0 }}>{ouvrier.actif ? 'Désactiver le compte' : 'Réactiver le compte'}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{ouvrier.actif ? 'Révocation immédiate de l\'accès' : 'Restauration de l\'accès'}</p>
                  </div>
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {acompteOpen && <ModalAcompte onClose={() => setAcompteOpen(false)} onSave={handleAcompte} />}
      {primeOpen   && <ModalPrime   onClose={() => setPrimeOpen(false)}   onSave={handlePrime}   />}
    </div>
  )
}

function ModalAcompte({ onClose, onSave }) {
  const [montant, setMontant] = useState('')
  const [note,    setNote]    = useState('')

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: 0 }}>Enregistrer un acompte</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <F label="Montant (€) *">
            <input type="number" step="0.01" value={montant} onChange={e => setMontant(e.target.value)} style={inpS} inputMode="decimal" autoFocus />
          </F>
          <F label="Note">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Raison de l'acompte" style={inpS} />
          </F>
        </div>
        <button onClick={() => montant && onSave(montant, note)} disabled={!montant} style={{ width: '100%', marginTop: 18, background: !montant ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: '600', cursor: !montant ? 'not-allowed' : 'pointer' }}>
          Confirmer l'acompte
        </button>
      </div>
    </div>
  )
}

function ModalPrime({ onClose, onSave }) {
  const [label,   setLabel]   = useState('')
  const [montant, setMontant] = useState('')
  const ok = label.trim() && montant

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 17, fontWeight: '600', color: '#111111', margin: 0 }}>Enregistrer une prime</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><CloseIcon style={{ fontSize: 20, color: '#9ca3af' }} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <F label="Motif *">
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex. Prime de fin de chantier" style={inpS} autoFocus />
          </F>
          <F label="Montant (€) *">
            <input type="number" step="0.01" value={montant} onChange={e => setMontant(e.target.value)} style={inpS} inputMode="decimal" />
          </F>
        </div>
        <button onClick={() => ok && onSave(label.trim(), montant)} disabled={!ok} style={{ width: '100%', marginTop: 18, background: !ok ? '#c8d3ee' : '#d97706', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: '600', cursor: !ok ? 'not-allowed' : 'pointer' }}>
          Confirmer la prime
        </button>
      </div>
    </div>
  )
}

function Card({ titre, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px' }}>
      {titre && <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 14px' }}>{titre}</p>}
      {children}
    </div>
  )
}

function Row({ l, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{l}</span>
      <span style={{ fontSize: 13, fontWeight: '500', color: '#111111', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{v || '—'}</span>
    </div>
  )
}

function F({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inpS = { width: '100%', boxSizing: 'border-box', background: '#F0F2F7', border: '1.5px solid transparent', borderRadius: 8, padding: '9px 12px', fontSize: 14, color: '#111111', outline: 'none', fontFamily: 'inherit' }
