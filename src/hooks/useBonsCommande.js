import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useBonsCommande() {
  const [bdcs, setBdcs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'bons_commande'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setBdcs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => { setBdcs([]); setLoading(false) })
    return unsub
  }, [])

  async function creerBDC(data) {
    return await addDoc(collection(db, 'bons_commande'), {
      ...data, statut: 'nouveau', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }

  async function accepterBDC(bdcId, { chantierId, factureId, equipe, jours }) {
    await updateDoc(doc(db, 'bons_commande', bdcId), {
      statut: 'accepte', chantierId, factureId, equipeChoisie: equipe, joursChoisis: jours, updatedAt: serverTimestamp(),
    })
  }

  async function refuserBDC(bdcId, motif) {
    await updateDoc(doc(db, 'bons_commande', bdcId), {
      statut: 'refuse', motifRefus: motif, updatedAt: serverTimestamp(),
    })
  }

  const bdcsNouveaux = bdcs.filter(b => b.statut === 'nouveau')

  return { bdcs, loading, creerBDC, accepterBDC, refuserBDC, bdcsNouveaux }
}
