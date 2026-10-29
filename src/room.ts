import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import type { Awareness } from 'y-protocols/awareness'
import { ICE_SERVERS, SIGNALING_SERVERS } from './config'
import { DEFAULT_LANGUAGE, TEMPLATES } from './templates'

/** How long a new session lasts before anyone extends it. */
export const SESSION_LENGTH_MS = 2 * 60 * 60 * 1000
/** What the "+1h" button adds. */
export const EXTENSION_MS = 60 * 60 * 1000

// ---------- Session codes ----------

const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // no 0/o/1/l lookalikes
const CODE_LENGTH = 10

/** A new random session code, e.g. "k7f3xq9amn" (~50 bits). */
export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** "k7f3xq9amn" -> "k7f3x-q9amn" for display. */
export function formatCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

/**
 * Accepts a code as typed ("K7F3X-Q9AMN", "k7f3x q9amn") or a pasted session
 * link, and returns the bare code — or null if it isn't a valid code.
 */
export function parseCode(input: string): string | null {
  const hashIndex = input.lastIndexOf('#')
  const raw = hashIndex >= 0 ? input.slice(hashIndex + 1) : input
  const code = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (code.length !== CODE_LENGTH) return null
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null
}

export function codeFromHash(): string | null {
  return parseCode(window.location.hash)
}

// ---------- Users ----------

const PALETTE: { name: string; color: string }[] = [
  { name: 'Coral', color: '#f2545b' },
  { name: 'Amber', color: '#e8a317' },
  { name: 'Lime', color: '#5fb236' },
  { name: 'Teal', color: '#14a3a3' },
  { name: 'Sky', color: '#2f8fe8' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Pink', color: '#e04fa8' },
  { name: 'Brown', color: '#a0703c' },
]
const ANIMALS = ['Otter', 'Fox', 'Panda', 'Owl', 'Koala', 'Lynx', 'Heron', 'Seal', 'Moose', 'Gecko']

export interface UserInfo {
  name: string
  color: string
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export const NICKNAME_MAX_LENGTH = 24

/** Trims a nickname to something safe to show (and to put in a CSS string). */
export function cleanNickname(value: string): string {
  return value
    .replace(/[^\p{L}\p{N} .'_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICKNAME_MAX_LENGTH)
}

/** A colour plus a default "Teal Otter"-style name, avoiding colours already taken. */
function makeIdentity(taken: Set<string>): UserInfo {
  const free = PALETTE.filter((p) => !taken.has(p.color))
  const swatch = pick(free.length ? free : PALETTE)
  return { name: `${swatch.name} ${pick(ANIMALS)}`, color: swatch.color }
}

// ---------- Room ----------

export interface Room {
  /** The session code (also the y-webrtc room password). */
  id: string
  /** True when this tab started the session (as opposed to joining one). */
  created: boolean
  doc: Y.Doc
  /** The shared code buffer. */
  code: Y.Text
  /** The shared stdin box. */
  stdin: Y.Text
  /** language, expiresAt, lastResult, … */
  meta: Y.Map<unknown>
  /** Whiteboard strokes: Y.Maps with an `id` and a flat Y.Array of x,y points (0–1). */
  strokes: Y.Array<Y.Map<unknown>>
  provider: WebrtcProvider
  awareness: Awareness
  /** The nickname this person chose ('' if they're using the default name). */
  getNickname: () => string
  /** Changes how you appear to others. Empty means the default name. */
  setNickname: (nickname: string) => void
  /**
   * Ends the session for this browser: disconnects, then wipes the local copy of
   * everything. Disconnecting first means a peer whose clock runs fast can't
   * wipe the session for everyone else; each browser clears itself on expiry.
   */
  endSession: () => void
  destroy: () => void
}

export function openRoom(code: string, created: boolean, nickname = ''): Room {
  const doc = new Y.Doc()
  const provider = new WebrtcProvider(`scratchroom-${code}`, doc, {
    signaling: SIGNALING_SERVERS,
    // The code doubles as the encryption key: only people who have it can join.
    password: code,
    ...(ICE_SERVERS && { peerOpts: { config: { iceServers: ICE_SERVERS } } }),
  })
  const awareness = provider.awareness
  let identity = makeIdentity(new Set())
  let customName = cleanNickname(nickname)
  const publishUser = () =>
    awareness.setLocalStateField('user', { name: customName || identity.name, color: identity.color })
  publishUser()

  // Colours are picked before we know who else is here; once peers show up,
  // swap to a free colour if we clashed with someone who joined earlier.
  let destroyed = false

  setTimeout(() => {
    if (destroyed) return
    const othersColors = [...awareness.getStates()]
      .filter(([id]) => id !== doc.clientID)
      .map(([id, s]) => ({ id, color: (s.user as UserInfo | undefined)?.color }))
    if (othersColors.some((o) => o.id < doc.clientID && o.color === identity.color)) {
      identity = makeIdentity(new Set(othersColors.map((o) => o.color ?? '')))
      publishUser()
    }
  }, 2500)

  const room: Room = {
    id: code,
    created,
    doc,
    code: doc.getText('code'),
    stdin: doc.getText('stdin'),
    meta: doc.getMap('meta'),
    strokes: doc.getArray<Y.Map<unknown>>('strokes'),
    provider,
    awareness,
    getNickname: () => customName,
    setNickname: (value) => {
      customName = cleanNickname(value)
      publishUser()
    },
    endSession: () => {
      if (destroyed) return
      destroyed = true
      // disconnect() detaches from the doc synchronously; destroy() alone only
      // finishes tearing down after an async step, so the wipe below would leak.
      provider.disconnect()
      doc.transact(() => {
        room.code.delete(0, room.code.length)
        room.stdin.delete(0, room.stdin.length)
        room.meta.clear()
        room.strokes.delete(0, room.strokes.length)
      })
      provider.destroy()
    },
    destroy: () => {
      if (!destroyed) {
        provider.disconnect() // synchronous, so peers see us leave right away
        provider.destroy()
      }
      destroyed = true
      doc.destroy()
    },
  }

  if (created) {
    initRoomIfEmpty(room)
  } else {
    // We joined an existing code. Normally a peer sends us the session within a
    // second. If nobody is there, set the room up ourselves, but only once we're
    // sure: making our own template while a peer is still connecting would get
    // both templates merged into the code once the connection comes up.
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (destroyed || (room.meta.has('language') && room.meta.has('expiresAt'))) {
        window.clearInterval(timer)
        return
      }
      const waited = Date.now() - started
      if (waited < 3000) return
      const signalingUp = provider.signalingConns.some((c) => c.connected)
      const stillConnecting = [...(provider.room?.webrtcConns.values() ?? [])].some((c) => !c.synced)
      if ((stillConnecting && waited < 20_000) || (!signalingUp && waited < 10_000)) return
      // Several people waiting in an empty room: only the lowest client ID sets it up.
      if (Math.min(...awareness.getStates().keys()) !== doc.clientID) return
      window.clearInterval(timer)
      initRoomIfEmpty(room)
    }, 500)
  }

  return room
}

/** Fills in whatever a new room is missing: language + template, and the 2-hour timer. */
export function initRoomIfEmpty(room: Room): void {
  room.doc.transact(() => {
    if (!room.meta.has('language')) {
      room.meta.set('language', DEFAULT_LANGUAGE)
      if (room.code.length === 0) room.code.insert(0, TEMPLATES[DEFAULT_LANGUAGE])
    }
    if (!room.meta.has('expiresAt')) room.meta.set('expiresAt', Date.now() + SESSION_LENGTH_MS)
  })
}
