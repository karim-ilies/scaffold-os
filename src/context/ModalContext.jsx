import { createContext, useContext, useState, useCallback } from 'react'
import PremiumModal from '../components/ui/PremiumModal'

const ModalContext = createContext(null)

export function ModalProvider({ children }) {
  const [modal,   setModal]   = useState(null)
  const [resolver, setResolver] = useState(null)

  const showModal = useCallback((options) => {
    return new Promise((res) => {
      setModal(options)
      setResolver(() => res)
    })
  }, [])

  function handleConfirm() {
    setModal(null)
    resolver?.(true)
  }

  function handleCancel() {
    setModal(null)
    resolver?.(false)
  }

  return (
    <ModalContext.Provider value={{ showModal }}>
      {children}
      {modal && (
        <PremiumModal
          {...modal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal doit être utilisé dans <ModalProvider>')
  return ctx
}
