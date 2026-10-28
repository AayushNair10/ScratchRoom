import { LANGUAGES, type Language } from '../templates'
import type { Theme } from '../hooks/useTheme'

interface Props {
  language: Language
  onLanguageChange: (lang: Language) => void
  running: boolean
  canRun: boolean
  onRun: () => void
  theme: Theme
  onToggleTheme: () => void
  disabled: boolean
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function TopBar({
  language,
  onLanguageChange,
  running,
  canRun,
  onRun,
  theme,
  onToggleTheme,
  disabled,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar__group">
        <span className="wordmark">
          <span className="wordmark__mark" aria-hidden="true">
            {'</>'}
          </span>
          Scratchroom
        </span>
        <select
          className="select"
          aria-label="Language"
          value={language}
          disabled={disabled}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--run"
          onClick={onRun}
          disabled={running || !canRun || disabled}
          title={`Run (${isMac ? '⌘' : 'Ctrl'}+Enter)`}
        >
          {running ? <span className="spinner" aria-hidden="true" /> : <span aria-hidden="true">▶</span>}
          {running ? 'Running' : 'Run'}
        </button>
      </div>

      <div className="topbar__group">
        <button
          type="button"
          className="btn btn--icon"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
