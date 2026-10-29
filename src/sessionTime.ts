export const WARN_MS = 10 * 60 * 1000
export const DANGER_MS = 2 * 60 * 1000

/** 7265000 -> "2:01:05" */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function urgency(remainingMs: number): 'ok' | 'warn' | 'danger' {
  if (remainingMs <= DANGER_MS) return 'danger'
  if (remainingMs <= WARN_MS) return 'warn'
  return 'ok'
}
