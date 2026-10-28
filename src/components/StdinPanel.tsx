import { useState } from 'react'
import type * as Y from 'yjs'
import { useYTextArea } from '../hooks/useYTextArea'

export function StdinPanel({ stdin, readOnly }: { stdin: Y.Text; readOnly: boolean }) {
  const [open, setOpen] = useState(true)
  const textareaRef = useYTextArea(stdin)

  return (
    <section className={`stdin${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="panel-header panel-header--button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        Input (stdin)
      </button>
      {/* Kept mounted while collapsed so the shared text stays bound. */}
      <textarea
        ref={textareaRef}
        className="stdin__textarea mono"
        hidden={!open}
        readOnly={readOnly}
        spellCheck={false}
        placeholder="Text typed here is passed to your program as standard input."
        aria-label="Program input (stdin)"
      />
    </section>
  )
}
