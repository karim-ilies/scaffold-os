import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function useEquipes() {
  const [equipes, setEquipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q     = query(collection(db, 'equipes'), orderBy('nom'))
    const unsub = onSnapshot(q,
      snap => { setEquipes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      ()   => { setEquipes([]); setLoading(false) }
    )
    return unsub
  }, [])

  async function creerEquipe(data) {
    await addDoc(collection(db, 'equipes'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }

  async function modifierEquipe(id, data) {
    await updateDoc(doc(db, 'equipes', id), { ...data, updatedAt: serverTimestamp() })
  }

  async function supprimerEquipe(id) {
    await deleteDoc(doc(db, 'equipes', id))
  }

  return { equipes, loading, creerEquipe, modifierEquipe, supprimerEquipe }
}
