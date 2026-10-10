import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/patrick-hand'
import '@fontsource/permanent-marker'
import './index.css'

import { App } from './App'
import { endSession } from './shared'

const root = document.getElementById('root')
if (!root)
  throw new Error(
    'main: the #root element is missing, so the game cannot start'
  )

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Dev only: the game owns one mutable runtime that hot updates can't swap safely, and a
// half-updated page keeps the old game loop drawing underneath. Reload fully instead,
// without the leave warning.
if (import.meta.hot)
  import.meta.hot.on('vite:beforeUpdate', () => {
    endSession()
    location.reload()
  })
