import { useSyncExternalStore } from 'react'

/** Phone-sized screens get a stacked, tabbed layout. */
export const NARROW_QUERY = '(max-width: 760px)'

export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(NARROW_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(NARROW_QUERY).matches,
  )
}
