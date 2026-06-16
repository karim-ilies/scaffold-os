import { useState, useEffect } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, collection, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage, STORAGE_ENABLED } from '../../firebase/config'
import { useParametres } from '../../hooks/useParametres'
import { useAuth }       from '../../hooks/useAuth'
import BusinessIcon     from '@mui/icons-material/Business'
import PeopleIcon       from '@mui/icons-material/People'
import NumbersIcon      from '@mui/icons-material/Numbers'
import GavelIcon        from '@mui/icons-material/Gavel'
import WorkIcon         from '@mui/icons-material/Work'
import SaveIcon         from '@mui/icons-material/Save'
import AddIcon          from '@mui/icons-material/Add'

const SECTIONS = [
  { k: 'societe',    l: 'Société',              icon: <BusinessIcon /> },
  { k: 'taux',       l: 'Taux journaliers',     icon: <WorkIcon /> },
  { k: 'numerotation', l: 'Numérotation',       icon: <NumbersIcon /> },
  { k: 'utilisateurs', l: 'Utilisateurs',       icon: <PeopleIcon /> },
  { k: 'cg',         l: 'Conditions générales', icon: <GavelIcon /> },
]

const ROLES_LABELS = { patron: 'Patron', chef_equipe: "Chef d'équipe", ouvrier: 'Ouvrier', comptable: 'Comptable' }

