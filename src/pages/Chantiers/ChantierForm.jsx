import { useState } from 'react'
import { useChantiers } from '../../hooks/useChantiers'
import { useClients }   from '../../hooks/useClients'
import ArrowBackIcon      from '@mui/icons-material/ArrowBack'
import MyLocationIcon     from '@mui/icons-material/MyLocation'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import WarningAmberIcon   from '@mui/icons-material/WarningAmber'

export default function ChantierForm({ onClose, chantierExistant = null }) {
  const { creerChantier, mettreAJourChantier } = useChantiers()
  const { clients } = useClients()
  const [saving,    setSaving]    = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geoStatut, setGeoStatut] = useState(null) // 'ok' | 'erreur' | null

  const [form, setForm] = useState({
    nom:          chantierExistant?.nom || '',
    clientId:     chantierExistant?.clientId || '',
    adresse:      chantierExistant?.adresse || { rue: '', cp: '', ville: '', lat: null, lng: null },
    statut:       chantierExistant?.statut || 'en_attente',
    dateDebut:    chantierExistant?.dateDebut || '',
    dateFin:      chantierExistant?.dateFin || '',
    typeChantier: chantierExistant?.typeChantier || 'neuf',
    typeHoraire:  chantierExistant?.typeHoraire  || 'jour',
    description:  chantierExistant?.description || '',
    notes:        chantierExistant?.notes || '',
  })

  function set(champ, val) {
    setForm(prev => ({ ...prev, [champ]: val }))
  }
  function setAdresse(champ, val) {
    setForm(prev => ({ ...prev, adresse: { ...prev.adresse, [champ]: val } }))
    if (champ === 'rue' || champ === 'cp' || champ === 'ville') setGeoStatut(null)
  }

  async function geocoder() {
    const { rue, cp, ville } = form.adresse
    if (!ville && !cp) { alert('Entrez au moins la ville ou le code postal.'); return }
    setGeocoding(true)
    setGeoStatut(null)
    try {
      const q   = [rue, cp, ville, 'France'].filter(Boolean).join(' ')
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`
      const res = await fetch(url, { headers: { 'User-Agent': 'Scaffold-OS/1.0' } })
      const data = await res.json()
      if (data.length > 0) {
        setForm(prev => ({ ...prev, adresse: { ...prev.adresse, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } }))
        setGeoStatut('ok')
      } else {
        setGeoStatut('erreur')
      }
    } catch {
      setGeoStatut('erreur')
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (chantierExistant) {
        await mettreAJourChantier(chantierExistant.id, form)
      } else {
        await creerChantier(form)
      }
      onClose()
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: '#0d3580', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
          <ArrowBackIcon />
        </button>
        <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>
          {chantierExistant ? 'Modifier le chantier' : 'Nouveau chantier'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <Bloc label="Informations générales">
          <Field label="Nom du chantier" required>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Client">
            <select value={form.clientId} onChange={e => set('clientId', e.target.value)} style={inputStyle}>
              <option value="">— Choisir un client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Type de chantier">
              <select value={form.typeChantier} onChange={e => set('typeChantier', e.target.value)} style={inputStyle}>
                <option value="neuf">Neuf</option>
                <option value="renovation">Rénovation</option>
                <option value="location">Location</option>
              </select>
            </Field>
            <Field label="Statut">
              <select value={form.statut} onChange={e => set('statut', e.target.value)} style={inputStyle}>
                <option value="en_attente">En attente</option>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
                <option value="annule">Annulé</option>
              </select>
            </Field>
          </div>
          <Field label="Horaire de travail">
            <select value={form.typeHoraire} onChange={e => set('typeHoraire', e.target.value)} style={inputStyle}>
              <option value="jour">☀️ Journée (taux jour)</option>
              <option value="nuit">🌙 Nuit (taux nuit)</option>
            </select>
          </Field>
        </Bloc>

        <Bloc label="Adresse du chantier" style={{ marginTop: 12 }}>
          <Field label="Rue">
            <input value={form.adresse.rue} onChange={e => setAdresse('rue', e.target.value)} style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <Field label="Code postal">
              <input value={form.adresse.cp} onChange={e => setAdresse('cp', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Ville">
              <input value={form.adresse.ville} onChange={e => setAdresse('ville', e.target.value)} style={inputStyle} />
            </Field>
          </div>

          {/* Bouton géolocalisation */}
          <div>
            <button
              type="button"
              onClick={geocoder}
              disabled={geocoding}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: geocoding ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: '600', cursor: geocoding ? 'not-allowed' : 'pointer' }}
            >
              <MyLocationIcon style={{ fontSize: 17 }} />
              {geocoding ? 'Recherche en cours…' : 'Géolocaliser l\'adresse'}
            </button>

            {geoStatut === 'ok' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#16a34a', fontWeight: '600' }}>
                <CheckCircleIcon style={{ fontSize: 16 }} />
                Position trouvée — {form.adresse.lat?.toFixed(5)}, {form.adresse.lng?.toFixed(5)}
              </div>
            )}
            {geoStatut === 'erreur' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: '#d97706', fontWeight: '600' }}>
                <WarningAmberIcon style={{ fontSize: 16 }} />
                Adresse introuvable — entrez les coordonnées manuellement
              </div>
            )}
          </div>

          {/* Coords manuelles (toujours éditables) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Latitude (optionnel)">
              <input type="number" step="any" value={form.adresse.lat || ''} onChange={e => { setAdresse('lat', parseFloat(e.target.value) || null); setGeoStatut(null) }} placeholder="48.8566" style={inputStyle} />
            </Field>
            <Field label="Longitude (optionnel)">
              <input type="number" step="any" value={form.adresse.lng || ''} onChange={e => { setAdresse('lng', parseFloat(e.target.value) || null); setGeoStatut(null) }} placeholder="2.3522" style={inputStyle} />
            </Field>
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
            Les coordonnées GPS servent à vérifier la présence des ouvriers sur le chantier.
          </p>
        </Bloc>

        <Bloc label="Dates" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Date de début">
              <input type="date" value={form.dateDebut} onChange={e => set('dateDebut', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Date de fin estimée">
              <input type="date" value={form.dateFin} onChange={e => set('dateFin', e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </Bloc>

        <Bloc label="Description / Notes" style={{ marginTop: 12 }}>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Description du chantier…" style={{ ...inputStyle, resize: 'vertical' }} />
        </Bloc>

        <button type="submit" disabled={saving} style={{ width: '100%', marginTop: 20, background: saving ? '#6b7280' : '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: 14, fontSize: 15, fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Enregistrement…' : chantierExistant ? 'Modifier' : 'Créer le chantier'}
        </button>
      </form>
    </div>
  )
}

function Bloc({ label, children, style }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px', ...style }}>
      <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: '#F0F2F7', border: '1.5px solid transparent',
  borderRadius: 8, padding: '9px 12px', fontSize: 14,
  color: '#111111', outline: 'none',
}
