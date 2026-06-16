import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch, getDocs, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export function useStock(filtres = {}, enabled = true) {
  const [stock,   setStock]   = useState([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    const q     = query(collection(db, 'stock'), orderBy('categorie'), orderBy('nom'))
    const unsub = onSnapshot(q,
      snap => {
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        if (filtres.categorie) items = items.filter(i => i.categorie === filtres.categorie)
        if (filtres.etat)      items = items.filter(i => i.etat === filtres.etat)
        setStock(items)
        setLoading(false)
      },
      () => { setStock([]); setLoading(false) }
    )
    return unsub
  }, [filtres.categorie, filtres.etat, enabled])

  async function creerArticle(data) {
    const ref = await addDoc(collection(db, 'stock'), {
      ...data,
      quantiteDisponible: data.quantiteTotale || 0,
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async function mettreAJourArticle(id, data) {
    await updateDoc(doc(db, 'stock', id), { ...data, updatedAt: serverTimestamp() })
  }

  async function affecterMateriel(chantierId, items) {
    const batch = writeBatch(db)
    for (const { stockItemId, quantite } of items) {
      const item = stock.find(s => s.id === stockItemId)
      if (!item) continue
      const nouvelleQte = Math.max(0, (item.quantiteDisponible || 0) - quantite)
      batch.update(doc(db, 'stock', stockItemId), { quantiteDisponible: nouvelleQte, updatedAt: serverTimestamp() })
    }
    await batch.commit()
  }

  async function retourMateriel(chantierId) {
    const chantiersSnap = await getDocs(query(collection(db, 'chantiers'), where('__name__', '==', chantierId)))
    if (chantiersSnap.empty) return
    const materiel = chantiersSnap.docs[0].data().materielAffecte || []
    const batch    = writeBatch(db)
    for (const { stockItemId, quantite } of materiel) {
      const item = stock.find(s => s.id === stockItemId)
      if (!item) continue
      batch.update(doc(db, 'stock', stockItemId), {
        quantiteDisponible: (item.quantiteDisponible || 0) + quantite,
        updatedAt: serverTimestamp(),
      })
    }
    batch.update(doc(db, 'chantiers', chantierId), { materielAffecte: [], statut: 'termine' })
    await batch.commit()
  }

  async function supprimerArticle(id) {
    await deleteDoc(doc(db, 'stock', id))
  }

  return { stock, loading, creerArticle, mettreAJourArticle, supprimerArticle, affecterMateriel, retourMateriel }
}
