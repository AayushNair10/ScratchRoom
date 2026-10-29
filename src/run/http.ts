/** Shared plumbing for the remote runners (Wandbox, Piston). */

const DEFAULT_TIMEOUT_MS = 30_000

/** An error whose message is ready to show to the user as-is. */
export class RunnerError extends Error {}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new RunnerError(`The code runner didn't respond within ${timeoutMs / 1000} seconds.`)
    }
    throw new RunnerError(
      `Couldn't reach the code runner at ${new URL(url).origin}. Check your internet connection` +
        ` (if you host the runner yourself, check that it's running and allows CORS). (${String(err)})`,
    )
  } finally {
    window.clearTimeout(timer)
  }
}

/** Turns a non-2xx response into a readable message. `hint401` explains auth failures. */
export async function describeHttpError(res: Response, hint401 = ''): Promise<string> {
  let detail = ''
  try {
    const text = (await res.text()).trim()
    try {
      detail = (JSON.parse(text) as { message?: string }).message ?? ''
    } catch {
      detail = text.length < 200 ? text : ''
    }
  } catch {
    // no body
  }
  if (res.status === 429) {
    return 'Rate limited: the code runner received too many requests. Wait a few seconds and try again.'
  }
  if (res.status === 401 || res.status === 403) {
    return `The code runner refused the request (HTTP ${res.status}). ${detail ? `It said: “${detail}” ` : ''}${hint401}`.trim()
  }
  return `The code runner returned an error (HTTP ${res.status})${detail ? `: ${detail}` : '.'}`
}

/** Compares dotted version strings numerically: "10.2.0" > "9.4.0". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pb = b.split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}
