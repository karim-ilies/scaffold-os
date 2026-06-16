import {
  collection, query, where, getDocs, deleteDoc,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase/config'

/**
 * Consolide les pointages bruts d'un ouvrier pour un mois donné
 * en une fiche_mensuelle, puis supprime les pointages bruts.
 * Appeler après que le bulletin a été validé.
 */
export async function consolidationMensuelle(ouvrierId, mois) {
  const q = query(
    collection(db, 'pointages'),
    where('ouvrierId', '==', ouvrierId),
    where('date', '>=', `${mois}-01`),
    where('date', '<=', `${mois}-31`),
  )
  const snap = await getDocs(q)
  const pointages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (!pointages.length) return { consolidées: 0, supprimées: 0 }

  // Vérifie que la fiche mensuelle existe déjà (créée par usePersonnel)
  // Si oui, on supprime juste les pointages bruts
  const promises = snap.docs.map(d => deleteDoc(doc(db, 'pointages', d.id)))
  await Promise.all(promises)

  return { consolidées: pointages.length, supprimées: pointages.length }
}

/**
 * Exporte toutes les fiches mensuelles d'un ouvrier pour une année
 * en JSON minifié vers Firebase Storage, puis supprime de Firestore.
 */
export async function exporterArchive(ouvrierId, annee) {
  const q = query(
    collection(db, 'fiches_mensuelles'),
    where('ouvrierId', '==', ouvrierId),
  )
  const snap = await getDocs(q)
  const fiches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(f => f.mois?.startsWith(String(annee)))

  if (!fiches.length) return { exportées: 0 }

  const json    = JSON.stringify(fiches)
  const path    = `archives/${ouvrierId}/${annee}.json`
  const storRef = ref(storage, path)
  await uploadString(storRef, json, 'raw', { contentType: 'application/json' })
  const url = await getDownloadURL(storRef)

  // Supprime les fiches Firestore archivées
  await Promise.all(snap.docs
    .filter(d => d.data().mois?.startsWith(String(annee)))
    .map(d => deleteDoc(doc(db, 'fiches_mensuelles', d.id)))
  )

  return { exportées: fiches.length, url }
}

/**
 * Supprime définitivement une archive depuis Firebase Storage.
 * Nécessite confirmation explicite de l'utilisateur avant d'appeler.
 */
export async function purgerArchive(ouvrierId, annee) {
  const path    = `archives/${ouvrierId}/${annee}.json`
  const storRef = ref(storage, path)
  await deleteObject(storRef)
  return { purgée: true }
}
