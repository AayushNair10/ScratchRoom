import { useRef, useState } from 'react'
import App from './App'
import { JoinPrompt, Landing } from './components/Landing'
import { loadIceServers } from './ice'
import { codeFromHash, formatCode, openRoom, randomCode, type Room } from './room'

const initialCode = codeFromHash()
if (!initialCode && window.location.hash) history.replaceState(null, '', window.location.pathname)

export default function Root() {
  const [room, setRoom] = useState<Room | null>(null)
  const entering = useRef(false)

  // Rooms are only ever opened from event handlers, never during render, so
  // StrictMode's double-invocation can't create two WebRTC providers for one room.
  const enter = async (code: string, created: boolean, nickname: string) => {
    if (entering.current) return // ignore double clicks while TURN credentials load
    entering.current = true
    try {
      const iceServers = await loadIceServers() // normally ready long before anyone clicks
      if (codeFromHash() !== code) history.pushState(null, '', `#${formatCode(code)}`)
      setRoom(openRoom(code, created, nickname, iceServers))
    } finally {
      entering.current = false
    }
  }
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
          setRoom(null)
          setLinkCode(null)
          void enter(randomCode(), true, nickname)
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
        onJoin={(nickname) => void enter(linkCode, false, nickname)}
        onCancel={() => {
          history.replaceState(null, '', window.location.pathname)
          setLinkCode(null)
        }}
      />
    )
  }

  return (
    <Landing
      onStart={(nickname) => void enter(randomCode(), true, nickname)}
      onJoin={(code, nickname) => void enter(code, false, nickname)}
    />
  )
}
