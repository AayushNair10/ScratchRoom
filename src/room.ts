import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import type { Awareness } from 'y-protocols/awareness'
import { SIGNALING_SERVERS } from './config'
import { DEFAULT_LANGUAGE, TEMPLATES } from './templates'

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

function makeUser(taken: Set<string>): UserInfo {
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
  provider: WebrtcProvider
  awareness: Awareness
  destroy: () => void
}

export function openRoom(code: string, created: boolean): Room {
  const doc = new Y.Doc()
  const provider = new WebrtcProvider(`scratchroom-${code}`, doc, {
    signaling: SIGNALING_SERVERS,
    // The code doubles as the encryption key: only people who have it can join.
    password: code,
  })
  const awareness = provider.awareness
  awareness.setLocalStateField('user', makeUser(new Set()))

  // Colours are picked before we know who else is here; once peers show up,
  // swap to a free colour if we clashed with someone who joined earlier.
  setTimeout(() => {
    const me = awareness.getLocalState()?.user as UserInfo | undefined
    if (!me) return
    const clash = [...awareness.getStates()].some(
      ([id, s]) => id < doc.clientID && (s.user as UserInfo | undefined)?.color === me.color,
    )
    if (clash) {
      const taken = new Set(
        [...awareness.getStates()]
          .filter(([id]) => id !== doc.clientID)
          .map(([, s]) => (s.user as UserInfo | undefined)?.color ?? ''),
      )
      awareness.setLocalStateField('user', makeUser(taken))
    }
  }, 2500)

  const room: Room = {
    id: code,
    created,
    doc,
    code: doc.getText('code'),
    stdin: doc.getText('stdin'),
    meta: doc.getMap('meta'),
    provider,
    awareness,
    destroy: () => {
      provider.destroy()
      doc.destroy()
    },
  }

  if (created) {
    initRoomIfEmpty(room)
  } else {
    // Give peers a moment to send us the existing session. If nothing arrives
    // we're alone in the room, so set it up ourselves. When several people are
    // waiting, only the one with the lowest client ID does it.
    setTimeout(() => {
      if (room.meta.has('language') || room.code.length > 0) return
      const lowest = Math.min(...awareness.getStates().keys())
      if (lowest === doc.clientID) initRoomIfEmpty(room)
    }, 3000)
  }

  return room
}

/** Fills an empty room with the default language and its template. */
export function initRoomIfEmpty(room: Room): void {
  room.doc.transact(() => {
    if (!room.meta.has('language')) room.meta.set('language', DEFAULT_LANGUAGE)
    if (room.code.length === 0) room.code.insert(0, TEMPLATES[DEFAULT_LANGUAGE])
  })
}
