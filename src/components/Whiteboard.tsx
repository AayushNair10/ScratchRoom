import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import * as Y from 'yjs'
import type { Theme } from '../hooks/useTheme'
import { ConfirmDialog } from './ConfirmDialog'

const STROKE_WIDTH = 3
const ERASER_RADIUS = 10
/** How often an in-progress stroke is sent to the others. */
const FLUSH_INTERVAL_MS = 50
/** Skip points closer than this (CSS px) to the previous one. */
const MIN_POINT_DISTANCE = 1.5

type Tool = 'pen' | 'eraser'

interface ActiveStroke {
  pointerId: number
  points: Y.Array<number>
  /** Points drawn locally but not yet pushed to the shared array. */
  pending: number[]
  lastX: number
  lastY: number
  lastFlush: number
}

/** Flat [x0, y0, x1, y1, …] points of a stroke, or null if a peer sent something odd. */
function pointsOf(stroke: unknown): Y.Array<number> | null {
  if (!(stroke instanceof Y.Map)) return null
  const points = stroke.get('points')
  return points instanceof Y.Array ? points : null
}

const round = (n: number) => Math.round(n * 1e5) / 1e5

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function drawPolyline(ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, w: number, h: number) {
  if (pts.length < 2) return
  const x = (i: number) => pts[i] * w
  const y = (i: number) => pts[i + 1] * h
  if (pts.length < 4) {
    ctx.beginPath()
    ctx.arc(x(0), y(0), STROKE_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(x(0), y(0))
  // Smooth the line by curving through the midpoints between samples.
  for (let i = 2; i < pts.length - 2; i += 2) {
    ctx.quadraticCurveTo(x(i), y(i), (x(i) + x(i + 2)) / 2, (y(i) + y(i + 2)) / 2)
  }
  ctx.lineTo(x(pts.length - 2), y(pts.length - 2))
  ctx.stroke()
}

interface Props {
  strokes: Y.Array<Y.Map<unknown>>
  theme: Theme
  timer: ReactNode
  readOnly: boolean
  onClose: () => void
}

export function Whiteboard({ strokes, theme, timer, readOnly, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [confirmClear, setConfirmClear] = useState(false)
  const [isEmpty, setIsEmpty] = useState(strokes.length === 0)
  const active = useRef<ActiveStroke | null>(null)
  const eraserAt = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)

  // ---------- Rendering ----------

  const render = useCallback(() => {
    frame.current = 0
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const ink = getComputedStyle(canvas).getPropertyValue('--ink').trim() || (theme === 'dark' ? '#e6e8ec' : '#1c2026')
    ctx.strokeStyle = ink
    ctx.fillStyle = ink
    ctx.lineWidth = STROKE_WIDTH
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of strokes) {
      const points = pointsOf(stroke)
      if (!points) continue
      const pts = points.toArray()
      if (active.current?.points === points) pts.push(...active.current.pending)
      drawPolyline(ctx, pts, w, h)
    }

    if (eraserAt.current) {
      ctx.save()
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(eraserAt.current.x, eraserAt.current.y, ERASER_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }, [strokes, theme])

  const scheduleRender = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(render)
  }, [render])

  useEffect(() => {
    const onChange = () => {
      setIsEmpty(strokes.length === 0)
      scheduleRender()
    }
    strokes.observeDeep(onChange)
    const canvas = canvasRef.current!
    const resize = new ResizeObserver(scheduleRender)
    resize.observe(canvas)
    // Zooming changes devicePixelRatio without necessarily resizing the element.
    window.addEventListener('resize', scheduleRender)
    scheduleRender()
    return () => {
      strokes.unobserveDeep(onChange)
      resize.disconnect()
      window.removeEventListener('resize', scheduleRender)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [strokes, scheduleRender])

  // ---------- Drawing ----------

  const flush = useCallback(() => {
    const a = active.current
    if (!a || a.pending.length === 0) return
    a.points.push(a.pending)
    a.pending = []
    a.lastFlush = performance.now()
  }, [])

  const eraseAt = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const hits: number[] = []
      strokes.forEach((stroke, index) => {
        const pts = pointsOf(stroke)?.toArray()
        if (!pts) return
        if (pts.length === 2) {
          if (Math.hypot(pts[0] * w - x, pts[1] * h - y) <= ERASER_RADIUS + STROKE_WIDTH) hits.push(index)
          return
        }
        for (let i = 0; i + 3 < pts.length; i += 2) {
          const d = distToSegment(x, y, pts[i] * w, pts[i + 1] * h, pts[i + 2] * w, pts[i + 3] * h)
          if (d <= ERASER_RADIUS + STROKE_WIDTH / 2) {
            hits.push(index)
            return
          }
        }
      })
      if (hits.length) {
        strokes.doc?.transact(() => {
          for (const index of hits.reverse()) strokes.delete(index, 1)
        })
      }
    },
    [strokes],
  )

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || active.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y, w, h } = localPoint(e)

    if (tool === 'eraser') {
      active.current = { pointerId: e.pointerId, points: new Y.Array(), pending: [], lastX: x, lastY: y, lastFlush: 0 }
      eraseAt(x, y)
      return
    }

    const points = new Y.Array<number>()
    points.push([round(x / w), round(y / h)])
    const stroke = new Y.Map<unknown>()
    stroke.set('id', `${strokes.doc?.clientID ?? 0}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    stroke.set('points', points)
    strokes.push([stroke])
    active.current = { pointerId: e.pointerId, points, pending: [], lastX: x, lastY: y, lastFlush: performance.now() }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(e)
    if (tool === 'eraser') {
      eraserAt.current = { x, y }
      scheduleRender()
    }
    const a = active.current
    if (!a || a.pointerId !== e.pointerId) return

    // Coalesced events give smoother lines on fast moves (not available in Safari).
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : []
    const samples = events.length ? events.map(localPoint) : [localPoint(e)]

    for (const p of samples) {
      if (tool === 'eraser') {
        // Erase along the whole movement so fast swipes don't skip strokes.
        const steps = Math.max(1, Math.ceil(Math.hypot(p.x - a.lastX, p.y - a.lastY) / (ERASER_RADIUS / 2)))
        for (let i = 1; i <= steps; i++) {
          eraseAt(a.lastX + ((p.x - a.lastX) * i) / steps, a.lastY + ((p.y - a.lastY) * i) / steps)
        }
      } else {
        if (Math.hypot(p.x - a.lastX, p.y - a.lastY) < MIN_POINT_DISTANCE) continue
        a.pending.push(round(p.x / p.w), round(p.y / p.h))
      }
      a.lastX = p.x
      a.lastY = p.y
    }

    if (tool === 'pen') {
      if (performance.now() - a.lastFlush >= FLUSH_INTERVAL_MS) flush()
      scheduleRender()
    }
  }

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current?.pointerId !== e.pointerId) return
    flush()
    active.current = null
    scheduleRender()
  }

  const onPointerLeave = () => {
    eraserAt.current = null
    scheduleRender()
  }

  // ---------- Keyboard ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'p' || e.key === 'P') setTool('pen')
      else if (e.key === 'e' || e.key === 'E') setTool('eraser')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Don't leave a half-sent stroke behind if the board closes mid-draw.
  useEffect(() => () => flush(), [flush])

  return (
    <div className="whiteboard" role="dialog" aria-modal="true" aria-label="Whiteboard">
      <div className="whiteboard__toolbar">
        <div className="whiteboard__group" role="toolbar" aria-label="Whiteboard tools">
          <span className="whiteboard__title">Whiteboard</span>
          <button
            type="button"
            className={`btn${tool === 'pen' ? ' is-active' : ''}`}
            aria-pressed={tool === 'pen'}
            onClick={() => setTool('pen')}
            aria-label="Pen"
            title="Pen (P)"
          >
            <PenIcon /> <span className="btn__label">Pen</span>
          </button>
          <button
            type="button"
            className={`btn${tool === 'eraser' ? ' is-active' : ''}`}
            aria-pressed={tool === 'eraser'}
            onClick={() => setTool('eraser')}
            aria-label="Eraser"
            title="Eraser: removes any stroke it touches (E)"
          >
            <EraserIcon /> <span className="btn__label">Eraser</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmClear(true)}
            aria-label="Clear"
            disabled={readOnly || isEmpty}
            title="Clear the whole board for everyone"
          >
            <TrashIcon /> <span className="btn__label">Clear</span>
          </button>
        </div>
        <div className="whiteboard__group">
          <span className="whiteboard__hint">Everyone in the session sees this board.</span>
          <span className="whiteboard__timer">{timer}</span>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClose}
            title="Back to the code (Esc)"
            aria-label="Close whiteboard"
          >
            <CloseIcon /> <span className="btn__label">Close</span>
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={`whiteboard__canvas is-${tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={onPointerLeave}
      />
      {isEmpty && <p className="whiteboard__empty">Draw here with a mouse, finger or stylus.</p>}

      {confirmClear && (
        <ConfirmDialog
          message="Clear the whiteboard for everyone?"
          confirmLabel="Clear"
          cancelLabel="Cancel"
          onConfirm={() => {
            strokes.delete(0, strokes.length)
            setConfirmClear(false)
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}

const iconProps = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function PenIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 21h10" />
      <path d="M5.5 13.5 13 6a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 20H7.5L4 16.5a2 2 0 0 1 0-2.8z" />
      <path d="m9 10 6 6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
