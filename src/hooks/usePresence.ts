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

export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'blocked'

/** How long a peer may stay "found but not connected" before we call it blocked. */
const PEER_CONNECT_GRACE_MS = 10_000

/**
 * 'online' when we can reach a signaling server, 'offline' when we can't, and
 * 'blocked' when someone else is in the room but a direct WebRTC connection to
 * them keeps failing (typically a strict firewall that needs a TURN relay).
 */
export function useConnectionStatus(provider: WebrtcProvider): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  useEffect(() => {
    const started = Date.now()
    const firstSeen = new Map<string, number>()
    const check = () => {
      const now = Date.now()
      let blocked = false
      for (const [peerId, conn] of provider.room?.webrtcConns ?? []) {
        if (conn.connected) {
          firstSeen.delete(peerId)
          continue
        }
        if (!firstSeen.has(peerId)) firstSeen.set(peerId, now)
        if (now - firstSeen.get(peerId)! > PEER_CONNECT_GRACE_MS) blocked = true
      }
      if (provider.signalingConns.some((c) => c.connected)) setStatus(blocked ? 'blocked' : 'online')
      else setStatus(now - started < 5000 ? 'connecting' : 'offline')
    }
    check()
    const timer = window.setInterval(check, 1000)
    return () => window.clearInterval(timer)
  }, [provider])
  return status
}
