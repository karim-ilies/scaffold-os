import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

const STORAGE_KEY = 'pointages_pending'

export function sauvegarderOffline(pointage) {
  const existing = getPendingPointages()
  existing.push({ ...pointage, syncStatus: 'pending', createdOffline: true })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

export function getPendingPointages() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export async function syncPendingPointages() {
  const pending = getPendingPointages()
  if (pending.length === 0) return 0

  const batch = writeBatch(db)
  pending.forEach(pointage => {
    const ref = doc(collection(db, 'pointages'))
    batch.set(ref, { ...pointage, syncStatus: 'synced', updatedAt: serverTimestamp() })
  })

  await batch.commit()
  localStorage.removeItem(STORAGE_KEY)
  return pending.length
}

export function initOfflineSync(onSynced) {
  window.addEventListener('online', async () => {
    try {
      const count = await syncPendingPointages()
      if (count > 0 && onSynced) onSynced(count)
    } catch (err) {
      console.error('Sync échouée :', err)
    }
  })
}
