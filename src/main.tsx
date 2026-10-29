import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './monaco'
import './styles.css'
import Root from './Root'
import { warmUpRunners } from './run/runner'
import { loadIceServers } from './ice'

// Start downloading Python (and the compiler list) right away.
warmUpRunners()
loadIceServers()

// Back/forward or editing the code in the address bar: start over cleanly.
window.addEventListener('hashchange', () => window.location.reload())
window.addEventListener('popstate', () => window.location.reload())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
