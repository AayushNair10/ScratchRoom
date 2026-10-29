import { useState } from 'react'
import App from './App'
import { JoinPrompt, Landing } from './components/Landing'
import { codeFromHash, formatCode, openRoom, randomCode, type Room } from './room'

const initialCode = codeFromHash()
if (!initialCode && window.location.hash) history.replaceState(null, '', window.location.pathname)

// Rooms are only ever opened from event handlers, never during render, so
// StrictMode's double-invocation can't create two WebRTC providers for one room.
function enter(code: string, created: boolean, nickname: string): Room {
  if (codeFromHash() !== code) history.pushState(null, '', `#${formatCode(code)}`)
  return openRoom(code, created, nickname)
}

export default function Root() {
  const [room, setRoom] = useState<Room | null>(null)
  // A session link opened directly (or a reload): ask for a name before joining.
  const [linkCode, setLinkCode] = useState(initialCode)

  if (room) {
    // Handy for poking at the shared state from the dev-tools console.
    if (import.meta.env.DEV) Object.assign(window, { room })
    return (
      <App
        key={room.id}
        room={room}
        onNewSession={() => {
          const nickname = room.getNickname()
          room.destroy()
          setRoom(enter(randomCode(), true, nickname))
        }}
        onHome={() => {
          room.destroy()
          history.replaceState(null, '', window.location.pathname)
          setLinkCode(null)
          setRoom(null)
        }}
      />
    )
  }

  if (linkCode) {
    return (
      <JoinPrompt
        code={linkCode}
        onJoin={(nickname) => setRoom(enter(linkCode, false, nickname))}
        onCancel={() => {
          history.replaceState(null, '', window.location.pathname)
          setLinkCode(null)
        }}
      />
    )
  }

  return (
    <Landing
      onStart={(nickname) => setRoom(enter(randomCode(), true, nickname))}
      onJoin={(code, nickname) => setRoom(enter(code, false, nickname))}
    />
  )
}
