import { useState, useEffect } from 'react'
import { getParametresSociete, updateParametresSociete } from '../firebase/helpers'

export function useParametres() {
  const [parametres, setParametres] = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    getParametresSociete().then(data => {
      setParametres(data)
      setLoading(false)
    })
  }, [])

  async function sauvegarder(data) {
    await updateParametresSociete(data)
    setParametres(prev => ({ ...prev, ...data }))
  }

  return { parametres, loading, sauvegarder }
}
