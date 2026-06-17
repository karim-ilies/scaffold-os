import { useToast } from '../context/ToastContext'

export function useCopyToClipboard() {
  const { showToast } = useToast()

  return async (text, label = 'Texte') => {
    try {
      await navigator.clipboard.writeText(text)
      showToast({ message: `${label} copié`, type: 'success', duration: 2000 })
      return true
    } catch {
      showToast({ message: 'Impossible de copier', type: 'error' })
      return false
    }
  }
}
