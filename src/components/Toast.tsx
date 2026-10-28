import { useCallback, useEffect, useRef, useState } from 'react'

/** A single short-lived toast message. */
export function useToast(durationMs = 1600) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback(
    (text: string) => {
      window.clearTimeout(timer.current)
      setMessage(text)
      timer.current = window.setTimeout(() => setMessage(null), durationMs)
    },
    [durationMs],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const element = message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null

  return [element, show] as const
}
