import { useState, type FormEvent } from 'react'
import { useTheme } from '../hooks/useTheme'
import { parseCode } from '../room'
import { ThemeToggle, Wordmark } from './ThemeToggle'

interface Props {
  onStart: () => void
  onJoin: (code: string) => void
}

export function Landing({ onStart, onJoin }: Props) {
  const [theme, toggleTheme] = useTheme()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const join = (e: FormEvent) => {
    e.preventDefault()
    const code = parseCode(value)
    if (code) onJoin(code)
    else setError('That doesn’t look like a session code. It has 10 letters and numbers, like k7f3x-q9amn.')
  }

  return (
    <div className="landing">
      <header className="landing__top">
        <Wordmark />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className="landing__main">
        <h1>A shared scratchpad for coding interviews.</h1>
        <p className="landing__lead">
          Write and run Python, C, C++ and Java together in real time. No sign-up, and nothing is
          saved: sessions last 2 hours and then disappear.
        </p>

        <div className="landing__cards">
          <section className="landing__card">
            <h2>Start a session</h2>
            <p>You’ll get a code to share with the other person.</p>
            <button type="button" className="btn btn--primary btn--large" onClick={onStart}>
              Start new session
            </button>
          </section>

          <section className="landing__card">
            <h2>Join a session</h2>
            <p>Paste the code you were given.</p>
            <form className="join-form" onSubmit={join} noValidate>
              <input
                className={`input mono${error ? ' has-error' : ''}`}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setError(null)
                }}
                placeholder="k7f3x-q9amn"
                aria-label="Session code"
                aria-invalid={!!error}
                aria-describedby={error ? 'join-error' : undefined}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button type="submit" className="btn btn--large" disabled={!value.trim()}>
                Join
              </button>
            </form>
            {error && (
              <p id="join-error" className="join-form__error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
