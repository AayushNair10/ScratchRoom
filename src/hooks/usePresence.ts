import { useEffect, useState } from 'react'
import type { WebrtcProvider } from 'y-webrtc'
import type { Awareness } from 'y-protocols/awareness'
import { cleanNickname, type UserInfo } from '../room'

export interface Peer {
  clientId: number
  user: UserInfo
  isMe: boolean
}

/** Awareness state comes from other browsers, so don't trust its shape. */
function sanitizeUser(value: unknown): UserInfo | null {
  if (!value || typeof value !== 'object') return null
  const { name, color } = value as Record<string, unknown>
  if (typeof name !== 'string' || typeof color !== 'string') return null
  if (!/^#[0-9a-f]{6}$/i.test(color)) return null
  return { name: cleanNickname(name) || 'Guest', color }
}

function readPeers(awareness: Awareness): Peer[] {
  const peers: Peer[] = []
  awareness.getStates().forEach((state, clientId) => {
    const user = sanitizeUser(state.user)
    if (user) peers.push({ clientId, user, isMe: clientId === awareness.clientID })
  })
  // Me first, then everyone else in a stable order.
  return peers.sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.clientId - b.clientId)
}

/** Everyone currently in the room, including this tab. */
export function usePeers(awareness: Awareness): Peer[] {
  const [peers, setPeers] = useState(() => readPeers(awareness))
  useEffect(() => {
    const update = () => setPeers(readPeers(awareness))
    awareness.on('change', update)
    update()
    return () => awareness.off('change', update)
  }, [awareness])
  return peers
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline'

/** Whether we can currently reach at least one signaling server. */
export function useConnectionStatus(provider: WebrtcProvider): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  useEffect(() => {
    const started = Date.now()
    const check = () => {
      if (provider.signalingConns.some((c) => c.connected)) setStatus('online')
      else setStatus(Date.now() - started < 5000 ? 'connecting' : 'offline')
    }
    check()
    const timer = window.setInterval(check, 1000)
    return () => window.clearInterval(timer)
  }, [provider])
  return status
}
