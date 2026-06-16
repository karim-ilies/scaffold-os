import { useState, useEffect } from 'react'
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function useDemandesMateriel(filtres = {}) {
  const [demandes, setDemandes] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const constraints = []
    if (filtres.chantierId) constraints.push(where('chantierId', '==', filtres.chantierId))
    if (filtres.statut)     constraints.push(where('statut',    '==', filtres.statut))
    constraints.push(orderBy('createdAt', 'desc'))

    const q     = query(collection(db, 'demandes_materiel'), ...constraints)
    const unsub = onSnapshot(q,
      snap => { setDemandes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      ()   => { setDemandes([]); setLoading(false) }
    )
    return unsub
  }, [filtres.chantierId, filtres.statut])

  async function creerDemande(data) {
    await addDoc(collection(db, 'demandes_materiel'), {
      ...data,
      statut: 'nouvelle',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function changerStatut(id, statut) {
    await updateDoc(doc(db, 'demandes_materiel', id), { statut, updatedAt: serverTimestamp() })
  }

  async function supprimerDemande(id) {
    await deleteDoc(doc(db, 'demandes_materiel', id))
  }

  return { demandes, loading, creerDemande, changerStatut, supprimerDemande }
}
