import { WANDBOX_URL } from '../config'
import type { Language } from '../templates'
import { compareVersions, describeHttpError, fetchWithTimeout, RunnerError } from './http'
import { truncate, type RunResult } from './types'

type CompiledLanguage = Exclude<Language, 'python'>

const WANDBOX_LANGUAGE: Record<CompiledLanguage, string> = { c: 'C', cpp: 'C++', java: 'Java' }
const COMPILER_FLAGS: Record<CompiledLanguage, string> = { c: '-O2\n-lm', cpp: '-O2', java: '' }
/** Wandbox kills programs after roughly 30 s, and compiling takes a few more. */
const REQUEST_TIMEOUT_MS = 60_000
/** 128 + SIGKILL: Wandbox's time (or memory) limit. */
const KILLED_STATUS = 137

/**
 * Wandbox always saves the main file as prog.java, which javac rejects for a
 * `public class Main`. So send the code as its own file named after the public
 * class, leave prog.java empty, and add the file to the javac command line.
 * Wandbox's runner then starts whichever class has a main method.
 */
function javaFiles(code: string) {
  const file = `${/public\s+(?:final\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(code)?.[1] ?? 'Main'}.java`
  return { code: '', codes: [{ file, code }], 'compiler-option-raw': file }
}

interface WandboxCompiler {
  name: string
  version: string
  language: string
}

interface WandboxResult {
  status?: string
  signal?: string
  compiler_output?: string
  compiler_error?: string
  compiler_message?: string
  program_output?: string
  program_error?: string
}

let compilers: Promise<Map<CompiledLanguage, WandboxCompiler>> | null = null

/** Fetches the compiler list once and picks the newest stable compiler per language. */
function pickCompilers(): Promise<Map<CompiledLanguage, WandboxCompiler>> {
  compilers ??= (async () => {
    const res = await fetchWithTimeout(`${WANDBOX_URL}/api/list.json`)
    if (!res.ok) throw new RunnerError(await describeHttpError(res))
    const list = (await res.json()) as WandboxCompiler[]
    const picked = new Map<CompiledLanguage, WandboxCompiler>()
    for (const lang of Object.keys(WANDBOX_LANGUAGE) as CompiledLanguage[]) {
      const candidates = list.filter(
        (c) =>
          c.language === WANDBOX_LANGUAGE[lang] &&
          // Skip trunk / experimental builds, and prefer GCC for C and C++.
          !/head|dev|snapshot/i.test(c.name) &&
          (lang === 'java' || c.name.startsWith('gcc-')),
      )
      candidates.sort((a, b) => compareVersions(b.version, a.version))
      if (candidates[0]) picked.set(lang, candidates[0])
    }
    return picked
  })().catch((err: unknown) => {
    compilers = null // try again next time
    throw err
  })
  return compilers
}

export function prefetchWandboxCompilers(): void {
  pickCompilers().catch(() => {})
}

export async function runWithWandbox(
  language: CompiledLanguage,
  code: string,
  stdin: string,
): Promise<RunResult> {
  const started = performance.now()
  const base = { language, stdout: '', stderr: '', exitCode: null }
  try {
    const compiler = (await pickCompilers()).get(language)
    if (!compiler) {
      throw new RunnerError(`Wandbox doesn't currently offer a ${WANDBOX_LANGUAGE[language]} compiler.`)
    }
    const version = compiler.name.startsWith('gcc-')
      ? `(GCC ${compiler.version})`
      : `(OpenJDK ${compiler.version.replace(/^jdk-/, '').split('+')[0]})`

    const res = await fetchWithTimeout(`${WANDBOX_URL}/api/compile.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler: compiler.name,
        stdin,
        save: false,
        ...(language === 'java'
          ? javaFiles(code)
          : { code, 'compiler-option-raw': COMPILER_FLAGS[language] }),
      }),
    }, REQUEST_TIMEOUT_MS)
    if (!res.ok) throw new RunnerError(await describeHttpError(res))
    const data = (await res.json()) as WandboxResult
    const timeMs = performance.now() - started

    const compileOutput = (data.compiler_message ?? '').trim() ? data.compiler_message : undefined
    const status = data.status ? Number(data.status) : null
    const exitCode = status === null || Number.isNaN(status) ? null : status

    // The merged result doesn't say which phase failed: a failing status with
    // compiler errors and no program output at all means compilation failed.
    const compileFailed =
      exitCode !== 0 &&
      !data.program_output &&
      !data.program_error &&
      /error/i.test(data.compiler_error ?? '')
    if (compileFailed) {
      return {
        ...base,
        version,
        status: 'compile-error',
        compileOutput: truncate(compileOutput ?? 'Compilation failed.'),
        exitCode,
        timeMs,
        finishedAt: Date.now(),
      }
    }

    const signal = data.signal ?? ''
    const killed = exitCode === KILLED_STATUS || /kill|xcpu/i.test(signal)
    return {
      ...base,
      version,
      status: killed ? 'timeout' : 'ok',
      compileOutput: compileOutput && truncate(compileOutput),
      stdout: truncate(data.program_output ?? ''),
      stderr: truncate(data.program_error ?? ''),
      exitCode,
      timeMs,
      message: killed
        ? 'Time limit exceeded: Wandbox stopped the program (it allows about 30 seconds, and also kills programs that use too much memory).'
        : signal
          ? `The program was killed by ${signal}.`
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
