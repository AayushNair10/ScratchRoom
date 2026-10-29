export interface WorkerRequest {
  code: string
  stdin: string
}

export type WorkerResponse =
  | { type: 'ready'; version: string }
  | { type: 'load-error'; message: string }
  | { type: 'started' }
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'done'; exitCode: number; timeMs: number }
