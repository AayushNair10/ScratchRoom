function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * y-webrtc signaling servers (VITE_SIGNALING, comma-separated).
 * In dev we fall back to the local server from `npm run signaling`, using the
 * page's hostname so other devices on your LAN can join too.
 */
export const SIGNALING_SERVERS: string[] = (() => {
  // Accept the https:// URL wrangler prints and turn it into the WebSocket form.
  const fromEnv = list(import.meta.env.VITE_SIGNALING).map((url) => url.replace(/^http(s?):\/\//i, 'ws$1://'))
  if (fromEnv.length) return fromEnv
  return import.meta.env.DEV ? [`ws://${window.location.hostname}:4444`] : []
})()

/** Piston API base URL (VITE_PISTON_URL), without a trailing slash. */
export const PISTON_URL: string = (
  import.meta.env.VITE_PISTON_URL || 'https://emkc.org/api/v2/piston'
).replace(/\/+$/, '')

/** Which service runs C, C++ and Java (VITE_RUNNER): "wandbox" (default) or "piston". */
export const RUNNER: 'wandbox' | 'piston' =
  import.meta.env.VITE_RUNNER === 'piston' ? 'piston' : 'wandbox'

/** Wandbox base URL (VITE_WANDBOX_URL), without a trailing slash. */
export const WANDBOX_URL: string = (import.meta.env.VITE_WANDBOX_URL || 'https://wandbox.org').replace(
  /\/+$/,
  '',
)
