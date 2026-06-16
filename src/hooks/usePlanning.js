import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function usePlanning(filtres = {}) {
  const [planning, setPlanning] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const constraints = []
    if (filtres.ouvrierUid) constraints.push(where('ouvrierUid', '==', filtres.ouvrierUid))
    if (filtres.dateDebut)  constraints.push(where('date', '>=', filtres.dateDebut))
    if (filtres.dateFin)    constraints.push(where('date', '<=', filtres.dateFin))

    const q     = query(collection(db, 'planning'), ...constraints)
    const unsub = onSnapshot(q,
      snap => { setPlanning(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      ()   => { setPlanning([]); setLoading(false) }
    )
    return unsub
  }, [JSON.stringify(filtres)])

  async function affecter(data, existingId = null) {
    if (existingId) {
      await updateDoc(doc(db, 'planning', existingId), { ...data, updatedAt: serverTimestamp() })
      return { id: existingId, action: 'modifie' }
    }
    const ref = await addDoc(collection(db, 'planning'), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    return { id: ref.id, action: 'affecte' }
  }

  async function retirer(planningId) {
    await deleteDoc(doc(db, 'planning', planningId))
  }

  return { planning, loading, affecter, retirer }
}
