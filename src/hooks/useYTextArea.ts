import { useEffect, useRef } from 'react'
import type * as Y from 'yjs'

const LOCAL_ORIGIN = Symbol('textarea')

/** Shifts a caret index through a Y.Text delta made by someone else. */
function transformIndex(delta: Y.YTextEvent['delta'], index: number): number {
  let oldPos = 0 // position in the text as it was before the change
  let shift = 0
  for (const op of delta) {
    if (oldPos > index) break
    if (op.retain) {
      oldPos += op.retain
    } else if (typeof op.insert === 'string') {
      shift += op.insert.length
    } else if (op.delete) {
      shift -= Math.min(op.delete, index - oldPos)
      oldPos += op.delete
    }
  }
  return Math.max(0, index + shift)
}

/**
 * Two-way binds a plain <textarea> to a shared Y.Text, keeping the local caret
 * in place when other people type.
 */
export function useYTextArea(ytext: Y.Text) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.value = ytext.toString()

    const onInput = () => {
      const next = el.value
      const prev = ytext.toString()
      if (next === prev) return
      let start = 0
      const max = Math.min(next.length, prev.length)
      while (start < max && next[start] === prev[start]) start++
      let end = 0
      while (
        end < max - start &&
        next[next.length - 1 - end] === prev[prev.length - 1 - end]
      ) {
        end++
      }
      ytext.doc!.transact(() => {
        ytext.delete(start, prev.length - start - end)
        ytext.insert(start, next.slice(start, next.length - end))
      }, LOCAL_ORIGIN)
    }

    const observer = (event: Y.YTextEvent) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return
      const focused = document.activeElement === el
      const selStart = el.selectionStart
      const selEnd = el.selectionEnd
      el.value = ytext.toString()
      if (focused) {
        el.setSelectionRange(
          transformIndex(event.delta, selStart),
          transformIndex(event.delta, selEnd),
        )
      }
    }

    el.addEventListener('input', onInput)
    ytext.observe(observer)
    return () => {
      el.removeEventListener('input', onInput)
      ytext.unobserve(observer)
    }
  }, [ytext])

  return ref
}
