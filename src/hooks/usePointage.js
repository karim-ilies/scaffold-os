import { useState, useEffect } from 'react'
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, writeBatch, serverTimestamp, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { calculerHeuresJour } from '../utils/calcPaie'
import { determinerStatutValidation } from '../utils/gps'
import { dateToString } from '../utils/formatters'

export function usePointage(filtres = {}) {
  const [pointages, setPointages] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let constraints = []
    if (filtres.ouvrierId)  constraints.push(where('ouvrierId',  '==', filtres.ouvrierId))
    if (filtres.chantierId) constraints.push(where('chantierId', '==', filtres.chantierId))
    if (filtres.date)       constraints.push(where('date', '==', filtres.date))
    if (filtres.mois)       constraints.push(where('date', '>=', `${filtres.mois}-01`), where('date', '<=', `${filtres.mois}-31`))
    if (filtres.statut)     constraints.push(where('statut', '==', filtres.statut))
    constraints.push(orderBy('date', 'desc'))

    const q    = query(collection(db, 'pointages'), ...constraints)
    const unsub = onSnapshot(q,
      snap => { setPointages(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => { setPointages([]); setLoading(false) }
    )
    return unsub
  }, [JSON.stringify(filtres)])

  async function creerPointage(data) {
    const { heureDebut, heureFin, pause = 60, tracesGPS = [], chantierAdresse } = data
    const heuresCalc = heureFin ? calculerHeuresJour(heureDebut, heureFin, pause) : { heuresTravaillees: 0, heuresNormales: 0, heuresSupp25: 0, heuresSupp50: 0 }
    const statutGPS  = heureFin ? determinerStatutValidation(tracesGPS, chantierAdresse) : 'en_cours'
    const heuresSupp = Math.max((heuresCalc.heuresTravaillees || 0) - 8, 0)

    const ref = await addDoc(collection(db, 'pointages'), {
      ...data,
      ...heuresCalc,
      heuresSupp,
      statut:    statutGPS,
      validePar: null, dateValidation: null, notePatron: null,
      syncStatus: 'synced', createdOffline: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async function terminerPointage(id, heureFin, pause, tracesGPS, chantierAdresse) {
    const heuresCalc = calculerHeuresJour(
      pointages.find(p => p.id === id)?.heureDebut || '08:00',
      heureFin, pause
    )
    const statutGPS = determinerStatutValidation(tracesGPS, chantierAdresse)
    const heuresSupp = Math.max((heuresCalc.heuresTravaillees || 0) - 8, 0)

    await updateDoc(doc(db, 'pointages', id), {
      heureFin, pause, tracesGPS, ...heuresCalc, heuresSupp,
      statut: statutGPS, updatedAt: serverTimestamp(),
    })
  }

  async function validerPointage(id, validePar, heuresOverride = null, notePatron = null) {
    const updates = {
      statut: 'valide', validePar, dateValidation: serverTimestamp(),
      notePatron, updatedAt: serverTimestamp(),
    }
    if (heuresOverride !== null) {
      updates.heuresTravaillees = heuresOverride
      updates.heuresNormales   = Math.min(heuresOverride, 8)
      updates.heuresSupp       = Math.max(heuresOverride - 8, 0)
    }
    await updateDoc(doc(db, 'pointages', id), updates)
  }

  async function rejeterPointage(id, validePar, notePatron) {
    await updateDoc(doc(db, 'pointages', id), {
      statut: 'rejete', validePar, dateValidation: serverTimestamp(), notePatron,
      updatedAt: serverTimestamp(),
    })
  }

  async function corrigerPointage(id, heureDebut, heureFin, pause, notePatron, patronUid) {
    const heuresCalc = calculerHeuresJour(heureDebut, heureFin, pause)
    const heuresSupp = Math.max((heuresCalc.heuresTravaillees || 0) - 8, 0)
    await updateDoc(doc(db, 'pointages', id), {
      heureDebut, heureFin, pause, ...heuresCalc, heuresSupp,
      notePatron, validePar: patronUid,
      statut: 'valide', dateValidation: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function validerBatch(ids, patronUid) {
    const batch = writeBatch(db)
    ids.forEach(id => {
      batch.update(doc(db, 'pointages', id), {
        statut: 'valide', validePar: patronUid,
        dateValidation: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    })
    await batch.commit()
  }

  return { pointages, loading, creerPointage, terminerPointage, validerPointage, rejeterPointage, corrigerPointage, validerBatch }
}

export function exportCSVPointages(pointages, usersMap) {
  const entete = 'Nom|Date|Début|Fin|Pause|Heures|HeuresSup|Statut\n'
  const lignes = pointages.map(p => {
    const u = usersMap[p.ouvrierId] || {}
    return [
      `${u.prenom || ''} ${u.nom || ''}`.trim(),
      p.date, p.heureDebut, p.heureFin || '',
      p.pause || 60, p.heuresTravaillees || 0,
      p.heuresSupp || 0, p.statut,
    ].join('|')
  }).join('\n')

  const blob = new Blob([entete + lignes], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'pointages.csv'; a.click()
  URL.revokeObjectURL(url)
}
