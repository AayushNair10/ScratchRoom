import type { WorkerRequest, WorkerResponse } from './pythonProtocol'
import { OUTPUT_LIMIT, truncate, type RunResult } from './types'

const TIME_LIMIT_MS = 10_000
/** How long we wait for Pyodide to download and start before giving up. */
const LOAD_LIMIT_MS = 90_000

export type PythonStatus = 'loading' | 'ready' | 'error'

/**
 * Owns the Pyodide worker. It starts loading as soon as it's created, is reused
 * between runs, and is thrown away and replaced after a timeout or load failure.
 */
class PythonRunner {
  private worker!: Worker
  private status: PythonStatus = 'loading'
  private version: string | undefined
  private listeners = new Set<(s: PythonStatus) => void>()

  constructor() {
    this.spawn()
  }

  getStatus(): PythonStatus {
    return this.status
  }

  subscribe(listener: (s: PythonStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setStatus(status: PythonStatus) {
    this.status = status
    this.listeners.forEach((l) => l(status))
  }

  private spawn() {
    this.worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
    this.setStatus('loading')
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'ready') {
        this.version = e.data.version
        this.setStatus('ready')
      } else if (e.data.type === 'load-error') {
        this.setStatus('error')
      }
    })
    this.worker.addEventListener('error', () => this.setStatus('error'))
  }

  private respawn() {
    this.worker.terminate()
    this.spawn()
  }

  run(code: string, stdin: string): Promise<RunResult> {
    // A previous load failed (e.g. offline): try again from scratch.
    if (this.status === 'error') this.respawn()

    const worker = this.worker
    let stdout = ''
    let stderr = ''
    let startedAt = 0

    return new Promise<RunResult>((resolve) => {
      let timer = window.setTimeout(() => {
        finish({
          status: 'error',
          exitCode: null,
          timeMs: 0,
          message: 'Python took too long to load from the CDN. Check your connection and try again.',
        })
        this.respawn()
      }, LOAD_LIMIT_MS)

      const finish = (partial: Pick<RunResult, 'status' | 'exitCode' | 'timeMs' | 'message'>) => {
        window.clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onCrash)
        resolve({
          language: 'python',
          version: this.version,
          stdout: truncate(stdout),
          stderr: truncate(stderr),
          finishedAt: Date.now(),
          ...partial,
        })
      }

      const onMessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data
        switch (msg.type) {
          case 'output':
            // Keep a little over the limit so truncate() can tell we cut something off.
            if (msg.stream === 'stdout' && stdout.length <= OUTPUT_LIMIT) stdout += msg.text
            if (msg.stream === 'stderr' && stderr.length <= OUTPUT_LIMIT) stderr += msg.text
            break
          case 'started':
            startedAt = performance.now()
            window.clearTimeout(timer)
            timer = window.setTimeout(() => {
              finish({
                status: 'timeout',
                exitCode: null,
                timeMs: TIME_LIMIT_MS,
                message: `Time limit exceeded: the program was stopped after ${TIME_LIMIT_MS / 1000} seconds.`,
              })
              this.respawn()
            }, TIME_LIMIT_MS)
            break
          case 'done':
            finish({ status: 'ok', exitCode: msg.exitCode, timeMs: msg.timeMs })
            break
          case 'load-error':
            finish({
              status: 'error',
              exitCode: null,
              timeMs: startedAt ? performance.now() - startedAt : 0,
              message: `Couldn't load Python (Pyodide) from the CDN: ${msg.message}`,
            })
            break
        }
      }

      const onCrash = () => {
        finish({ status: 'error', exitCode: null, timeMs: 0, message: 'The Python worker crashed.' })
        this.respawn()
      }

      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onCrash)
      worker.postMessage({ code, stdin } satisfies WorkerRequest)
    })
  }
}

let instance: PythonRunner | null = null

/** The shared runner. The first call starts downloading Pyodide in the background. */
export function pythonRunner(): PythonRunner {
  instance ??= new PythonRunner()
  return instance
}
