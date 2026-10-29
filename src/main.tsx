import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { captureShare } from './lib/share'
import './style.css'

// Antes de montar o app: transforma /?url=... (menu Compartilhar) em #/salvar.
captureShare()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: o app abre sem internet depois da primeira visita. Só no build de produção.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
