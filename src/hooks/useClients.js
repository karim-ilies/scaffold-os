import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useClients(enabled = true) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    const q     = query(collection(db, 'clients'), orderBy('nom'))
    const unsub = onSnapshot(q,
      snap => { setClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => { setClients([]); setLoading(false) }
    )
    return unsub
  }, [enabled])

  async function creerClient(data) {
    const ref = await addDoc(collection(db, 'clients'), { ...data, createdAt: serverTimestamp() })
    return ref.id
  }

  async function mettreAJourClient(id, data) {
    await updateDoc(doc(db, 'clients', id), data)
  }

  return { clients, loading, creerClient, mettreAJourClient }
}
