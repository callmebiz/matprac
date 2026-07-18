import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// registerType: 'autoUpdate' means a new build is applied (and the page reloaded) as soon as it's
// detected, rather than silently waiting for the next natural navigation. Periodic polling below
// catches updates during a long-lived session too, not just on load.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60_000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
