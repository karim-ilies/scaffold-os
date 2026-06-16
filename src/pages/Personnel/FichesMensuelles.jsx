import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, getDocs, setDoc, collection, query, where, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useModal } from '../../context/ModalContext'
import { formatEuro } from '../../utils/formatters'
import { calculerBulletin } from '../../utils/calcPaie'
import { useParametres } from '../../hooks/useParametres'
import { decaisserAuto } from '../../firebase/helpers'
import ArrowBackIcon      from '@mui/icons-material/ArrowBack'
import CheckCircleIcon    from '@mui/icons-material/CheckCircle'
import AutorenewIcon      from '@mui/icons-material/Autorenew'

export default function FichesMensuelles() {
  const { id }         = useParams()      // ouvrierId
  const navigate       = useNavigate()
  const { showModal }  = useModal()
  const { parametres } = useParametres()
  const [ouvrier, setOuvrier] = useState(null)
  const [fiches,  setFiches]  = useState([])
  const [moisSel, setMoisSel] = useState(new Date().toISOString().slice(0, 7))
  const [saving,    setSaving]    = useState(false)
  const [generant,  setGenerant]  = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'users', id)).then(s => { if (s.exists()) setOuvrier({ id: s.id, ...s.data() }) })
  }, [id])

  useEffect(() => {
    const q = query(collection(db, 'fiches_mensuelles'), where('ouvrierId', '==', id))
    return onSnapshot(q, snap => setFiches(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [id])

  const fiche = useMemo(() => fiches.find(f => f.mois === moisSel), [fiches, moisSel])

  async function validerBulletin() {
    if (!fiche) return
    const ok = await showModal({ type: 'confirm', title: 'Valider le bulletin ?', message: `${ouvrier?.prenom} ${ouvrier?.nom} · ${moisSel}`, confirmLabel: 'Valider' })
    if (!ok) return
    setSaving(true)
    await updateDoc(doc(db, 'fiches_mensuelles', fiche.id), { 'bulletin.statut': 'valide', updatedAt: serverTimestamp() })
    setSaving(false)
    await showModal({ type: 'info', title: 'Bulletin validé !', message: `Bulletin ${moisSel} validé.` })
  }

  async function marquerPaye() {
    if (!fiche) return
    const montantPaye = fiche.bulletin?.resteAVerser || 0
    const ok = await showModal({ type: 'confirm', title: 'Marquer comme payé ?', message: `Reste à verser : ${formatEuro(montantPaye)}`, confirmLabel: 'Confirmer le paiement' })
    if (!ok) return
    setSaving(true)
    await updateDoc(doc(db, 'fiches_mensuelles', fiche.id), {
      'bulletin.statut':      'paye',
      'bulletin.datePaiement': serverTimestamp(),
      updatedAt:              serverTimestamp(),
    })
    if (montantPaye > 0) {
      await decaisserAuto({
        label:       `Salaire — ${ouvrier?.prenom} ${ouvrier?.nom} · ${moisSel}`,
        montant:     montantPaye,
        categorie:   'salaire',
        referenceId: fiche.id,
        date:        new Date().toISOString().split('T')[0],
      })
    }
    setSaving(false)
  }

  async function genererFiche() {
    if (!ouvrier) return
    setGenerant(true)
    try {
      // 1. Récupère tous les pointages du mois (hors en_cours et rejetés)
      const snap = await getDocs(query(
        collection(db, 'pointages'),
        where('ouvrierId', '==', id),
        where('date', '>=', `${moisSel}-01`),
        where('date', '<=', `${moisSel}-31`),
      ))
      const pts = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.statut !== 'en_cours' && p.statut !== 'rejete' && p.heureFin)

      if (pts.length === 0) {
        await showModal({ type: 'info', title: 'Aucun pointage', message: `Aucun pointage terminé pour ${moisSel}.` })
        return
      }

      // 2. Récupère les noms des chantiers (IDs uniques)
      const chantiersIds = [...new Set(pts.map(p => p.chantierId).filter(Boolean))]
      const chantiersMap = {}
      await Promise.all(chantiersIds.map(async cid => {
        const cs = await getDoc(doc(db, 'chantiers', cid))
        if (cs.exists()) chantiersMap[cid] = cs.data().nom
      }))

      // 3. Construit l'objet jours
      const jours = {}
      let totalHeuresNormales = 0, totalHeuresSupp25 = 0, totalHeuresSupp50 = 0
      let totalJoursTravailles = 0

      for (const p of pts) {
        jours[p.date] = {
          heureDebut:        p.heureDebut,
          heureFin:          p.heureFin,
          pause:             p.pause || 60,
          heuresTravaillees: p.heuresTravaillees || 0,
          heuresNormales:    p.heuresNormales    || 0,
          heuresSupp25:      p.heuresSupp25      || 0,
          heuresSupp50:      p.heuresSupp50      || 0,
          chantierNom:       chantiersMap[p.chantierId] || '—',
          typeHoraire:       p.typeHoraire || 'jour',
          statut:            p.statut,
        }
        totalHeuresNormales  += p.heuresNormales    || 0
        totalHeuresSupp25    += p.heuresSupp25      || 0
        totalHeuresSupp50    += p.heuresSupp50      || 0
        if ((p.heuresTravaillees || 0) > 0) totalJoursTravailles++
      }

      // 4. Calcule le bulletin
      const ficheData = {
        ouvrierId: id,
        mois:      moisSel,
        jours,
        totalJoursTravailles,
        totalHeuresNormales:  Math.round(totalHeuresNormales  * 100) / 100,
        totalHeuresSupp25:    Math.round(totalHeuresSupp25    * 100) / 100,
        totalHeuresSupp50:    Math.round(totalHeuresSupp50    * 100) / 100,
        bulletin:  fiche?.bulletin || { statut: 'brouillon', primes: [], ajustementsPatron: [], acomptes: [] },
        updatedAt: serverTimestamp(),
      }
      const bulletinCalc = calculerBulletin(ficheData, ouvrier, parametres)
      ficheData.bulletin = { ...ficheData.bulletin, ...bulletinCalc, statut: fiche?.bulletin?.statut || 'brouillon' }

      // 5. Sauvegarde
      await setDoc(doc(db, 'fiches_mensuelles', `${id}_${moisSel}`), ficheData, { merge: false })
      await showModal({ type: 'info', title: 'Fiche générée !', message: `${pts.length} jour(s) importé(s) pour ${moisSel}.` })
    } catch (e) {
      alert('Erreur : ' + e.message)
    } finally {
      setGenerant(false)
    }
  }

  const b = fiche?.bulletin || {}
  const jours = fiche?.jours || {}
  const joursList = Object.entries(jours).sort(([a], [b]) => a.localeCompare(b))

  const totalPrimesUI   = (b.primes            || []).reduce((s, p) => s + (p.montant || 0), 0)
  const totalAjustUI    = (b.ajustementsPatron || []).reduce((s, a) => s + (a.montant || 0), 0)
  const totalAcomptesUI = (b.acomptes          || []).reduce((s, a) => s + (a.montant || 0), 0)
  const totalBrutUI     = (b.salaireBase    || 0) + (b.montantSupp25  || 0) + (b.montantSupp50   || 0)
                        + (b.indemniteRepas || 0) + (b.indemniteTrajet || 0) + totalPrimesUI + totalAjustUI
  const resteAVerserUI  = totalBrutUI - totalAcomptesUI

  const statutColor = { brouillon: '#f3f4f6', valide: '#dcfce7', paye: '#e8edf8' }
  const statutText  = { brouillon: '#374151', valide: '#16a34a', paye: '#0d3580' }
  const statutLabel = { brouillon: 'Brouillon', valide: 'Validé', paye: 'Payé' }

  return (
    <div style={{ background: '#F7F8FA', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0d3580', padding: '16px 20px' }}>
        <button onClick={() => navigate(`/personnel/${id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
          <ArrowBackIcon style={{ fontSize: 16 }} />Fiche ouvrier
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: '700', color: '#fff', margin: 0 }}>Fiches mensuelles</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0' }}>{ouvrier?.prenom} {ouvrier?.nom}</p>
          </div>
          <input
            type="month" value={moisSel} onChange={e => setMoisSel(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: '#fff', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
        {!fiche ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <p style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>Aucune fiche pour {moisSel}</p>
            <p style={{ fontSize: 13, marginTop: 4, marginBottom: 24 }}>Importez les pointages validés du mois pour générer la fiche.</p>
            <button
              onClick={genererFiche}
              disabled={generant}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: generant ? '#c8d3ee' : '#0d3580', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: '600', cursor: generant ? 'not-allowed' : 'pointer' }}
            >
              <AutorenewIcon style={{ fontSize: 20, animation: generant ? 'spin 1s linear infinite' : 'none' }} />
              {generant ? 'Génération…' : 'Générer la fiche du mois'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Statut bulletin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '14px 18px' }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111111' }}>Bulletin {moisSel}</span>
              <span style={{ fontSize: 11, fontWeight: '700', padding: '4px 10px', borderRadius: 10, background: statutColor[b.statut] || '#f3f4f6', color: statutText[b.statut] || '#374151' }}>
                {statutLabel[b.statut] || 'Brouillon'}
              </span>
              <button
                onClick={genererFiche}
                disabled={generant || b.statut === 'paye'}
                title={b.statut === 'paye' ? 'Fiche déjà payée' : 'Recalculer depuis les pointages'}
                style={{ background: '#f0f2f7', color: '#0d3580', border: 'none', borderRadius: 8, padding: '7px 10px', cursor: generant || b.statut === 'paye' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <AutorenewIcon style={{ fontSize: 16, animation: generant ? 'spin 1s linear infinite' : 'none' }} />
              </button>
              {b.statut === 'brouillon' && (
                <button onClick={validerBulletin} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d3580', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '600', cursor: 'pointer' }}>
                  <CheckCircleIcon style={{ fontSize: 16 }} />Valider
                </button>
              )}
              {b.statut === 'valide' && (
                <button onClick={marquerPaye} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: '600', cursor: 'pointer' }}>
                  <CheckCircleIcon style={{ fontSize: 16 }} />Marquer payé
                </button>
              )}
            </div>

            {/* Résumé heures */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px' }}>
              <p style={sectionS}>Heures travaillées</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  ['Jours travaillés', fiche.totalJoursTravailles],
                  ['Heures normales',  fiche.totalHeuresNormales?.toFixed(2) + ' h'],
                  ['Heures sup +25%',  fiche.totalHeuresSupp25?.toFixed(2) + ' h'],
                  ['Heures sup +50%',  fiche.totalHeuresSupp50?.toFixed(2) + ' h'],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: '#F7F8FA', borderRadius: 8, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: '#6b7280', fontWeight: '600', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</p>
                    <p style={{ fontSize: 18, fontWeight: '700', color: '#0d3580', margin: 0 }}>{v || 0}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tableau jours */}
            {joursList.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px', overflowX: 'auto' }}>
                <p style={sectionS}>Détail par jour</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>{['Date', 'Début', 'Fin', 'Pause', 'Heures', 'Supp', 'Chantier'].map(h => (
                      <th key={h} style={{ fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', padding: '5px 6px', textAlign: 'left', borderBottom: '1px solid #e2e4ea' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {joursList.map(([date, j]) => (
                      <tr key={date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={tdS}>{date.slice(5)} {j.typeHoraire === 'nuit' ? '🌙' : ''}</td>
                        <td style={tdS}>{j.heureDebut}</td>
                        <td style={tdS}>{j.heureFin}</td>
                        <td style={tdS}>{j.pause} min</td>
                        <td style={{ ...tdS, fontWeight: '600', color: j.heuresTravaillees > 8 ? '#d97706' : '#111111' }}>{j.heuresTravaillees?.toFixed(2)}h</td>
                        <td style={{ ...tdS, color: (j.heuresSupp25 || 0) + (j.heuresSupp50 || 0) > 0 ? '#c2410c' : '#9ca3af' }}>
                          {((j.heuresSupp25 || 0) + (j.heuresSupp50 || 0)).toFixed(2)}h
                        </td>
                        <td style={{ ...tdS, color: '#6b7280' }}>{j.chantierNom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bulletin de paie */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #0d3580', padding: '16px 18px' }}>
              <p style={sectionS}>Bulletin de paie</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Salaire de base',         b.salaireBase],
                  ['Heures sup +25%',          b.montantSupp25],
                  ['Heures sup +50%',          b.montantSupp50],
                  ['Indemnités repas',         b.indemniteRepas],
                  ['Indemnités trajet',        b.indemniteTrajet],
                  ...(b.primes || []).map(p => [p.label, p.montant]),
                  ...(b.ajustementsPatron || []).map(a => [a.label, a.montant]),
                ].map(([l, v]) => v !== undefined && (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: '500', color: v < 0 ? '#dc2626' : '#111111' }}>{formatEuro(v)}</span>
                  </div>
                ))}

                {(b.acomptes || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 13, color: '#374151' }}>Acompte du {a.date}</span>
                    <span style={{ fontSize: 13, fontWeight: '500', color: '#dc2626' }}>— {formatEuro(a.montant)}</span>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid #0d3580', marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: '700', color: '#111111' }}>TOTAL BRUT</span>
                  <span style={{ fontSize: 16, fontWeight: '700', color: '#0d3580' }}>{formatEuro(totalBrutUI)}</span>
                </div>
                {totalAcomptesUI > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>Acomptes déduits</span>
                    <span style={{ fontSize: 13, color: '#dc2626' }}>— {formatEuro(totalAcomptesUI)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid #e2e4ea', marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: '700', color: '#111111' }}>RESTE À VERSER</span>
                  <span style={{ fontSize: 18, fontWeight: '700', color: resteAVerserUI >= 0 ? '#16a34a' : '#dc2626' }}>{formatEuro(resteAVerserUI)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const sectionS = { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }
const tdS      = { padding: '7px 6px', fontSize: 12, color: '#111111' }
