// Scratchroom signaling server for Cloudflare Workers.
//
// Speaks the same tiny protocol as y-webrtc's bundled server (bin/server.js):
//   { type: 'subscribe' | 'unsubscribe', topics: string[] }
//   { type: 'publish', topic: string, ... }   -> relayed to every subscriber of the topic
//   { type: 'ping' }                          -> { type: 'pong' }
// It only relays WebRTC handshakes (encrypted by y-webrtc with the room password)
// and never stores anything.

import { DurableObject } from 'cloudflare:workers'

interface Env {
  SIGNALING: DurableObjectNamespace<SignalingHub>
  /** Optional comma-separated list of allowed page origins, e.g. "https://scratchroom.pages.dev". */
  ALLOWED_ORIGINS?: string
}

interface Attachment {
  topics: string[]
}

const MAX_MESSAGE_LENGTH = 64 * 1024
const MAX_TOPICS_PER_CONNECTION = 32
const MAX_TOPIC_LENGTH = 256
const PING = JSON.stringify({ type: 'ping' })
const PONG = JSON.stringify({ type: 'pong' })

export default {
  async fetch(request, env): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Scratchroom signaling server: connect with a WebSocket.\n', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (allowed.length && !allowed.includes(request.headers.get('Origin') ?? '')) {
      return new Response('Origin not allowed', { status: 403 })
    }

    // One hub is plenty for personal use; every connection goes to the same instance.
    const hub = env.SIGNALING.get(env.SIGNALING.idFromName('hub'))
    return hub.fetch(request)
  },
} satisfies ExportedHandler<Env>

export class SignalingHub extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Answer keep-alive pings without waking the object from hibernation.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG))
  }

  async fetch(): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair()
    // Hibernation API: the object can sleep between messages, which keeps it free.
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ topics: [] } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) return
    let message: { type?: unknown; topics?: unknown; topic?: unknown; clients?: number }
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
    if (!message || typeof message !== 'object') return

    switch (message.type) {
      case 'subscribe':
      case 'unsubscribe': {
        if (!Array.isArray(message.topics)) return
        const topics = new Set(topicsOf(ws))
        for (const topic of message.topics) {
          if (typeof topic !== 'string' || topic.length > MAX_TOPIC_LENGTH) continue
          if (message.type === 'unsubscribe') topics.delete(topic)
          else if (topics.size < MAX_TOPICS_PER_CONNECTION) topics.add(topic)
        }
        ws.serializeAttachment({ topics: [...topics] } satisfies Attachment)
        break
      }
      case 'publish': {
        if (typeof message.topic !== 'string') return
        const topic = message.topic
        const receivers = this.ctx.getWebSockets().filter((peer) => topicsOf(peer).includes(topic))
        message.clients = receivers.length
        const out = JSON.stringify(message)
        for (const peer of receivers) {
          try {
            peer.send(out)
          } catch {
            // The peer went away; its close handler cleans up.
          }
        }
        break
      }
      case 'ping':
        ws.send(PONG)
        break
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000, 'bye')
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }
}

function topicsOf(ws: WebSocket): string[] {
  return (ws.deserializeAttachment() as Attachment | null)?.topics ?? []
}
