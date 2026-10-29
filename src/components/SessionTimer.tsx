import { formatRemaining, urgency } from '../sessionTime'

interface Props {
  /** null until the session's expiry time has synced. */
  remainingMs: number | null
  onExtend: () => void
  disabled: boolean
}

/** "⏱ 1:59:42  +1h" in the top bar. */
export function SessionTimer({ remainingMs, onExtend, disabled }: Props) {
  const level = remainingMs === null ? 'ok' : urgency(remainingMs)
  return (
    <div className={`timer is-${level}`}>
      <span
        className="timer__time mono"
        role="timer"
        aria-label={remainingMs === null ? 'Session time loading' : `Session ends in ${formatRemaining(remainingMs)}`}
        title="Time left in this session"
      >
        <ClockIcon />
        {remainingMs === null ? '–:––:––' : formatRemaining(remainingMs)}
      </span>
      <button
        type="button"
        className="btn timer__extend"
        onClick={onExtend}
        disabled={disabled || remainingMs === null}
        title="Add 1 hour for everyone in this session"
      >
        +1h
      </button>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </svg>
  )
}

interface BannerProps {
  remainingMs: number
  onExtend: () => void
  onDismiss: () => void
}

/** Shown once the session is under 10 minutes. */
export function ExpiryBanner({ remainingMs, onExtend, onDismiss }: BannerProps) {
  return (
    <div className={`expiry-banner is-${urgency(remainingMs)}`} role="alert">
      <span>
        This session ends in <strong className="mono">{formatRemaining(remainingMs)}</strong>. When
        it does, the code, input and output are cleared for good.
      </span>
      <div className="expiry-banner__actions">
        <button type="button" className="btn btn--small" onClick={onExtend}>
          Add 1 hour
        </button>
        <button type="button" className="btn btn--icon btn--small btn--ghost" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  )
}
