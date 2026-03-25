import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, getStoredTheme } from './lib/theme'
import './styles/fonts.css'
import './styles/global.css'
import App from './App.tsx'

applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
