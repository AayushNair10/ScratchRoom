// Scratchroom signaling server for Cloudflare Workers.
//
// Speaks the same tiny protocol as y-webrtc's bundled server (bin/server.js):
//   { type: 'subscribe' | 'unsubscribe', topics: string[] }
//   { type: 'publish', topic: string, ... }   -> relayed to every subscriber of the topic
//   { type: 'ping' }                          -> { type: 'pong' }
// It only relays WebRTC handshakes (encrypted by y-webrtc with the room password)
// and never stores anything.
//
// GET /ice-servers hands out short-lived Cloudflare TURN credentials, so peers on
// networks that block direct connections (college Wi-Fi, mobile data) can relay.
// It needs the TURN_KEY_ID and TURN_KEY_API_TOKEN secrets; without them it 404s
// and the app falls back to STUN only.

import { DurableObject } from 'cloudflare:workers'

interface Env {
  SIGNALING: DurableObjectNamespace<SignalingHub>
  /** Optional comma-separated list of allowed page origins, e.g. "https://scratchroom.pages.dev". */
  ALLOWED_ORIGINS?: string
  /** Cloudflare Realtime TURN key (secrets: `wrangler secret put …`). */
  TURN_KEY_ID?: string
  TURN_KEY_API_TOKEN?: string
}

interface Attachment {
  topics: string[]
}

const MAX_MESSAGE_LENGTH = 64 * 1024
const MAX_TOPICS_PER_CONNECTION = 32
const MAX_TOPIC_LENGTH = 256
const PING = JSON.stringify({ type: 'ping' })
const PONG = JSON.stringify({ type: 'pong' })
/** Long enough for a session plus several "+1h" extensions. */
const TURN_CREDENTIAL_TTL_SECONDS = 12 * 60 * 60

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function isOriginAllowed(request: Request, env: Env): boolean {
  const allowed = allowedOrigins(env)
  return !allowed.length || allowed.includes(request.headers.get('Origin') ?? '')
}

function json(body: unknown, status: number, request: Request, env: Env): Response {
  const origin = request.headers.get('Origin')
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': allowedOrigins(env).length ? (origin ?? '') : '*',
      Vary: 'Origin',
    },
  })
}

async function iceServers(request: Request, env: Env): Promise<Response> {
  if (!isOriginAllowed(request, env)) return json({ error: 'Origin not allowed' }, 403, request, env)
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
    return json({ error: 'TURN is not configured on this server' }, 404, request, env)
  }
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
    },
  )
  if (!res.ok) return json({ error: `TURN credential request failed (HTTP ${res.status})` }, 502, request, env)
  const data = (await res.json()) as { iceServers?: { urls: string | string[] }[] }
  // Browsers block port 53, so a URL on it would only make connecting slower.
  const servers = (data.iceServers ?? []).map((server) => ({
    ...server,
    urls: ([] as string[]).concat(server.urls).filter((url) => !/:53(\?|$)/.test(url)),
  }))
  return json({ iceServers: servers }, 200, request, env)
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      if (new URL(request.url).pathname === '/ice-servers' && request.method === 'GET') {
        return iceServers(request, env)
      }
      return new Response('Scratchroom signaling server: connect with a WebSocket.\n', {
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    if (!isOriginAllowed(request, env)) {
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
