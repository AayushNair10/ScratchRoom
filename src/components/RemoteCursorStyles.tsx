import type { Peer } from '../hooks/usePresence'

/** Per-person colours and name tags for y-monaco's remote selection decorations. */
export function RemoteCursorStyles({ peers }: { peers: Peer[] }) {
  const css = peers
    .filter((p) => !p.isMe)
    .map(({ clientId: id, user }) => {
      const name = JSON.stringify(user.name)
      return `
.yRemoteSelection-${id} { background-color: ${user.color}33; }
.yRemoteSelectionHead-${id} { border-color: ${user.color}; }
.yRemoteSelectionHead-${id}::after { content: ${name}; background: ${user.color}; }`
    })
    .join('\n')
  return <style>{css}</style>
}
