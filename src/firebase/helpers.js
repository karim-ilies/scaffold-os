import {
  collection, query, orderBy, limit, getDocs,
  doc, setDoc, getDoc, updateDoc, addDoc,
  serverTimestamp, writeBatch, where,
} from 'firebase/firestore'
import { db } from './config'

export function generateNumeroFacture(annee, compteur) {
  return `FAC-${annee}-${String(compteur).padStart(3, '0')}`
}

export function generateNumeroDevis(annee, compteur) {
  return `DEV-${annee}-${String(compteur).padStart(3, '0')}`
}

export async function getNextNumero(collectionName, prefix) {
  const annee = new Date().getFullYear()
  const prefixComplet = `${prefix}-${annee}-`

  const q = query(
    collection(db, collectionName),
    where('numero', '>=', prefixComplet),
    where('numero', '<', `${prefix}-${annee + 1}-`),
    orderBy('numero', 'desc'),
    limit(1),
  )

  const snap = await getDocs(q)
  if (snap.empty) return `${prefixComplet}001`

  const dernierNumero = snap.docs[0].data().numero
  const compteur = parseInt(dernierNumero.split('-')[2], 10) + 1
  return `${prefixComplet}${String(compteur).padStart(3, '0')}`
}

export async function getParametresSociete() {
  const snap = await getDoc(doc(db, 'parametres', 'societe'))
  return snap.exists() ? snap.data() : null
}

export async function updateParametresSociete(data) {
  await setDoc(doc(db, 'parametres', 'societe'), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { uid, ...snap.data() } : null
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function getCollection(collectionName, ...queryConstraints) {
  const q = queryConstraints.length
    ? query(collection(db, collectionName), ...queryConstraints)
    : collection(db, collectionName)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createDocument(collectionName, data) {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateDocument(collectionName, docId, data) {
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

// Crée un décaissement automatique dans trésorerie + met à jour le solde
export async function decaisserAuto({ label, montant, categorie, referenceId, date }) {
  const d       = date || new Date().toISOString().split('T')[0]
  const nowMois = new Date().toISOString().slice(0, 7)

  await addDoc(collection(db, 'tresorerie'), {
    type:         'decaissement',
    categorie,
    label,
    montant,
    date:         d,
    modePaiement: 'virement',
    referenceId:  referenceId || null,
    source:       'auto',
    createdAt:    serverTimestamp(),
  })

  const soldeRef = doc(db, 'tresorerie_solde', 'current')
  const cur      = ((await getDoc(soldeRef)).data()) || { solde: 0, totalEncaisseMonth: 0, totalDecaisseMonth: 0 }
  await setDoc(soldeRef, {
    solde:              (cur.solde || 0) - montant,
    dernierMouvement:   serverTimestamp(),
    totalEncaisseMonth: cur.totalEncaisseMonth || 0,
    totalDecaisseMonth: d.startsWith(nowMois)
      ? (cur.totalDecaisseMonth || 0) + montant
      : cur.totalDecaisseMonth || 0,
  })
}

export async function batchUpdate(operations) {
  const batch = writeBatch(db)
  operations.forEach(({ type, ref: refPath, data }) => {
    const docRef = doc(db, ...refPath.split('/').reduce((acc, part, i, arr) => {
      if (i % 2 === 0) acc.push(part)
      else acc.push(part)
      return acc
    }, []))
    if (type === 'set') batch.set(docRef, data)
    else if (type === 'update') batch.update(docRef, data)
    else if (type === 'delete') batch.delete(docRef)
  })
  await batch.commit()
}
