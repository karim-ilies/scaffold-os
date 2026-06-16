import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            "AIzaSyBqk1vXxVUDRVNZLbTokbWiTD0QIGEmb54",
  authDomain:        "scaffold-os.firebaseapp.com",
  projectId:         "scaffold-os",
  storageBucket:     "scaffold-os.firebasestorage.app",
  messagingSenderId: "882968015995",
  appId:             "1:882968015995:web:02484921139f529cf09ede"
}

const app = initializeApp(firebaseConfig)

export const db      = getFirestore(app)
export const auth    = getAuth(app)
export const storage = getStorage(app)

export const STORAGE_ENABLED = true

export default app
