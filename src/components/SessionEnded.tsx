import { useEffect, useRef } from 'react'

interface Props {
  onNewSession: () => void
  onHome: () => void
}

export function SessionEnded({ onNewSession, onHome }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => buttonRef.current?.focus(), [])

  return (
    <div className="session-ended" role="alertdialog" aria-modal="true" aria-labelledby="session-ended-title">
      <div className="session-ended__card">
        <div className="session-ended__icon" aria-hidden="true">
          ⏱
        </div>
        <h2 id="session-ended-title">Session ended</h2>
        <p>
          Time’s up. The code, input, output and drawings from this session have been cleared from
          this browser and you’ve been disconnected. Nothing was saved.
        </p>
        <div className="session-ended__actions">
          <button ref={buttonRef} type="button" className="btn btn--primary btn--large" onClick={onNewSession}>
            Start new session
          </button>
          <button type="button" className="btn btn--large" onClick={onHome}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
