import { useEffect, useRef, useState } from 'react'
import type { ConnectionStatus, Peer } from '../hooks/usePresence'
import { NICKNAME_MAX_LENGTH } from '../room'

const MAX_DOTS = 5

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Connecting to the signaling server…',
  online: '',
  offline: "Can't reach the signaling server, so nobody else can join right now.",
  blocked:
    "Someone is trying to join, but a direct connection to them can't be made. This usually means a strict firewall or company network, which needs a TURN relay server (see the README).",
}

interface Props {
  peers: Peer[]
  status: ConnectionStatus
  onRename: (nickname: string) => void
}

/** "● ● 2 connected" — opens a list of people where you can change your own name. */
export function Presence({ peers, status, onRename }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const count = Math.max(1, peers.length)
  const me = peers.find((p) => p.isMe)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="presence-wrap" ref={rootRef}>
      <button
        type="button"
        className={`btn btn--ghost presence is-${status}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="People in this session"
      >
        <span className="presence__dots" aria-hidden="true">
          {peers.slice(0, MAX_DOTS).map((p) => (
            <span key={p.clientId} className="presence__dot" style={{ background: p.user.color }} />
          ))}
        </span>
        <span className="presence__label">
          {status === 'offline' ? (
            'Offline'
          ) : status === 'blocked' ? (
            "Can't connect"
          ) : (
            <>
              {count}
              <span className="presence__suffix"> connected</span>
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="People in this session">
          {status !== 'online' && <p className="popover__note">{STATUS_TEXT[status]}</p>}
          <ul className="people">
            {peers.map((p) => (
              <li key={p.clientId}>
                <span className="presence__dot" style={{ background: p.user.color }} />
                <span className="people__name">{p.user.name}</span>
                {p.isMe && <span className="people__you">you</span>}
              </li>
            ))}
          </ul>
          {me && <RenameForm key={me.user.name} current={me.user.name} onRename={onRename} />}
        </div>
      )}
    </div>
  )
}

function RenameForm({ current, onRename }: { current: string; onRename: (name: string) => void }) {
  const [value, setValue] = useState(current)
  return (
    <form
      className="rename"
      onSubmit={(e) => {
        e.preventDefault()
        onRename(value)
      }}
    >
      <label htmlFor="nickname">Your name</label>
      <div className="rename__row">
        <input
          id="nickname"
          className="input input--small"
          value={value}
          maxLength={NICKNAME_MAX_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Leave empty for a random name"
          autoComplete="off"
        />
        <button type="submit" className="btn" disabled={value === current}>
          Save
        </button>
      </div>
    </form>
  )
}
