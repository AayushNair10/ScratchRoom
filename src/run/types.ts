import type { Language } from '../templates'

export type RunStatus =
  | 'ok' // ran to completion (exit code may still be non-zero)
  | 'compile-error'
  | 'timeout'
  | 'error' // the runner itself failed: network, rate limit, Pyodide load, …

export interface RunResult {
  language: Language
  /** e.g. "3.12.1" or "gcc 10.2.0" */
  version?: string
  status: RunStatus
  compileOutput?: string
  stdout: string
  stderr: string
  exitCode: number | null
  /** Wall-clock milliseconds measured by the runner. */
  timeMs: number
  /** Explanation shown for status "timeout" / "error". */
  message?: string
  finishedAt: number
}
