import type { ConnectionStatus, Peer } from '../hooks/usePresence'

const MAX_DOTS = 5

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  online: '',
  offline: "Can't reach the signaling server, so nobody else can join right now.",
}

export function Presence({ peers, status }: { peers: Peer[]; status: ConnectionStatus }) {
  const count = Math.max(1, peers.length)
  const names = peers.map((p) => (p.isMe ? `${p.user.name} (you)` : p.user.name)).join('\n')
  return (
    <div
      className={`presence is-${status}`}
      title={status === 'online' ? names : `${STATUS_TEXT[status]}\n\n${names}`}
    >
      <span className="presence__dots" aria-hidden="true">
        {peers.slice(0, MAX_DOTS).map((p) => (
          <span key={p.clientId} className="presence__dot" style={{ background: p.user.color }} />
        ))}
      </span>
      <span className="presence__label">
        {status === 'offline' ? 'Offline' : `${count} connected`}
      </span>
    </div>
  )
}
