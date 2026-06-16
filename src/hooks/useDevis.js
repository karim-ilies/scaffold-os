import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, addDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { calculerLigne, calculerTotaux } from '../utils/calcFacture'
import { getNextNumero } from '../firebase/helpers'

export function useDevis() {
  const [devis,   setDevis]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q    = query(collection(db, 'devis'), orderBy('dateEmission', 'desc'))
    const unsub = onSnapshot(q,
      snap => { setDevis(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => { setDevis([]); setLoading(false) }
    )
    return unsub
  }, [])

  async function creerDevis(data) {
    const numero = await getNextNumero('devis', 'DEV')
    const lignes = (data.lignes || []).map(calculerLigne)
    const totaux = calculerTotaux(lignes)
    const ref = await addDoc(collection(db, 'devis'), {
      ...data, numero, lignes, ...totaux,
      factureId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async function mettreAJourDevis(id, data) {
    const lignes = data.lignes ? data.lignes.map(calculerLigne) : undefined
    const totaux = lignes ? calculerTotaux(lignes) : {}
    await updateDoc(doc(db, 'devis', id), {
      ...data, ...(lignes ? { lignes } : {}), ...totaux, updatedAt: serverTimestamp(),
    })
  }

  async function convertirEnFacture(devisId, devisData) {
    const numFac = await getNextNumero('factures', 'FAC')
    const lignes = (devisData.lignes || []).map(calculerLigne)
    const totaux = calculerTotaux(lignes)
    const facRef = await addDoc(collection(db, 'factures'), {
      ...devisData, numero: numFac, lignes, ...totaux,
      statut: 'brouillon', devisId, paiements: [], totalPaye: 0,
      solde: totaux.totalTTC, pdfUrl: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'devis', devisId), {
      statut: 'accepte', factureId: facRef.id, updatedAt: serverTimestamp(),
    })
    return facRef.id
  }

  return { devis, loading, creerDevis, mettreAJourDevis, convertirEnFacture }
}
