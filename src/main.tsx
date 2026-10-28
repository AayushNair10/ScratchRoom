import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './monaco'
import './styles.css'
import App from './App'
import { createRoom, initRoomIfEmpty, resolveRoomId } from './room'

const { id, created } = resolveRoomId()
const room = createRoom(id, created)
initRoomIfEmpty(room)

// Handy for poking at the shared state from the dev-tools console.
if (import.meta.env.DEV) Object.assign(window, { room })

// Editing the room ID in the address bar should land you in that room.
window.addEventListener('hashchange', () => window.location.reload())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App room={room} />
  </StrictMode>,
)
