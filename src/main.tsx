import { StrictMode } from 'react'
import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import App from './App'
import { captureShare } from './lib/share'
// Fontes empacotadas no app: funcionam sem internet e sem chamar o Google.
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-700.css'
import './style.css'

// Antes de montar o app: transforma /?url=... (menu Compartilhar) em #/salvar.
captureShare()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: o app abre sem internet depois da primeira visita. Só no build de produção e
// fora do APK, que já traz os arquivos dentro dele.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
