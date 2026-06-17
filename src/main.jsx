import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ModalProvider } from './context/ModalContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ModalProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ModalProvider>
  </StrictMode>,
)
