/// <reference lib="webworker" />
// Runs Python with Pyodide, loaded from the jsDelivr CDN. The main thread kills
// this worker on timeout, so nothing here needs to be interruptible.

import type { WorkerRequest, WorkerResponse } from './pythonProtocol'
import { OUTPUT_LIMIT } from './types'

const PYODIDE_VERSION = '314.0.7'
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

interface PyodideAPI {
  runPython: (code: string) => unknown
  globals: { set: (name: string, value: unknown) => void; get: (name: string) => unknown }
  setStdout: (opts: { write: (buf: Uint8Array) => number }) => void
  setStderr: (opts: { write: (buf: Uint8Array) => number }) => void
  setStdin: (opts: { stdin: () => string | undefined }) => void
  loadPackagesFromImports: (
    code: string,
    opts?: { messageCallback?: (msg: string) => void; errorCallback?: (msg: string) => void },
  ) => Promise<unknown>
}

const post = (msg: WorkerResponse) => self.postMessage(msg)

// Wraps the user's program so SystemExit and tracebacks behave like CPython's CLI,
// with a fresh __main__ namespace every run.
const RUNNER = `
import sys, traceback

def __scratchroom_run(src):
    g = {"__name__": "__main__", "__builtins__": __builtins__}
    try:
        exec(compile(src, "main.py", "exec"), g)
        return 0
    except SystemExit as e:
        code = e.code
        if code is None:
            return 0
        if isinstance(code, int):
            return code
        print(code, file=sys.stderr)
        return 1
    except BaseException:
        etype, value, tb = sys.exc_info()
        traceback.print_exception(etype, value, tb.tb_next)
        return 1
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
`

async function load(): Promise<PyodideAPI> {
  const { loadPyodide } = (await import(/* @vite-ignore */ `${PYODIDE_BASE}pyodide.mjs`)) as {
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideAPI>
  }
  const py = await loadPyodide({ indexURL: PYODIDE_BASE })
  py.runPython(RUNNER)
  return py
}

const pyodideReady = load()
pyodideReady.then(
  (py) => post({ type: 'ready', version: String(py.runPython('import sys; sys.version.split()[0]')) }),
  (err: unknown) => post({ type: 'load-error', message: String(err) }),
)

function makeWriter(stream: 'stdout' | 'stderr') {
  const decoder = new TextDecoder()
  let sent = 0
  return {
    write(buf: Uint8Array) {
      if (sent < OUTPUT_LIMIT) {
        const text = decoder.decode(buf, { stream: true })
        sent += text.length
        post({ type: 'output', stream, text })
      }
      return buf.length
    },
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { code, stdin } = event.data
  let py: PyodideAPI
  try {
    py = await pyodideReady
  } catch {
    return // load-error was already reported
  }

  try {
    // Fetches e.g. numpy from the CDN if the program imports it.
    await py.loadPackagesFromImports(code, {
      messageCallback: () => {}, // "Loading numpy…" chatter isn't program output
      errorCallback: (msg) => post({ type: 'output', stream: 'stderr', text: `${msg}\n` }),
    })
  } catch (err) {
    post({ type: 'output', stream: 'stderr', text: `Couldn't load packages: ${String(err)}\n` })
  }

  py.setStdout(makeWriter('stdout'))
  py.setStderr(makeWriter('stderr'))
  let stdinUsed = false
  py.setStdin({
    // Hand over all of stdin at once, then signal EOF.
    stdin: () => {
      if (stdinUsed) return undefined
      stdinUsed = true
      return stdin
    },
  })

  post({ type: 'started' })
  const start = performance.now()
  const run = py.globals.get('__scratchroom_run') as (src: string) => number
  let exitCode: number
  try {
    exitCode = run(code)
  } catch (err) {
    post({ type: 'output', stream: 'stderr', text: `${String(err)}\n` })
    exitCode = 1
  }
  post({ type: 'done', exitCode, timeMs: performance.now() - start })
}
