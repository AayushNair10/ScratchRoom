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
  const fromEnv = list(import.meta.env.VITE_SIGNALING)
  if (fromEnv.length) return fromEnv
  return import.meta.env.DEV ? [`ws://${window.location.hostname}:4444`] : []
})()

/** Piston API base URL (VITE_PISTON_URL), without a trailing slash. */
export const PISTON_URL: string = (
  import.meta.env.VITE_PISTON_URL || 'https://emkc.org/api/v2/piston'
).replace(/\/+$/, '')
