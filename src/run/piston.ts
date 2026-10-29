import { PISTON_URL } from '../config'
import type { Language } from '../templates'
import { compareVersions, describeHttpError, fetchWithTimeout, RunnerError } from './http'
import { truncate, type RunResult } from './types'

type CompiledLanguage = Exclude<Language, 'python'>

const PISTON_LANGUAGE: Record<CompiledLanguage, string> = { c: 'c', cpp: 'c++', java: 'java' }
const FILE_NAME: Record<CompiledLanguage, string> = { c: 'main.c', cpp: 'main.cpp', java: 'Main.java' }

interface PistonRuntime {
  language: string
  version: string
  aliases: string[]
}

interface PistonStage {
  stdout: string
  stderr: string
  output: string
  code: number | null
  signal: string | null
  /** Newer Piston versions: "TO" timeout, "SG" signal, "RE" runtime error, … */
  status?: string
  message?: string
  wall_time?: number
}

interface PistonResponse {
  language: string
  version: string
  run: PistonStage
  compile?: PistonStage
  message?: string
}

const AUTH_HINT =
  'The public emkc.org Piston API is whitelist-only, so point VITE_PISTON_URL at your own Piston instance (see the README).'

const request = (path: string, init?: RequestInit) => fetchWithTimeout(`${PISTON_URL}${path}`, init)

let runtimes: Promise<Map<string, string>> | null = null

/** Fetches /runtimes once and remembers the newest version of each language. */
function latestVersions(): Promise<Map<string, string>> {
  runtimes ??= (async () => {
    const res = await request('/runtimes')
    if (!res.ok) throw new RunnerError(await describeHttpError(res, AUTH_HINT))
    const list = (await res.json()) as PistonRuntime[]
    const latest = new Map<string, string>()
    for (const rt of list) {
      for (const name of [rt.language, ...(rt.aliases ?? [])]) {
        const current = latest.get(name)
        if (!current || compareVersions(rt.version, current) > 0) latest.set(name, rt.version)
      }
    }
    return latest
  })().catch((err: unknown) => {
    runtimes = null // try again next time
    throw err
  })
  return runtimes
}

/** Starts the /runtimes request early so the first run is quicker. */
export function prefetchPistonRuntimes(): void {
  latestVersions().catch(() => {})
}

export async function runWithPiston(
  language: CompiledLanguage,
  code: string,
  stdin: string,
): Promise<RunResult> {
  const started = performance.now()
  const base = { language, stdout: '', stderr: '', exitCode: null }
  try {
    const pistonLanguage = PISTON_LANGUAGE[language]
    const version = (await latestVersions()).get(pistonLanguage)
    if (!version) {
      throw new RunnerError(`The code runner at ${PISTON_URL} doesn't have ${pistonLanguage} installed.`)
    }

    const res = await request('/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLanguage,
        version,
        files: [{ name: FILE_NAME[language], content: code }],
        stdin,
      }),
    })
    if (!res.ok) throw new RunnerError(await describeHttpError(res, AUTH_HINT))
    const data = (await res.json()) as PistonResponse
    if (!data.run) throw new RunnerError(data.message ?? 'The code runner sent an unexpected response.')

    const timeMs = performance.now() - started
    const compileOutput = data.compile?.output?.trim() ? data.compile.output : undefined
    if (data.compile && data.compile.code !== 0) {
      return {
        ...base,
        version: data.version,
        status: 'compile-error',
        compileOutput: truncate(data.compile.output || data.compile.message || 'Compilation failed.'),
        exitCode: data.compile.code,
        timeMs,
        finishedAt: Date.now(),
      }
    }

    const run = data.run
    const timedOut = run.status === 'TO'
    return {
      ...base,
      version: data.version,
      status: timedOut ? 'timeout' : 'ok',
      compileOutput: compileOutput && truncate(compileOutput),
      stdout: truncate(run.stdout ?? ''),
      stderr: truncate(run.stderr ?? ''),
      exitCode: run.code,
      timeMs: typeof run.wall_time === 'number' ? run.wall_time : timeMs,
      message: timedOut
        ? 'Time limit exceeded: the runner stopped the program.'
        : run.signal
          ? `The program was killed by ${run.signal}${run.signal === 'SIGKILL' ? ' (usually the time or memory limit)' : ''}.`
          : undefined,
      finishedAt: Date.now(),
    }
  } catch (err) {
    return {
      ...base,
      status: 'error',
      timeMs: performance.now() - started,
      message: err instanceof RunnerError ? err.message : `Something went wrong: ${String(err)}`,
      finishedAt: Date.now(),
    }
  }
}
