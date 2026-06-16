import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, addDoc, updateDoc, setDoc, serverTimestamp, where, getDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { calculerLigne, calculerTotaux, calculerSolde } from '../utils/calcFacture'
import { getNextNumero } from '../firebase/helpers'

export function useFactures(filtres = {}) {
  const [factures, setFactures] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let q = query(collection(db, 'factures'), orderBy('dateEmission', 'desc'))
    if (filtres.statut) q = query(collection(db, 'factures'), where('statut', '==', filtres.statut), orderBy('dateEmission', 'desc'))

    const unsub = onSnapshot(q,
      snap => { setFactures(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => { setFactures([]); setLoading(false) }
    )
    return unsub
  }, [filtres.statut])

  async function creerFacture(data) {
    const numero  = await getNextNumero('factures', 'FAC')
    const lignes  = (data.lignes || []).map(calculerLigne)
    const totaux  = calculerTotaux(lignes)
    const soldeData = calculerSolde(totaux.totalTTC, [])

    const ref = await addDoc(collection(db, 'factures'), {
      ...data,
      numero,
      lignes,
      ...totaux,
      ...soldeData,
      paiements:  [],
      pdfUrl:     null,
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp(),
    })
    return ref.id
  }

  async function mettreAJourFacture(id, data) {
    const lignes = data.lignes ? data.lignes.map(calculerLigne) : undefined
    const totaux = lignes ? calculerTotaux(lignes) : {}
    await updateDoc(doc(db, 'factures', id), {
      ...data,
      ...(lignes ? { lignes } : {}),
      ...totaux,
      updatedAt: serverTimestamp(),
    })
  }

  async function ajouterPaiement(id, paiement) {
    const snap      = await getDoc(doc(db, 'factures', id))
    const facture   = snap.data()
    const paiements = [...(facture.paiements || []), paiement]
    const { totalPaye, solde } = calculerSolde(facture.totalTTC, paiements)
    const statut = solde <= 0 ? 'payee' : 'envoyee'
    await updateDoc(doc(db, 'factures', id), {
      paiements, totalPaye, solde, statut, updatedAt: serverTimestamp(),
    })

    // Mouvement trésorerie automatique
    const dateStr = paiement.date instanceof Date
      ? paiement.date.toISOString().slice(0, 10)
      : paiement.date
    await addDoc(collection(db, 'tresorerie'), {
      type:         'encaissement',
      categorie:    'facture',
      label:        `Paiement ${facture.numero}`,
      montant:      paiement.montant,
      date:         dateStr,
      referenceId:  id,
      modePaiement: paiement.mode || 'virement',
      source:       'auto',
      createdAt:    serverTimestamp(),
    })
    const soldeRef  = doc(db, 'tresorerie_solde', 'current')
    const curSnap   = await getDoc(soldeRef)
    const cur       = curSnap.exists() ? curSnap.data() : { solde: 0, totalEncaisseMonth: 0, totalDecaisseMonth: 0 }
    const nowMois   = new Date().toISOString().slice(0, 7)
    const isCurMois = dateStr.startsWith(nowMois)
    await setDoc(soldeRef, {
      solde:              (cur.solde || 0) + paiement.montant,
      dernierMouvement:   serverTimestamp(),
      totalEncaisseMonth: isCurMois ? (cur.totalEncaisseMonth || 0) + paiement.montant : (cur.totalEncaisseMonth || 0),
      totalDecaisseMonth: cur.totalDecaisseMonth || 0,
    })
  }

  async function archiverFacture(id) {
    await updateDoc(doc(db, 'factures', id), {
      statut:    'archivee',
      updatedAt: serverTimestamp(),
    })
  }

  return { factures, loading, creerFacture, mettreAJourFacture, ajouterPaiement, archiverFacture }
}
