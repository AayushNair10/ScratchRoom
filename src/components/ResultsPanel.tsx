import type { PythonStatus } from '../run/pythonRunner'
import type { RunResult } from '../run/types'
import { languageLabel } from '../templates'

function formatTime(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}

function Block({ label, text, tone }: { label: string; text: string; tone?: 'error' }) {
  return (
    <div className="result-block">
      <div className="result-block__label">{label}</div>
      <pre className={`result-block__text mono${tone ? ` is-${tone}` : ''}`}>{text}</pre>
    </div>
  )
}

interface Props {
  result: RunResult | undefined
  /** Who ran it, using their current nickname when they're still here. */
  ranBy: string | undefined
  runningLabel: string | null
  /** Shown only while Python is the selected language. */
  pythonStatus: PythonStatus | null
}

export function ResultsPanel({ result, ranBy, runningLabel, pythonStatus }: Props) {
  return (
    <section className="results" aria-live="polite">
      <div className="panel-header">
        <span>Output</span>
        {runningLabel ? (
          <span className="results__status">
            <span className="spinner" aria-hidden="true" />
            {runningLabel}
          </span>
        ) : pythonStatus === 'loading' ? (
          <span className="results__status is-muted">Loading Python…</span>
        ) : pythonStatus === 'error' ? (
          <span className="results__status is-error">Python failed to load. Run to retry.</span>
        ) : null}
      </div>
      <div className="results__body">
        {!result ? (
          <p className="panel-placeholder">
            Run your code to see the output here. <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> also runs it.
          </p>
        ) : (
          <>
            <div className="result-meta">
              <span className="result-meta__lang">
                {languageLabel(result.language)}
                {result.version ? ` ${result.version}` : ''}
              </span>
              {result.exitCode !== null && (
                <span className={result.exitCode === 0 ? 'is-ok' : 'is-error'}>
                  exit code {result.exitCode}
                </span>
              )}
              <span>{formatTime(result.timeMs)}</span>
              {ranBy && <span>run by {ranBy}</span>}
            </div>
            {result.message && (
              <div className={`result-message is-${result.status === 'timeout' ? 'warn' : 'error'}`}>
                {result.message}
              </div>
            )}
            {result.compileOutput && (
              <Block
                label={result.status === 'compile-error' ? 'Compile error' : 'Compiler output'}
                text={result.compileOutput}
                tone={result.status === 'compile-error' ? 'error' : undefined}
              />
            )}
            {(result.stdout || (!result.stderr && !result.compileOutput && !result.message)) && (
              <Block label="stdout" text={result.stdout || '(no output)'} />
            )}
            {result.stderr && <Block label="stderr" text={result.stderr} tone="error" />}
          </>
        )}
      </div>
    </section>
  )
}
