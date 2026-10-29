import { useState, type FormEvent } from 'react'
import { useTheme } from '../hooks/useTheme'
import { formatCode, NICKNAME_MAX_LENGTH, parseCode } from '../room'
import { ThemeToggle, Wordmark } from './ThemeToggle'

function Shell({ children }: { children: React.ReactNode }) {
  const [theme, toggleTheme] = useTheme()
  return (
    <div className="landing">
      <header className="landing__top">
        <Wordmark />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>
      <main className="landing__main">{children}</main>
    </div>
  )
}

function NicknameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="landing__card nickname-card">
      <label htmlFor="nickname-input">
        <h2>Your name</h2>
        <p>Shown to others next to your cursor. Leave it empty for a random name like “Teal Otter”.</p>
      </label>
      <input
        id="nickname-input"
        className="input input--large"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={NICKNAME_MAX_LENGTH}
        placeholder="e.g. Aayush"
        autoComplete="off"
        autoFocus
      />
    </section>
  )
}

interface LandingProps {
  onStart: (nickname: string) => void
  onJoin: (code: string, nickname: string) => void
}

/** The home page: pick a name, then start a session or join one with a code. */
export function Landing({ onStart, onJoin }: LandingProps) {
  const [nickname, setNickname] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const join = (e: FormEvent) => {
    e.preventDefault()
    const code = parseCode(value)
    if (code) onJoin(code, nickname)
    else setError('That doesn’t look like a session code. It has 10 letters and numbers, like k7f3x-q9amn.')
  }

  return (
    <Shell>
      <h1>A shared scratchpad for coding interviews.</h1>
      <p className="landing__lead">
        Write and run Python, C, C++ and Java together in real time. No sign-up, and nothing is
        saved: sessions last 2 hours and then disappear.
      </p>

      <NicknameField value={nickname} onChange={setNickname} />

      <div className="landing__cards">
        <section className="landing__card">
          <h2>Start a session</h2>
          <p>You’ll get a code to share with the other person.</p>
          <button type="button" className="btn btn--primary btn--large" onClick={() => onStart(nickname)}>
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
    </Shell>
  )
}

interface JoinPromptProps {
  code: string
  onJoin: (nickname: string) => void
  onCancel: () => void
}

/** Shown when you open a session link directly (or reload), so you can still pick a name. */
export function JoinPrompt({ code, onJoin, onCancel }: JoinPromptProps) {
  const [nickname, setNickname] = useState('')
  return (
    <Shell>
      <h1>
        Join session <span className="mono join-code">{formatCode(code)}</span>
      </h1>
      <p className="landing__lead">Pick a name so the others know who’s typing.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onJoin(nickname)
        }}
      >
        <NicknameField value={nickname} onChange={setNickname} />
        <div className="join-prompt__actions">
          <button type="submit" className="btn btn--primary btn--large">
            Join session
          </button>
          <button type="button" className="btn btn--large btn--ghost" onClick={onCancel}>
            Back to home
          </button>
        </div>
      </form>
    </Shell>
  )
}
