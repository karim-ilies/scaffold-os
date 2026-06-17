import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './config'

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  try {
    const userDoc = await getDoc(doc(db, 'users', credential.user.uid))
    if (userDoc.exists() && userDoc.data().actif === false) {
      await signOut(auth)
      throw new Error('Compte désactivé. Contactez le patron.')
    }
  } catch (e) {
    if (e.message.includes('désactivé')) throw e
  }
  return credential.user
}

export async function logout() {
  await signOut(auth)
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function getCurrentUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { uid, ...snap.data() }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}
