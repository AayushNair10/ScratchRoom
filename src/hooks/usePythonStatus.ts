import { useSyncExternalStore } from 'react'
import { pythonRunner, type PythonStatus } from '../run/pythonRunner'

export function usePythonStatus(): PythonStatus {
  const runner = pythonRunner()
  return useSyncExternalStore(
    (onChange) => runner.subscribe(onChange),
    () => runner.getStatus(),
  )
}
