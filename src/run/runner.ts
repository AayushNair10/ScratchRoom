import { RUNNER } from '../config'
import type { Language } from '../templates'
import { prefetchPistonRuntimes, runWithPiston } from './piston'
import { pythonRunner } from './pythonRunner'
import type { RunResult } from './types'
import { prefetchWandboxCompilers, runWithWandbox } from './wandbox'

/** Kicks off the slow parts (Pyodide download, compiler list) in the background. */
export function warmUpRunners(): void {
  pythonRunner()
  if (RUNNER === 'piston') prefetchPistonRuntimes()
  else prefetchWandboxCompilers()
}

export function runCode(language: Language, code: string, stdin: string): Promise<RunResult> {
  if (language === 'python') return pythonRunner().run(code, stdin)
  return RUNNER === 'piston'
    ? runWithPiston(language, code, stdin)
    : runWithWandbox(language, code, stdin)
}
