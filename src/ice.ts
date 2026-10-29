import { ICE_SERVERS, ICE_SERVERS_URL } from './config'

/** Refetch credentials older than this (the Worker issues them for 12 hours). */
const MAX_AGE_MS = 6 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 5000

let cached: { at: number; servers: Promise<RTCIceServer[] | undefined> } | null = null

async function fetchIceServers(): Promise<RTCIceServer[] | undefined> {
  if (ICE_SERVERS) return ICE_SERVERS
  if (!ICE_SERVERS_URL) return undefined
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(ICE_SERVERS_URL, { signal: controller.signal, cache: 'no-store' })
    if (!res.ok) return undefined
    const data = (await res.json()) as { iceServers?: unknown }
    return Array.isArray(data.iceServers) && data.iceServers.length
      ? (data.iceServers as RTCIceServer[])
      : undefined
  } catch {
    return undefined // no TURN: fall back to y-webrtc's default STUN servers
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * STUN/TURN servers for WebRTC: VITE_ICE_SERVERS if set, otherwise short-lived
 * TURN credentials from the signaling Worker, otherwise undefined (STUN only).
 * Never rejects. Call it early so the answer is ready by the time a room opens.
 */
export function loadIceServers(): Promise<RTCIceServer[] | undefined> {
  if (!cached || Date.now() - cached.at > MAX_AGE_MS) {
    cached = { at: Date.now(), servers: fetchIceServers() }
  }
  return cached.servers
}
