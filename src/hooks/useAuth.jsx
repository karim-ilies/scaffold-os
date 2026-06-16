import { useState, useEffect, createContext, useContext } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { onAuthChange } from '../firebase/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = onAuthChange((firebaseUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = null }

      if (firebaseUser) {
        unsubProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            setUser(snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null)
            setLoading(false)
          },
          () => { setUser(null); setLoading(false) }
        )
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => { unsubAuth(); if (unsubProfile) unsubProfile() }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être dans AuthProvider')
  const { user, loading } = ctx
  return {
    user,
    loading,
    role:          user?.role || null,
    isPatron:      user?.role === 'patron',
    isChefEquipe:  user?.role === 'chef_equipe',
    isOuvrier:     user?.role === 'ouvrier',
    isComptable:   user?.role === 'comptable',
    isAuthenticated: !!user,
  }
}
