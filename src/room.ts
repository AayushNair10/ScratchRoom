import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { DEFAULT_LANGUAGE, TEMPLATES } from './templates'

const ROOM_ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // no 0/o/1/l lookalikes
const ROOM_ID_PATTERN = /^[a-z0-9-]{4,64}$/i

export function randomRoomId(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ROOM_ID_ALPHABET[b % ROOM_ID_ALPHABET.length]).join('')
}

/**
 * Reads the room ID from the URL hash. If there isn't a valid one, makes a new
 * room and writes it into the hash. `created` is true when this tab made the room.
 */
export function resolveRoomId(): { id: string; created: boolean } {
  const fromHash = window.location.hash.replace(/^#\/?/, '')
  if (ROOM_ID_PATTERN.test(fromHash)) return { id: fromHash, created: false }
  const id = randomRoomId()
  history.replaceState(null, '', `#${id}`)
  return { id, created: true }
}

/** Navigates to a brand new room. A full reload guarantees a clean slate. */
export function startNewSession(): void {
  window.location.hash = randomRoomId()
  window.location.reload()
}

export interface Room {
  id: string
  created: boolean
  doc: Y.Doc
  /** The shared code buffer. */
  code: Y.Text
  /** The shared stdin box. */
  stdin: Y.Text
  /** language, expiresAt, lastResult, … */
  meta: Y.Map<unknown>
  awareness: Awareness
  destroy: () => void
}

export function createRoom(id: string, created: boolean): Room {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  return {
    id,
    created,
    doc,
    code: doc.getText('code'),
    stdin: doc.getText('stdin'),
    meta: doc.getMap('meta'),
    awareness,
    destroy: () => {
      awareness.destroy()
      doc.destroy()
    },
  }
}

/** Fills an empty room with the default language and its template. */
export function initRoomIfEmpty(room: Room): void {
  room.doc.transact(() => {
    if (!room.meta.has('language')) room.meta.set('language', DEFAULT_LANGUAGE)
    if (room.code.length === 0) room.code.insert(0, TEMPLATES[DEFAULT_LANGUAGE])
  })
}
