import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot, where,
  addDoc, updateDoc, doc, serverTimestamp, getDoc, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function useChantiers(filtres = {}) {
  const [chantiers, setChantiers] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let q = query(collection(db, 'chantiers'), orderBy('dateDebut', 'desc'))
    if (filtres.statut) q = query(collection(db, 'chantiers'), where('statut', '==', filtres.statut), orderBy('dateDebut', 'desc'))
    if (filtres.chefEquipeId) q = query(collection(db, 'chantiers'), where('chefEquipeId', '==', filtres.chefEquipeId), orderBy('dateDebut', 'desc'))

    const unsub = onSnapshot(q,
      snap => { setChantiers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => { setChantiers([]); setLoading(false) }
    )
    return unsub
  }, [filtres.statut, filtres.chefEquipeId])

  async function creerChantier(data) {
    const ref = await addDoc(collection(db, 'chantiers'), {
      ...data,
      materielAffecte: [],
      photos: [],
      createdAt: serverTimestamp(),
    })
    return ref.id
  }

  async function mettreAJourChantier(id, data) {
    await updateDoc(doc(db, 'chantiers', id), data)
  }

  async function affecterMateriel(chantierId, items) {
    const batch = writeBatch(db)
    items.forEach(({ stockItemId, quantite }) => {
      const stockRef = doc(db, 'stock', stockItemId)
      batch.update(stockRef, { quantiteDisponible: quantite })
    })
    await batch.commit()
    const chantierRef = doc(db, 'chantiers', chantierId)
    const snap = await getDoc(chantierRef)
    const existing = snap.data().materielAffecte || []
    await updateDoc(chantierRef, { materielAffecte: [...existing, ...items] })
  }

  return { chantiers, loading, creerChantier, mettreAJourChantier, affecterMateriel }
}
