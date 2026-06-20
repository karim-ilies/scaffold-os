import { useEffect, useState, useRef, useCallback } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './useAuth'
import { estEnRetard, joursDeRetard } from '../utils/calcFacture'
import { formatEuro } from '../utils/formatters'

const LS_LUES = uid => `scaffold_notifs_lues_${uid}`
const LS_DISM = uid => `scaffold_notifs_dismissed_${uid}`

function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) }
  catch { return new Set() }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])) }
  catch {}
}

export function useNotifications() {
  const { user, role, isPatron, isChefEquipe } = useAuth()
  const uid = user?.uid

  const sourcesRef  = useRef({})
  const nomsCacheRef = useRef({})
  const [rawNotifs,  setRawNotifs]  = useState([])
  const [lues,       setLues]       = useState(new Set())
  const [dismissed,  setDismissed]  = useState(new Set())

  // Charger l'état persisté
  useEffect(() => {
    if (!uid) return
    setLues(loadSet(LS_LUES(uid)))
    setDismissed(loadSet(LS_DISM(uid)))
  }, [uid])

  // Fusionner toutes les sources et mettre à jour
  function updateSource(key, notifs) {
    sourcesRef.current[key] = notifs
    const all = Object.values(sourcesRef.current).flat()
    all.sort((a, b) => (a.priority || 3) - (b.priority || 3) || b._ts - a._ts)
    setRawNotifs([...all])
  }

  function nomOuvrier(ouvrierId) {
    return nomsCacheRef.current[ouvrierId] || null
  }

  // ── Patron ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPatron) return
    const now = new Date()

    // Cache des noms + documents expirants
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['ouvrier', 'chef_equipe'])),
      snap => {
        const notifs = []
        const seuil30 = new Date(); seuil30.setDate(seuil30.getDate() + 30)
        snap.docs.forEach(d => {
          const u = d.data()
          nomsCacheRef.current[d.id] = [u.prenom, u.nom].filter(Boolean).join(' ') || d.id
          ;(u.documents || []).forEach(doc => {
            if (!doc.dateExpiration) return
            const exp = doc.dateExpiration?.toDate ? doc.dateExpiration.toDate() : new Date(doc.dateExpiration)
            if (exp > now && exp <= seuil30) {
              const jours = Math.ceil((exp - now) / 86400000)
              notifs.push({
                id:       `doc_expire_${d.id}_${doc.type || 'doc'}`,
                type:     'document_expire',
                titre:    'Document expirant',
                message:  `${doc.type || 'Document'} · ${nomsCacheRef.current[d.id]} · dans ${jours} j.`,
                lien:     `/personnel/${d.id}`,
                priority: 2,
                _ts:      exp.getTime(),
              })
            }
          })
        })
        updateSource('doc_expire', notifs)
      },
      () => updateSource('doc_expire', [])
    )

    // Factures en retard
    const unsubFactures = onSnapshot(
      query(collection(db, 'factures'), where('statut', '==', 'envoyee')),
      snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(f => estEnRetard(f))
          .map(f => ({
            id:          `retard_${f.id}`,
            type:        'retard_facture',
            titre:       'Facture en retard',
            message:     `${f.numero} · ${joursDeRetard(f)} j. de retard · ${formatEuro(f.totalTTC)}`,
            lien:        `/factures/${f.id}`,
            priority:    1,
            _ts:         Date.now(),
            factureId:   f.id,
            clientId:    f.clientId,
            factureData: { numero: f.numero, solde: f.solde ?? f.totalTTC, totalTTC: f.totalTTC, dateEcheance: f.dateEcheance },
            joursRetard: joursDeRetard(f),
          }))
        updateSource('retard_facture', notifs)
      },
      () => updateSource('retard_facture', [])
    )

    // Stock sous le minimum
    const unsubStock = onSnapshot(
      collection(db, 'stock'),
      snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => (s.quantiteDisponible ?? 0) < (s.quantiteMin ?? 0))
          .map(s => ({
            id:       `stock_bas_${s.id}`,
            type:     'stock_bas',
            titre:    'Stock critique',
            message:  `${s.nom} · ${s.quantiteDisponible} restant (min ${s.quantiteMin})`,
            lien:     '/stock',
            priority: 1,
            _ts:      Date.now(),
          }))
        updateSource('stock_bas', notifs)
      },
      () => updateSource('stock_bas', [])
    )

    // Pointages à vérifier
    const unsubPointages = onSnapshot(
      query(collection(db, 'pointages'), where('statut', '==', 'a_verifier')),
      snap => {
        const notifs = snap.docs.map(d => {
          const p = d.data()
          const nom = nomOuvrier(p.ouvrierId)
          return {
            id:       `pointage_verif_${d.id}`,
            type:     'pointage_verifier',
            titre:    'Pointage à valider',
            message:  nom ? `${nom} · ${p.date || '—'} · GPS hors zone` : `${p.date || '—'} · GPS hors zone`,
            lien:     '/pointage',
            priority: 2,
            _ts:      p.date ? new Date(p.date).getTime() : Date.now(),
          }
        })
        updateSource('pointage_verifier', notifs)
      },
      () => updateSource('pointage_verifier', [])
    )

    // Devis expirant dans 7 jours
    const seuil7 = new Date(); seuil7.setDate(seuil7.getDate() + 7)
    const unsubDevis = onSnapshot(
      query(collection(db, 'devis'), where('statut', '==', 'envoye')),
      snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(dv => {
            if (!dv.dateValidite) return false
            const exp = dv.dateValidite?.toDate ? dv.dateValidite.toDate() : new Date(dv.dateValidite)
            return exp > now && exp <= seuil7
          })
          .map(dv => {
            const exp = dv.dateValidite?.toDate ? dv.dateValidite.toDate() : new Date(dv.dateValidite)
            const jours = Math.ceil((exp - now) / 86400000)
            return {
              id:       `devis_expire_${dv.id}`,
              type:     'devis_expire',
              titre:    'Devis expirant',
              message:  `${dv.numero} · expire dans ${jours} j.`,
              lien:     `/devis/${dv.id}`,
              priority: 2,
              _ts:      exp.getTime(),
            }
          })
        updateSource('devis_expire', notifs)
      },
      () => updateSource('devis_expire', [])
    )

    // Tickets en attente de validation
    const unsubTickets = onSnapshot(
      query(collection(db, 'tickets'), where('statut', '==', 'en_attente')),
      snap => {
        const notifs = snap.docs.map(d => {
          const t = d.data()
          const nom = nomOuvrier(t.ouvrierId)
          return {
            id:       `ticket_attente_${d.id}`,
            type:     'ticket_attente',
            titre:    'Ticket à valider',
            message:  `${nom ? nom + ' · ' : ''}${t.type || 'Dépense'} · ${formatEuro(t.montant)}`,
            lien:     '/tickets',
            priority: 3,
            _ts:      t.createdAt?.toDate ? t.createdAt.toDate().getTime() : Date.now(),
          }
        })
        updateSource('ticket_attente', notifs)
      },
      () => updateSource('ticket_attente', [])
    )

    // Demandes matériel en attente
    const unsubDemandes = onSnapshot(
      query(collection(db, 'demandes_materiel'), where('statut', '==', 'nouvelle')),
      snap => {
        const notifs = snap.docs.map(d => {
          const dm = d.data()
          const articles = (dm.articles || []).map(a => a.nom || a.article).filter(Boolean).join(', ')
          return {
            id:       `demande_mat_${d.id}`,
            type:     'demande_materiel',
            titre:    'Matériel manquant',
            message:  `${dm.creeParNom || '—'} · ${articles || 'demande'}`,
            lien:     `/chantiers/${dm.chantierId}?tab=materiel`,
            priority: 2,
            _ts:      dm.createdAt?.toDate ? dm.createdAt.toDate().getTime() : Date.now(),
          }
        })
        updateSource('demande_materiel', notifs)
      },
      () => updateSource('demande_materiel', [])
    )

    return () => {
      unsubUsers(); unsubFactures(); unsubStock()
      unsubPointages(); unsubDevis(); unsubTickets(); unsubDemandes()
    }
  }, [isPatron])

  // ── Chef d'équipe ────────────────────────────────────────────────────────
  useEffect(() => {
    if (role !== 'chef_equipe') return

    const unsubPointages = onSnapshot(
      query(collection(db, 'pointages'), where('statut', '==', 'a_verifier')),
      snap => {
        const notifs = snap.docs.map(d => {
          const p = d.data()
          return {
            id:       `chef_ptg_verif_${d.id}`,
            type:     'pointage_verifier',
            titre:    'Pointage à valider',
            message:  `${p.date || '—'} · à vérifier`,
            lien:     '/pointage',
            priority: 2,
            _ts:      p.date ? new Date(p.date).getTime() : Date.now(),
          }
        })
        updateSource('chef_pointage_verifier', notifs)
      },
      () => updateSource('chef_pointage_verifier', [])
    )

    const unsubStock = onSnapshot(
      collection(db, 'stock'),
      snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => (s.quantiteDisponible ?? 0) < (s.quantiteMin ?? 0))
          .map(s => ({
            id:       `chef_stock_bas_${s.id}`,
            type:     'stock_bas',
            titre:    'Stock critique',
            message:  `${s.nom} · ${s.quantiteDisponible} restant (min ${s.quantiteMin})`,
            lien:     '/stock',
            priority: 1,
            _ts:      Date.now(),
          }))
        updateSource('chef_stock_bas', notifs)
      },
      () => updateSource('chef_stock_bas', [])
    )

    return () => { unsubPointages(); unsubStock() }
  }, [role])

  // ── Ouvrier ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || role !== 'ouvrier') return

    const unsubPointages = onSnapshot(
      query(collection(db, 'pointages'), where('ouvrierId', '==', uid)),
      snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.statut === 'valide' || p.statut === 'rejete')
          .map(p => ({
            id:       `ouvrier_ptg_${p.id}`,
            type:     p.statut === 'valide' ? 'pointage_valide' : 'pointage_rejete',
            titre:    p.statut === 'valide' ? 'Pointage validé ✓' : 'Pointage rejeté',
            message:  `Votre pointage du ${p.date} a été ${p.statut === 'valide' ? 'validé' : 'rejeté'}`,
            lien:     '/pointage',
            priority: p.statut === 'rejete' ? 2 : 3,
            _ts:      p.date ? new Date(p.date).getTime() : Date.now(),
          }))
        updateSource('ouvrier_pointages', notifs)
      },
      () => updateSource('ouvrier_pointages', [])
    )

    const unsubTickets = onSnapshot(
      query(collection(db, 'tickets'), where('ouvrierId', '==', uid)),
      snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.statut === 'valide' || t.statut === 'refuse')
          .map(t => ({
            id:       `ouvrier_ticket_${t.id}`,
            type:     t.statut === 'valide' ? 'ticket_approuve' : 'ticket_refuse',
            titre:    t.statut === 'valide' ? 'Ticket approuvé ✓' : 'Ticket refusé',
            message:  `${t.type || 'Ticket'} ${formatEuro(t.montant)} · ${t.statut === 'valide' ? 'approuvé' : 'refusé'}`,
            lien:     '/tickets',
            priority: t.statut === 'refuse' ? 2 : 3,
            _ts:      t.updatedAt?.toDate ? t.updatedAt.toDate().getTime() : Date.now(),
          }))
        updateSource('ouvrier_tickets', notifs)
      },
      () => updateSource('ouvrier_tickets', [])
    )

    return () => { unsubPointages(); unsubTickets() }
  }, [uid, role])

  // ── Actions ──────────────────────────────────────────────────────────────
  // Sync entre instances via custom event
  useEffect(() => {
    function handleSync() {
      if (uid) {
        setLues(loadSet(LS_LUES(uid)))
        setDismissed(loadSet(LS_DISM(uid)))
      }
    }
    window.addEventListener('notif-sync', handleSync)
    return () => window.removeEventListener('notif-sync', handleSync)
  }, [uid])

  function emitSync() { window.dispatchEvent(new Event('notif-sync')) }

  const marquerLue = useCallback((id) => {
    setLues(prev => {
      const next = new Set([...prev, id])
      if (uid) saveSet(LS_LUES(uid), next)
      return next
    })
    setTimeout(emitSync, 50)
  }, [uid])

  const marquerToutesLues = useCallback(() => {
    setLues(prev => {
      const ids = rawNotifs.map(n => n.id)
      const next = new Set([...prev, ...ids])
      if (uid) saveSet(LS_LUES(uid), next)
      return next
    })
    setTimeout(emitSync, 50)
  }, [uid, rawNotifs])

  const supprimerNotification = useCallback((id) => {
    setDismissed(prev => {
      const next = new Set([...prev, id])
      if (uid) saveSet(LS_DISM(uid), next)
      return next
    })
    setTimeout(emitSync, 50)
  }, [uid])

  // Filtrer les dismissed et enrichir avec lue
  const notifications = rawNotifs
    .filter(n => !dismissed.has(n.id))
    .map(n => ({ ...n, lue: lues.has(n.id) }))

  const nbNonLues = notifications.filter(n => !n.lue).length

  return { notifications, nbNonLues, marquerLue, marquerToutesLues, supprimerNotification }
}