export default function ParametresPage() {
  const { parametres, loading, sauvegarder } = useParametres()
  const { isPatron } = useAuth()
  const [section, setSection]   = useState('societe')
  const [form,    setForm]      = useState({})
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)
  const [users,   setUsers]     = useState([])
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    if (parametres) setForm(parametres)
  }, [parametres])

  useEffect(() => {
    if (section === 'utilisateurs') {
      getDocs(collection(db, 'users')).then(snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      })
    }
  }, [section])

  function set(champ, val) {
    setForm(prev => ({ ...prev, [champ]: val }))
  }
  function setNested(parent, champ, val) {
    setForm(prev => ({ ...prev, [parent]: { ...(prev[parent] || {}), [champ]: val } }))
  }
  function setNestedDeep(parent, child, champ, val) {
    setForm(prev => ({ ...prev, [parent]: { ...(prev[parent] || {}), [child]: { ...((prev[parent] || {})[child] || {}), [champ]: val } } }))
  }

  async function handleSave() {
    setSaving(true)
    await sauvegarder(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function uploadLogo(file) {
    if (!file) return
    setLogoUploading(true)
    try {
      // Base64 dans Firestore → pas de CORS pour la génération PDF
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload  = e => res(e.target.result)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      set('logoBase64', base64)

      // Upload Storage pour affichage dans l'UI (optionnel)
      if (STORAGE_ENABLED) {
        const path = `parametres/logo_${Date.now()}`
        const r    = ref(storage, path)
        await uploadBytes(r, file)
        const url  = await getDownloadURL(r)
        set('logoUrl', url)
      }
    } finally {
      setLogoUploading(false)
    }
  }

  async function toggleActifUser(uid, actif) {
    await updateDoc(doc(db, 'users', uid), { actif: !actif })
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, actif: !actif } : u))
  }

  const s = { fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F7F8FA', minHeight: '100vh' }

  return (
    <div style={s}>
      <div style={{ background: '#0d3580', padding: '20px 24px' }}>
        <h1 style={{ fontSize: 20, fontWeight: '700', color: '#fff', margin: 0 }}>Paramètres</h1>
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Nav latérale */}
        <div style={{ width: 180, background: '#FFFFFF', borderRight: '1px solid #e2e4ea', minHeight: 'calc(100vh - 64px)', padding: '12px 8px', flexShrink: 0 }}>
          {SECTIONS.filter(s => s.k !== 'utilisateurs' || isPatron).map(s => (
            <button key={s.k} onClick={() => setSection(s.k)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', marginBottom: 2, fontSize: 13, fontWeight: section === s.k ? '600' : '400', background: section === s.k ? '#e8edf8' : 'transparent', color: section === s.k ? '#0d3580' : '#3d3d3d', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 18, color: '#0d3580', display: 'flex' }}>{s.icon}</span>{s.l}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, padding: 24 }}>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Chargement…</p>
          ) : (
            <>
              {section === 'societe' && (
                <Section titre="Informations société">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Raison sociale"><input value={form.raisonSociale || ''} onChange={e => set('raisonSociale', e.target.value)} style={inp} /></Field>
                    <Field label="SIRET"><input value={form.siret || ''} onChange={e => set('siret', e.target.value)} style={inp} /></Field>
                    <Field label="N° TVA intracommunautaire"><input value={form.tvaIntracom || ''} onChange={e => set('tvaIntracom', e.target.value)} style={inp} /></Field>
                    <Field label="Téléphone"><input value={form.telephone || ''} onChange={e => set('telephone', e.target.value)} style={inp} /></Field>
                    <Field label="Email"><input value={form.email || ''} onChange={e => set('email', e.target.value)} style={inp} /></Field>
                    <Field label="Site web"><input value={form.siteWeb || ''} onChange={e => set('siteWeb', e.target.value)} style={inp} /></Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 12, marginTop: 12 }}>
                    <Field label="Rue"><input value={form.adresse?.rue || ''} onChange={e => setNested('adresse', 'rue', e.target.value)} style={inp} /></Field>
                    <Field label="Code postal"><input value={form.adresse?.cp || ''} onChange={e => setNested('adresse', 'cp', e.target.value)} style={inp} /></Field>
                    <Field label="Ville"><input value={form.adresse?.ville || ''} onChange={e => setNested('adresse', 'ville', e.target.value)} style={inp} /></Field>
                  </div>
                  <Field label="IBAN" style={{ marginTop: 12 }}><input value={form.iban || ''} onChange={e => set('iban', e.target.value)} placeholder="FR76 3000 6000 0112 3456 7890 189" style={inp} /></Field>
                  <Field label="Logo société" style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {(form.logoBase64 || form.logoUrl) && <img src={form.logoBase64 || form.logoUrl} alt="Logo" style={{ height: 48, borderRadius: 8, border: '1px solid #e2e4ea' }} />}
                      {STORAGE_ENABLED ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e8edf8', color: '#0d3580', border: '1.5px solid #0d3580', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '500', cursor: 'pointer' }}>
                          {logoUploading ? 'Envoi…' : 'Changer le logo'}
                          <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} style={{ display: 'none' }} />
                        </label>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Upload non disponible (forfait Spark)</span>
                      )}
                    </div>
                  </Field>
                </Section>
              )}

              {section === 'taux' && (
                <Section titre="Taux journaliers par défaut">
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Ces valeurs pré-remplissent automatiquement les nouvelles lignes de facture.</p>
                  {[['ouvrier', 'Ouvrier monteur'], ['chefEquipe', "Chef d'équipe"], ['technicien', 'Technicien']].map(([k, l]) => (
                    <Field key={k} label={`${l} (€ HT / jour)`} style={{ marginBottom: 10 }}>
                      <input
                        type="number"
                        value={form.tauxJournauxDefaut?.[k] ?? ''}
                        onChange={e => setNested('tauxJournauxDefaut', k, e.target.value === '' ? '' : parseFloat(e.target.value))}
                        style={{ ...inp, maxWidth: 160 }}
                      />
                    </Field>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                    <Field label="Indemnité repas (€/jour)"><input type="number" value={form.tauxRepasJour || ''} onChange={e => set('tauxRepasJour', parseFloat(e.target.value) || 0)} style={inp} /></Field>
                    <Field label="Indemnité trajet (€/jour)"><input type="number" value={form.tauxTrajetJour || ''} onChange={e => set('tauxTrajetJour', parseFloat(e.target.value) || 0)} style={inp} /></Field>
                  </div>
                </Section>
              )}

              {section === 'numerotation' && (
                <Section titre="Numérotation automatique">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Préfixe factures"><input value={form.prefixeFactures || 'FAC'} onChange={e => set('prefixeFactures', e.target.value)} style={inp} /></Field>
                    <Field label="Compteur factures"><input type="number" value={form.compteurFactures || 1} onChange={e => set('compteurFactures', parseInt(e.target.value) || 1)} style={inp} /></Field>
                    <Field label="Préfixe devis"><input value={form.prefixeDevis || 'DEV'} onChange={e => set('prefixeDevis', e.target.value)} style={inp} /></Field>
                    <Field label="Compteur devis"><input type="number" value={form.compteurDevis || 1} onChange={e => set('compteurDevis', parseInt(e.target.value) || 1)} style={inp} /></Field>
                  </div>
                  <div style={{ background: '#fef9c3', borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 12, color: '#a16207' }}>
                    Modifier le compteur permet de reprendre une numérotation existante (ex: reprise de gestion).
                  </div>
                </Section>
              )}

              {section === 'utilisateurs' && isPatron && (
                <Section titre="Gestion des comptes">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {users.map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#F7F8FA', borderRadius: 8, border: '1px solid #e2e4ea' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: '600', color: '#111111', margin: 0 }}>{u.prenom} {u.nom}</p>
                          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{u.email || u.telephone} · {ROLES_LABELS[u.role] || u.role}</p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, background: u.actif ? '#dcfce7' : '#fee2e2', color: u.actif ? '#16a34a' : '#dc2626' }}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                        <button onClick={() => toggleActifUser(u.id, u.actif)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e4ea', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
                          {u.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {section === 'cg' && (
                <Section titre="Conditions générales de vente">
                  <Field label="Délai de paiement par défaut (jours)">
                    <input type="number" value={form.delaiPaiementJours || 30} onChange={e => set('delaiPaiementJours', parseInt(e.target.value) || 30)} style={{ ...inp, maxWidth: 100 }} />
                  </Field>
                  <Field label="Pénalités de retard" style={{ marginTop: 12 }}>
                    <textarea value={form.penalitesRetard || ''} onChange={e => set('penalitesRetard', e.target.value)} rows={3} style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                  </Field>
                  <Field label="Conditions générales (pied de facture)" style={{ marginTop: 12 }}>
                    <textarea value={form.conditionsGenerales || ''} onChange={e => set('conditionsGenerales', e.target.value)} rows={6} style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                  </Field>
                </Section>
              )}

              <button onClick={handleSave} disabled={saving} style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, background: saved ? '#16a34a' : '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: '600', cursor: 'pointer', transition: 'background 0.3s' }}>
                <SaveIcon style={{ fontSize: 18 }} />
                {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ titre, children }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '20px 22px', maxWidth: 680 }}>
      <p style={{ fontSize: 15, fontWeight: '600', color: '#111111', margin: '0 0 16px' }}>{titre}</p>
      {children}
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inp = {
  width: '100%', boxSizing: 'border-box',
  background: '#F0F2F7', border: '1.5px solid transparent',
  borderRadius: 8, padding: '9px 12px', fontSize: 14,
  color: '#111111', outline: 'none',
}
