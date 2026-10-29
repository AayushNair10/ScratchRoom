import type { Language } from '../templates'

export type RunStatus =
  | 'ok' // ran to completion (exit code may still be non-zero)
  | 'compile-error'
  | 'timeout'
  | 'error' // the runner itself failed: network, rate limit, Pyodide load, …

export interface RunResult {
  language: Language
  /** e.g. "3.14.0" or "10.2.0" */
  version?: string
  status: RunStatus
  compileOutput?: string
  stdout: string
  stderr: string
  exitCode: number | null
  /** Wall-clock milliseconds measured by the runner. */
  timeMs: number
  /** Explanation shown for status "timeout" / "error", or e.g. a signal. */
  message?: string
  finishedAt: number
  /** Nickname of whoever pressed Run, at the time they pressed it. */
  ranBy?: string
  /** Their Yjs client ID, so we can show their current nickname if they rename. */
  ranById?: number
}

/**
 * Output is capped because the latest result is shared with everyone in the
 * room through the Yjs doc; an accidental infinite print loop shouldn't flood it.
 */
export const OUTPUT_LIMIT = 64 * 1024

export function truncate(text: string): string {
  if (text.length <= OUTPUT_LIMIT) return text
  return `${text.slice(0, OUTPUT_LIMIT)}\n… output truncated (over ${OUTPUT_LIMIT / 1024} KB)`
}

/** The shared result comes from other browsers, so check its shape before rendering it. */
export function isRunResult(value: unknown): value is RunResult {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  const optionalString = (v: unknown) => v === undefined || typeof v === 'string'
  return (
    typeof r.language === 'string' &&
    typeof r.status === 'string' &&
    typeof r.stdout === 'string' &&
    typeof r.stderr === 'string' &&
    typeof r.timeMs === 'number' &&
    (r.exitCode === null || typeof r.exitCode === 'number') &&
    optionalString(r.version) &&
    optionalString(r.compileOutput) &&
    optionalString(r.message) &&
    optionalString(r.ranBy) &&
    (r.ranById === undefined || typeof r.ranById === 'number')
  )
}
