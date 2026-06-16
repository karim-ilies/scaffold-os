import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, addDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import CryptoJS from 'crypto-js'

const SECRET = import.meta.env.VITE_CRYPTO_SECRET || 'scaffold-os-secret'

export function chiffrer(texte) {
  if (!texte) return ''
  return CryptoJS.AES.encrypt(texte, SECRET).toString()
}

export function dechiffrer(chiffre) {
  if (!chiffre) return ''
  try {
    return CryptoJS.AES.decrypt(chiffre, SECRET).toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}

export function usePersonnel(filtres = {}) {
  const [personnel, setPersonnel] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let constraints = [orderBy('nom')]
    if (filtres.role)  constraints = [where('role', '==', filtres.role), ...constraints]
    if (filtres.actif !== undefined) constraints = [where('actif', '==', filtres.actif), ...constraints]

    const q    = query(collection(db, 'users'), ...constraints)
    const unsub = onSnapshot(q,
      snap => { setPersonnel(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => { setPersonnel([]); setLoading(false) }
    )
    return unsub
  }, [filtres.role, filtres.actif])

  async function mettreAJourOuvrier(uid, data) {
    const payload = { ...data, updatedAt: serverTimestamp() }
    if (data.numeroSecu) payload.numeroSecu = chiffrer(data.numeroSecu)
    if (data.iban)       payload.iban       = chiffrer(data.iban)
    await updateDoc(doc(db, 'users', uid), payload)
  }

  async function desactiverOuvrier(uid) {
    await updateDoc(doc(db, 'users', uid), { actif: false, updatedAt: serverTimestamp() })
  }

  return { personnel, loading, mettreAJourOuvrier, desactiverOuvrier }
}

export function useFichesMensuelles(ouvrierId, mois) {
  const [fiches,  setFiches]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ouvrierId) return
    const q = mois
      ? query(collection(db, 'fiches_mensuelles'), where('ouvrierId', '==', ouvrierId), where('mois', '==', mois))
      : query(collection(db, 'fiches_mensuelles'), where('ouvrierId', '==', ouvrierId), orderBy('mois', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setFiches(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [ouvrierId, mois])

  async function sauvegarderFiche(ouvrierId, mois, data) {
    const docId = `${ouvrierId}_${mois}`
    await setDoc(doc(db, 'fiches_mensuelles', docId), { ...data, ouvrierId, mois, updatedAt: serverTimestamp() }, { merge: true })
  }

  return { fiches, loading, sauvegarderFiche }
}
