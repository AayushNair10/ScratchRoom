import { useEffect, useState } from 'react'

/** The current time, updated just after every whole second. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: number
    const tick = () => {
      const t = Date.now()
      setNow(t)
      timer = window.setTimeout(tick, 1000 - (t % 1000) + 5)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [])
  return now
}
