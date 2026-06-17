import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { formatDate, formatStatut, formatHeures } from '../../utils/formatters'
import { BADGES } from '../../constants/theme'
import { useChantiers } from '../../hooks/useChantiers'
import { usePersonnel } from '../../hooks/usePersonnel'
import { useResponsive } from '../../hooks/useResponsive'
import { useAuth } from '../../hooks/useAuth'
import { ProgressBar } from '../../components/ui/ProgressBar'
import TabMateriel from './TabMateriel'
import TabPhotos   from './TabPhotos'
import ArrowBackIcon      from '@mui/icons-material/ArrowBack'
import AccessTimeIcon     from '@mui/icons-material/AccessTime'
import DescriptionIcon    from '@mui/icons-material/Description'
import EditIcon           from '@mui/icons-material/Edit'
import ChantierForm       from './ChantierForm'
import { useDemandesMateriel } from '../../hooks/useDemandesMateriel'
import { useParametres } from '../../hooks/useParametres'
import { useModal } from '../../context/ModalContext'
import { generateRapportChantierPDF } from '../../utils/pdfRapportChantier'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

export default function ChantierDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const { isMobile } = useResponsive()
  const { user, isPatron } = useAuth()
  const { mettreAJourChantier } = useChantiers()
  const { parametres } = useParametres()
  const { showModal }  = useModal()

  const { personnel } = usePersonnel()
  const nomOuvrier = (uid) => { const o = personnel.find(p => p.id === uid); return o ? `${o.prenom} ${o.nom}` : uid?.slice(0, 8) + '…' }

  const [chantier,  setChantier]  = useState(null)
  const [client,    setClient]    = useState(null)
  const [chef,      setChef]      = useState(null)
  const [pointages, setPointages] = useState([])
  const [factures,  setFactures]  = useState([])
  const [devis,     setDevis]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [onglet,    setOnglet]    = useState(searchParams.get('tab') || 'infos')
  const [editMode,  setEditMode]  = useState(false)
  const [reloadKey,      setReloadKey]      = useState(0)
  const [generatingPDF,  setGeneratingPDF]  = useState(false)
  const { demandes: demandesNouvelles } = useDemandesMateriel({ chantierId: id, statut: 'nouvelle' })

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'chantiers', id))
        if (!snap.exists()) { navigate('/chantiers'); return }
        const data = { id: snap.id, ...snap.data() }
        setChantier(data)

        const [clientSnap, chefSnap] = await Promise.all([
          data.clientId     ? getDoc(doc(db, 'clients', data.clientId))    : Promise.resolve(null),
          data.chefEquipeId ? getDoc(doc(db, 'users', data.chefEquipeId))  : Promise.resolve(null),
        ])
        if (clientSnap?.exists()) setClient({ id: clientSnap.id, ...clientSnap.data() })
        if (chefSnap?.exists())   setChef({ id: chefSnap.id, ...chefSnap.data() })

        const pSnap = await getDocs(query(collection(db, 'pointages'), where('chantierId', '==', id), orderBy('date', 'desc'))).catch(() => ({ docs: [] }))
        setPointages(pSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        if (isPatron) {
          const [fSnap, dSnap] = await Promise.all([
            getDocs(query(collection(db, 'factures'), where('chantierId', '==', id))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, 'devis'),    where('chantierId', '==', id))).catch(() => ({ docs: [] })),
          ])
          setFactures(fSnap.docs.map(d => ({ id: d.id, ...d.data() })))
          setDevis(dSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      } catch (e) {
        console.error('Erreur chargement chantier:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, reloadKey])

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Chargement…</div>
  if (editMode) return <ChantierForm chantierExistant={chantier} onClose={() => { setEditMode(false); setLoading(true); setReloadKey(k => k + 1) }} />
  if (!chantier) return null

  async function genererRapport() {
    setGeneratingPDF(true)
    try {
      const stockPromises = (chantier.materielAffecte || []).map(m =>
        getDoc(doc(db, 'stock', m.stockItemId))
      )
      const [photosSnap, ...stockSnaps] = await Promise.all([
        getDocs(query(collection(db, 'photos_chantier'), where('chantierId', '==', id))),
        ...stockPromises,
      ])
      const photos = photosSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const materielEnrichi = (chantier.materielAffecte || []).map((m, i) => ({
        ...m,
        nomArticle: stockSnaps[i]?.exists() ? stockSnaps[i].data().nom      : m.stockItemId,
        categorie:  stockSnaps[i]?.exists() ? stockSnaps[i].data().categorie : '—',
      }))
      const blob = await generateRapportChantierPDF(chantier, {
        client, chef, photos, factures,
        materielAffecte: materielEnrichi,
        parametres,
      })
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `Rapport_${(chantier.nom || id).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      await showModal({ type: 'info', title: 'Rapport généré', message: 'Le rapport PDF a été téléchargé avec succès.' })
    } catch (e) {
      console.error('Erreur génération rapport:', e)
      await showModal({ type: 'danger', title: 'Erreur', message: 'Impossible de générer le rapport PDF.' })
    } finally {
      setGeneratingPDF(false)
    }
  }

  const badge = BADGES[chantier.statut] || BADGES.en_attente
  const nbManque = demandesNouvelles.length
  const labelMateriel = nbManque > 0 ? `Matériel 🔴${nbManque}` : 'Matériel'
  const ONGLETS = isMobile
    ? [{ k: 'infos', l: 'Infos' }, { k: 'materiel', l: labelMateriel }, { k: 'photos', l: 'Photos' }]
    : [
        { k: 'infos',     l: 'Infos' },
        { k: 'pointages', l: 'Pointages' },
        { k: 'materiel',  l: labelMateriel },
        ...(isPatron ? [{ k: 'docs', l: 'Documents' }] : []),
        { k: 'photos',    l: 'Photos' },
      ]

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={() => navigate('/chantiers')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
            <ArrowBackIcon />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>{chantier.nom}</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{client?.nom || '—'}</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: '600', padding: '3px 10px', borderRadius: 20, ...badge }}>{formatStatut(chantier.statut)}</span>
          <button onClick={() => setEditMode(true)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
            <EditIcon style={{ fontSize: 18 }} />
          </button>
          {isPatron && chantier.statut === 'termine' && (
            <button
              onClick={genererRapport}
              disabled={generatingPDF}
              title="Générer rapport PDF"
              style={{ background: generatingPDF ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: generatingPDF ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', opacity: generatingPDF ? 0.5 : 1 }}
            >
              <PictureAsPdfIcon style={{ fontSize: 18 }} />
            </button>
          )}
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {ONGLETS.map(o => (
            <button key={o.k} onClick={() => setOnglet(o.k)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: onglet === o.k ? '600' : '400', background: onglet === o.k ? 'rgba(255,255,255,0.2)' : 'transparent', color: onglet === o.k ? '#fff' : 'rgba(255,255,255,0.6)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 760, margin: '0 auto' }}>
        {onglet === 'infos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InfoCard titre="Informations générales">
              <Row l="Client"       v={client?.nom || '—'} />
              <Row l="Adresse"      v={chantier.adresse ? `${chantier.adresse.rue || ''}, ${chantier.adresse.cp || ''} ${chantier.adresse.ville || ''}` : '—'} />
              <Row l="Type"         v={chantier.typeChantier} />
              <Row l="Chef d'équipe" v={chef ? `${chef.prenom} ${chef.nom}` : '—'} />
              <Row l="Début"        v={formatDate(chantier.dateDebut)} />
              <Row l="Fin prévue"   v={formatDate(chantier.dateFin)} />
              {chantier.dateFin_reelle && <Row l="Fin réelle" v={formatDate(chantier.dateFin_reelle)} />}
            </InfoCard>

            <InfoCard titre="Avancement">
              <ProgressBar value={chantier.avancement || 0} showLabel height={10} />
              {isPatron && (
                <input
                  type="range" min="0" max="100" step="5"
                  value={chantier.avancement || 0}
                  onChange={async (e) => {
                    const val = parseInt(e.target.value)
                    setChantier(prev => ({ ...prev, avancement: val }))
                    await updateDoc(doc(db, 'chantiers', id), { avancement: val, updatedAt: serverTimestamp() })
                  }}
                  style={{ width: '100%', marginTop: 10, accentColor: '#0d3580' }}
                />
              )}
            </InfoCard>

            {isMobile && (
              <button onClick={() => navigate(`/pointage?chantierId=${id}`)} style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <AccessTimeIcon />
                Pointer mes ouvriers aujourd'hui
              </button>
            )}

            {chantier.description && (
              <InfoCard titre="Description">
                <p style={{ fontSize: 14, color: '#3d3d3d', margin: 0, lineHeight: 1.6 }}>{chantier.description}</p>
              </InfoCard>
            )}
          </div>
        )}

        {onglet === 'pointages' && (
          <InfoCard titre={`Pointages récents (${pointages.length})`}>
            {pointages.length === 0
              ? <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', padding: 20 }}>Aucun pointage</p>
              : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Date', 'Ouvrier', 'Heures', 'Statut'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e2e4ea' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {pointages.slice(0, 20).map(p => {
                      const b = BADGES[p.statut] || {}
                      return (
                        <tr key={p.id}>
                          <td style={tdS}>{p.date}</td>
                          <td style={tdS}>{nomOuvrier(p.ouvrierId)}</td>
                          <td style={tdS}>{formatHeures(p.heuresTravaillees)}</td>
                          <td style={tdS}><span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...b }}>{formatStatut(p.statut)}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </InfoCard>
        )}

        {onglet === 'materiel' && (
          <TabMateriel
            chantierId={id}
            chantierNom={chantier.nom}
            isPatron={isPatron}
          />
        )}

        {onglet === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoCard titre={`Factures (${factures.length})`}>
              {factures.map(f => (
                <div key={f.id} onClick={() => navigate('/factures')} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e4ea', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: '#111111' }}>{f.numero}</span>
                  <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...(BADGES[f.statut] || {}) }}>{formatStatut(f.statut)}</span>
                </div>
              ))}
            </InfoCard>
            <InfoCard titre={`Devis (${devis.length})`}>
              {devis.map(d => (
                <div key={d.id} onClick={() => navigate('/devis')} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e4ea', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, color: '#111111' }}>{d.numero}</span>
                  <span style={{ fontSize: 11, fontWeight: '600', padding: '2px 8px', borderRadius: 20, ...(BADGES[d.statut] || {}) }}>{formatStatut(d.statut)}</span>
                </div>
              ))}
            </InfoCard>
          </div>
        )}

        {onglet === 'photos' && (
          <TabPhotos
            chantierId={id}
            chantierNom={chantier.nom}
            user={user}
            isPatron={isPatron}
          />
        )}
      </div>
    </div>
  )
}

function InfoCard({ titre, children }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px' }}>
      <p style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>{titre}</p>
      {children}
    </div>
  )
}

function Row({ l, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0, marginRight: 12 }}>{l}</span>
      <span style={{ fontSize: 13, fontWeight: '500', color: '#111111', textAlign: 'right' }}>{v}</span>
    </div>
  )
}

const tdS = { fontSize: 13, color: '#111111', padding: '8px 8px', borderBottom: '1px solid #f3f4f6' }
