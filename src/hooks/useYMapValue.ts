import { useSyncExternalStore } from 'react'
import type * as Y from 'yjs'

/** Subscribes a component to one key of a shared Y.Map. */
export function useYMapValue<T>(map: Y.Map<unknown>, key: string): T | undefined {
  return useSyncExternalStore(
    (onChange) => {
      const observer = (event: Y.YMapEvent<unknown>) => {
        if (event.keysChanged.has(key)) onChange()
      }
      map.observe(observer)
      return () => map.unobserve(observer)
    },
    () => map.get(key) as T | undefined,
  )
}
