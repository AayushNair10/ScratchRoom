import { useRef, useState, type ReactNode } from 'react'

const MIN_RATIO = 0.25
const MAX_RATIO = 0.8

interface Props {
  left: ReactNode
  right: ReactNode
  initialRatio?: number
}

/** Two columns with a draggable divider between them. */
export function SplitPane({ left, right, initialRatio = 0.6 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(initialRatio)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const next = (e.clientX - rect.left) / rect.width
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)))
  }

  const stopDragging = () => setDragging(false)

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowLeft' ? -0.02 : e.key === 'ArrowRight' ? 0.02 : 0
    if (step) setRatio((r) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, r + step)))
  }

  return (
    <div ref={containerRef} className={`split-pane${dragging ? ' is-dragging' : ''}`}>
      <div className="split-pane__side" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        className="split-pane__divider"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setRatio(initialRatio)}
      />
      <div className="split-pane__side split-pane__side--fill">{right}</div>
    </div>
  )
}
