import type { ReactNode } from 'react'
import { LANGUAGES, type Language } from '../templates'
import type { Theme } from '../hooks/useTheme'
import { ThemeToggle, Wordmark } from './ThemeToggle'

interface Props {
  language: Language
  onLanguageChange: (lang: Language) => void
  running: boolean
  canRun: boolean
  onRun: () => void
  sessionCode: string
  onCopyCode: () => void
  timer: ReactNode
  presence: ReactNode
  theme: Theme
  onToggleTheme: () => void
  disabled: boolean
  onHome: () => void
  onOpenWhiteboard: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function TopBar({
  language,
  onLanguageChange,
  running,
  canRun,
  onRun,
  sessionCode,
  onCopyCode,
  timer,
  presence,
  theme,
  onToggleTheme,
  disabled,
  onHome,
  onOpenWhiteboard,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar__group">
        <Wordmark onClick={onHome} />
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
        <span className="only-narrow">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </span>
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

      <div className="topbar__group topbar__group--session">
        {timer}
        <span className="topbar__divider" aria-hidden="true" />
        <button
          type="button"
          className="btn"
          onClick={onOpenWhiteboard}
          disabled={disabled}
          title="Open the shared whiteboard"
          aria-label="Whiteboard"
        >
          <BoardIcon />
          <span className="btn__label">Whiteboard</span>
        </button>
        {presence}
        <button
          type="button"
          className="btn session-code"
          onClick={onCopyCode}
          title="Copy the session code to share it"
          aria-label={`Session code ${sessionCode}. Click to copy.`}
        >
          <span className="session-code__label">Code</span>
          <span className="mono">{sessionCode}</span>
          <CopyIcon />
        </button>
        <span className="only-wide">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </span>
      </div>
    </header>
  )
}

function BoardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21l4-4 4 4M7 13l3-3 2 2 4-4" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
