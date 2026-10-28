import { useState } from 'react'
import App from './App'
import { Landing } from './components/Landing'
import { codeFromHash, formatCode, openRoom, randomCode, type Room } from './room'

// Rooms are opened outside React render so StrictMode's double-invocation
// never creates two WebRTC providers for the same room.
const initialCode = codeFromHash()
const initialRoom = initialCode ? openRoom(initialCode, false) : null
if (!initialCode && window.location.hash) history.replaceState(null, '', window.location.pathname)

function enter(code: string, created: boolean): Room {
  history.pushState(null, '', `#${formatCode(code)}`)
  return openRoom(code, created)
}

export default function Root() {
  const [room, setRoom] = useState<Room | null>(initialRoom)

  if (!room) {
    return (
      <Landing
        onStart={() => setRoom(enter(randomCode(), true))}
        onJoin={(code) => setRoom(enter(code, false))}
      />
    )
  }
  // Handy for poking at the shared state from the dev-tools console.
  if (import.meta.env.DEV) Object.assign(window, { room })
  return <App room={room} />
}
